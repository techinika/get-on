import {
  AiError,
  toAiError,
  type AiImageResult,
  type AiMessage,
  type AiModerationResult,
  type AiProvider,
  type AiResult,
  type AiUsage,
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
  const input = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
  const output = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
  return {
    inputTokens: Number.isFinite(input) && input > 0 ? input : undefined,
    outputTokens: Number.isFinite(output) && output > 0 ? output : undefined,
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

  private async request(
    path: string,
    body: unknown,
    timeoutMs: number,
    metadata?: Record<string, string>,
  ): Promise<unknown> {
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
    const response = await this.request(
      "/ai/run",
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
    const image =
      typeof result.image === "string"
        ? result.image
        : typeof envelope.image === "string"
          ? envelope.image
          : "";
    if (!image) {
      throw new AiError("AI_BAD_RESULT");
    }
    return {
      imageBase64: image,
      mime: "image/jpeg",
      usage: { images: 1 },
      modelId: input.modelId,
      raw: response,
    };
  }

  async moderate(input: ModerateInput): Promise<AiModerationResult> {
    const timeoutMs = input.timeoutMs ?? 45000;
    const response = await this.request(
      "/ai/run",
      { prompt: input.text },
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
        raw: response,
      };
    }

    const text = String(raw).trim();
    const safe = text.toLowerCase().startsWith("safe");
    const categories = text
      .split(/\s+/)
      .filter((part) => /^S\d{1,2}$/i.test(part))
      .map((part) => part.toUpperCase());
    return { safe, categories, raw: response };
  }
}
