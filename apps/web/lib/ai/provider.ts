import { sha256Hex, signWorkerRequest } from "@get-on/site-server";
import {
  AgentToolCall,
  AiError,
  toAiError,
  type AiImageResult,
  type AiMessage,
  type AiModerationResult,
  type AiProvider,
  type AiResult,
  type AiUsage,
  type ChatWithToolsInput,
  type ChatWithToolsOutput,
  type DescribeImageInput,
  type GenerateImageInput,
  type GenerateStructuredInput,
  type GenerateTextInput,
  type ModerateInput,
} from "@get-on/ai";

export type WorkersAiConfig = {
  accountId: string;
  apiToken: string;
  gatewayId: string;
  baseUrl?: string;
  workerUrl?: string;
  workerSecret?: string;
};

function timeoutSignal(timeoutMs: number): {
  signal: AbortSignal;
  clear: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1] ?? trimmed;
}

function usageFrom(value: unknown): AiUsage {
  const usage =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const input = Number(usage.prompt_tokens ?? usage.input_tokens ?? usage.inputTokens ?? 0);
  const output = Number(usage.completion_tokens ?? usage.output_tokens ?? usage.outputTokens ?? 0);
  const total = Number(usage.total_tokens ?? usage.totalTokens ?? 0);
  const neurons = Number(usage.neurons ?? usage.total_neurons ?? usage.totalNeurons ?? 0);
  const inputTokens = Number.isFinite(input) && input > 0 ? Math.round(input) : undefined;
  const outputTokens = Number.isFinite(output) && output > 0 ? Math.round(output) : undefined;
  const totalTokens =
    Number.isFinite(total) && total > 0
      ? Math.round(total)
      : inputTokens !== undefined || outputTokens !== undefined
        ? (inputTokens ?? 0) + (outputTokens ?? 0)
        : undefined;
  return {
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
    ...(totalTokens !== undefined ? { totalTokens } : {}),
    ...(Number.isFinite(neurons) && neurons > 0 ? { neurons: Math.ceil(neurons) } : {}),
  };
}

function messageContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((part) =>
        part && typeof part === "object" && "text" in part
          ? String((part as { text?: unknown }).text ?? "")
          : "",
      )
      .join("");
  }
  return "";
}

export class WorkersAiProvider implements AiProvider {
  readonly id = "workers-ai";
  private readonly config: WorkersAiConfig;

  constructor(config: WorkersAiConfig) {
    this.config = config;
  }

  private usesWorkerBackend(): boolean {
    return Boolean(this.config.workerUrl?.trim() && this.config.workerSecret?.trim());
  }

  private baseUrl(): string {
    return (
      this.config.baseUrl ??
      `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}`
    );
  }

  private headers(
    timeoutMs: number,
    metadata?: Record<string, string>,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiToken}`,
      "Content-Type": "application/json",
      "cf-aig-gateway-id": this.config.gatewayId,
      "cf-aig-skip-cache": "true",
      "cf-aig-collect-log-payload": "false",
      "cf-aig-max-attempts": "1",
      "cf-aig-request-timeout": String(timeoutMs),
    };
    if (metadata && Object.keys(metadata).length > 0) {
      headers["cf-aig-metadata"] = JSON.stringify(metadata);
    }
    return headers;
  }

  private async workerRequest(
    path: string,
    body: Record<string, unknown>,
    timeoutMs: number,
    metadata?: Record<string, string>,
  ): Promise<unknown> {
    const workerUrl = this.config.workerUrl!.replace(/\/+$/, "");
    const workerSecret = this.config.workerSecret!;
    const targetPath = path.startsWith("/ai/run/") ? "/ai/run" : path;
    const payloadObj: Record<string, unknown> =
      path.startsWith("/ai/run/")
        ? {
            model: path.slice("/ai/run/".length),
            inputs: body,
          }
        : { ...body };

    if (this.config.gatewayId) {
      payloadObj.gatewayId = this.config.gatewayId;
    }
    if (metadata && Object.keys(metadata).length > 0) {
      payloadObj.metadata = metadata;
    }

    const timer = timeoutSignal(timeoutMs);
    try {
      const serialized = JSON.stringify(payloadObj);
      const ts = String(Date.now());
      const host = new URL(workerUrl).hostname;
      const bodyHash = await sha256Hex(serialized);
      const sig = await signWorkerRequest(workerSecret, {
        ts,
        host,
        ip: "",
        bodyHash,
      });

      const response = await fetch(`${workerUrl}${targetPath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gs-host": host,
          "x-gs-ip": "",
          "x-gs-ts": ts,
          "x-gs-sig": sig,
        },
        body: serialized,
        signal: timer.signal,
      });

      const text = await response.text();
      let parsed: unknown = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = null;
      }

      if (!response.ok) {
        const envelope =
          parsed && typeof parsed === "object"
            ? (parsed as Record<string, unknown>)
            : {};
        const firstError = Array.isArray(envelope.errors)
          ? (envelope.errors[0] as Record<string, unknown> | undefined)
          : undefined;
        throw toAiError({
          status: response.status,
          code: firstError?.code,
          message:
            firstError?.message ??
            envelope.message ??
            (typeof parsed === "string" ? parsed : text) ??
            `Cloudflare Worker AI returned ${response.status}`,
        });
      }

      return parsed;
    } catch (error) {
      if (error instanceof AiError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new AiError("AI_TIMEOUT");
      }
      throw toAiError(error);
    } finally {
      timer.clear();
    }
  }

  private async request(
    path: string,
    body: unknown,
    timeoutMs: number,
    metadata?: Record<string, string>,
  ): Promise<unknown> {
    if (this.usesWorkerBackend()) {
      return this.workerRequest(
        path,
        (body && typeof body === "object" ? body : {}) as Record<string, unknown>,
        timeoutMs,
        metadata,
      );
    }

    if (!this.config.accountId || !this.config.apiToken || !this.config.gatewayId) {
      throw new AiError("AI_PROVIDER_ERROR", {
        details: { reason: "missing_cloudflare_config" },
      });
    }

    const timer = timeoutSignal(timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl()}${path}`, {
        method: "POST",
        headers: this.headers(timeoutMs, metadata),
        body: JSON.stringify(body),
        signal: timer.signal,
      });

      const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
      if (
        response.ok &&
        (contentType.startsWith("image/") || contentType.startsWith("application/octet-stream"))
      ) {
        const bytes = await response.arrayBuffer();
        return {
          result: { image: Buffer.from(bytes).toString("base64") },
          mime: contentType.split(";")[0]?.trim() || "image/jpeg",
        };
      }

      const text = await response.text();
      let parsed: unknown = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = null;
      }

      if (!response.ok) {
        const envelope =
          parsed && typeof parsed === "object"
            ? (parsed as Record<string, unknown>)
            : {};
        const firstError = Array.isArray(envelope.errors)
          ? (envelope.errors[0] as Record<string, unknown> | undefined)
          : undefined;
        throw toAiError({
          status: response.status,
          code: firstError?.code,
          message:
            firstError?.message ??
            envelope.message ??
            (typeof parsed === "string" ? parsed : text) ??
            `Cloudflare returned ${response.status}`,
        });
      }

      return parsed;
    } catch (error) {
      if (error instanceof AiError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new AiError("AI_TIMEOUT");
      }
      throw toAiError(error);
    } finally {
      timer.clear();
    }
  }

  private async chat(
    modelId: string,
    messages: AiMessage[] | unknown[],
    options: {
      maxTokens?: number;
      temperature?: number;
      timeoutMs?: number;
      metadata?: Record<string, string>;
      jsonSchema?: unknown;
      schemaName?: string;
    },
  ): Promise<{ content: string; usage: AiUsage; raw: unknown }> {
    const timeoutMs = options.timeoutMs ?? 45000;
    const body: Record<string, unknown> = {
      model: modelId,
      messages,
    };
    if (options.maxTokens) body.max_tokens = options.maxTokens;
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.jsonSchema) {
      body.response_format = {
        type: "json_schema",
        json_schema: {
          name: options.schemaName ?? "result",
          schema: options.jsonSchema,
          strict: true,
        },
      };
    }

    const response = await this.request(
      "/ai/v1/chat/completions",
      body,
      timeoutMs,
      options.metadata,
    );
    const envelope =
      response && typeof response === "object"
        ? (response as Record<string, unknown>)
        : {};
    const choices = Array.isArray(envelope.choices) ? envelope.choices : [];
    const first = choices[0] as Record<string, unknown> | undefined;
    const message =
      first && typeof first.message === "object"
        ? (first.message as Record<string, unknown>)
        : {};
    const content = messageContent(message.content);
    if (!content) {
      throw new AiError("AI_PROVIDER_ERROR", {
        details: { reason: "empty_response" },
      });
    }

    return {
      content,
      usage: usageFrom(envelope.usage),
      raw: response,
    };
  }

  async generateText(input: GenerateTextInput): Promise<AiResult<string>> {
    const result = await this.chat(input.modelId, input.messages, {
      maxTokens: input.maxTokens,
      temperature: input.temperature,
      timeoutMs: input.timeoutMs,
      metadata: input.metadata,
    });
    return {
      value: result.content,
      text: result.content,
      usage: result.usage,
      modelId: input.modelId,
      raw: result.raw,
    };
  }

  async generateStructured(
    input: GenerateStructuredInput,
  ): Promise<AiResult<unknown>> {
    const result = await this.chat(input.modelId, input.messages, {
      maxTokens: input.maxTokens,
      temperature: input.temperature,
      timeoutMs: input.timeoutMs,
      metadata: input.metadata,
      jsonSchema: input.jsonSchema,
      schemaName: input.schemaName,
    });
    try {
      return {
        value: JSON.parse(stripCodeFence(result.content)),
        usage: result.usage,
        modelId: input.modelId,
        raw: result.raw,
      };
    } catch {
      throw new AiError("AI_BAD_RESULT");
    }
  }

  async describeImage(input: DescribeImageInput): Promise<AiResult<string>> {
    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: input.prompt },
          {
            type: "image_url",
            image_url: {
              url: `data:${input.mime};base64,${input.imageBase64}`,
            },
          },
        ],
      },
    ];
    const result = await this.chat(input.modelId, messages, {
      maxTokens: input.maxTokens,
      timeoutMs: input.timeoutMs,
      metadata: input.metadata,
    });
    return {
      value: result.content,
      text: result.content,
      usage: { ...result.usage, images: 1 },
      modelId: input.modelId,
      raw: result.raw,
    };
  }

  async generateImage(input: GenerateImageInput): Promise<AiImageResult> {
    const timeoutMs = input.timeoutMs ?? 60000;
    if (!input.modelId) {
      throw new AiError("AI_PROVIDER_ERROR", {
        details: { reason: "image_model_missing" },
      });
    }
    const response = this.usesWorkerBackend()
      ? await this.workerRequest(
          "/ai/images/generate",
          {
            model: input.modelId,
            prompt: input.prompt,
            ...(input.steps !== undefined ? { steps: input.steps } : {}),
            ...(input.width !== undefined ? { width: input.width } : {}),
            ...(input.height !== undefined ? { height: input.height } : {}),
          },
          timeoutMs,
          input.metadata,
        )
      : await this.request(
          `/ai/run/${input.modelId}`,
          { prompt: input.prompt, steps: input.steps },
          timeoutMs,
          input.metadata,
        );
    const envelope =
      response && typeof response === "object"
        ? (response as Record<string, unknown>)
        : {};
    const result =
      envelope.result && typeof envelope.result === "object"
        ? (envelope.result as Record<string, unknown>)
        : {};
    const rawImage =
      typeof result.image === "string"
        ? result.image
        : typeof envelope.image === "string"
          ? envelope.image
          : typeof envelope.result === "string"
            ? envelope.result
            : "";
    const image = rawImage
      .replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "")
      .replace(/\s+/g, "");
    if (!image) {
      throw new AiError("AI_BAD_RESULT");
    }
    const mime =
      typeof envelope.mime === "string" && envelope.mime.startsWith("image/")
        ? envelope.mime
        : "image/jpeg";
    const providerUsage = usageFrom(envelope.usage ?? result.usage);
    return {
      imageBase64: image,
      mime,
      usage: { ...providerUsage, images: 1 },
      modelId: input.modelId,
      raw: response,
    };
  }

  async moderate(input: ModerateInput): Promise<AiModerationResult> {
    const timeoutMs = input.timeoutMs ?? 45000;
    if (!input.modelId) {
      throw new AiError("AI_PROVIDER_ERROR", {
        details: { reason: "guard_model_missing" },
      });
    }
    const response = await this.request(
      `/ai/run/${input.modelId}`,
      { messages: [{ role: "user", content: input.text }] },
      timeoutMs,
      input.metadata,
    );
    const envelope =
      response && typeof response === "object"
        ? (response as Record<string, unknown>)
        : {};
    const result = envelope.result;
    const value =
      result && typeof result === "object"
        ? (result as Record<string, unknown>)
        : {};
    const usage = usageFrom(envelope.usage ?? value.usage);
    const raw =
      value.response ??
      result ??
      envelope.response ??
      "";

    if (raw && typeof raw === "object") {
      const object = raw as Record<string, unknown>;
      return {
        safe: object.safe === true,
        categories: Array.isArray(object.categories)
          ? object.categories.map(String)
          : [],
        usage,
        raw: response,
      };
    }

    const text = String(raw).trim();
    const safe = text.toLowerCase().startsWith("safe");
    const categories = text
      .split(/\s+/)
      .filter((part) => /^S\d{1,2}$/i.test(part))
      .map((part) => part.toUpperCase());
    return { safe, categories, usage, raw: response };
  }

  async chatWithTools(
    input: ChatWithToolsInput,
  ): Promise<ChatWithToolsOutput> {
    const timeoutMs = input.timeoutMs ?? 45000;
    const body: Record<string, unknown> = {
      model: input.modelId,
      messages: input.messages,
    };
    if (input.tools && input.tools.length > 0) {
      body.tools = input.tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      }));
    }
    if (input.toolChoice) {
      body.tool_choice = input.toolChoice;
    }
    if (input.maxTokens) body.max_tokens = input.maxTokens;
    if (input.temperature !== undefined) body.temperature = input.temperature;

    const response = await this.request(
      "/ai/v1/chat/completions",
      body,
      timeoutMs,
      input.metadata,
    );
    const envelope =
      response && typeof response === "object"
        ? (response as Record<string, unknown>)
        : {};
    const choices = Array.isArray(envelope.choices) ? envelope.choices : [];
    const first = choices[0] as Record<string, unknown> | undefined;
    const message =
      first && typeof first.message === "object"
        ? (first.message as Record<string, unknown>)
        : {};
    const content = messageContent(message.content);
    const toolCalls: AgentToolCall[] = [];
    const rawToolCalls =
      message.tool_calls &&
      Array.isArray(message.tool_calls)
        ? (message.tool_calls as unknown[])
        : [];
    for (const call of rawToolCalls) {
      if (!call || typeof call !== "object") continue;
      const row = call as Record<string, unknown>;
      const id =
        typeof row.id === "string" ? row.id : crypto.randomUUID();
      const functionCall =
        row.function && typeof row.function === "object"
          ? (row.function as Record<string, unknown>)
          : {};
      const name =
        typeof functionCall.name === "string"
          ? functionCall.name
          : undefined;
      let argumentsValue: unknown = {};
      const rawArgs = functionCall.arguments;
      if (typeof rawArgs === "string") {
        try {
          argumentsValue = JSON.parse(rawArgs);
        } catch {
          argumentsValue = { _raw: rawArgs };
        }
      } else if (rawArgs && typeof rawArgs === "object") {
        argumentsValue = rawArgs;
      }
      if (name) {
        toolCalls.push({ id, name, arguments: argumentsValue });
      }
    }

    return {
      text: content,
      toolCalls,
      usage: usageFrom(envelope.usage),
      modelId: input.modelId,
      raw: response,
    };
  }
}
