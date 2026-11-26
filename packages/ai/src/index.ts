import { resolveThemeColors, type Theme } from "@get-on/blocks";

export type AiPurpose = "writer" | "brief" | "vision" | "guard" | "image";

export type AiTaskId =
  | "agent.chat"
  | "text.write"
  | "text.improve"
  | "list.expand"
  | "seo.write"
  | "profile.write"
  | "design.suggest"
  | "page.generate"
  | "design.interpret"
  | "design.options"
  | "design.restyle"
  | "template.fill"
  | "site.generate"
  | "section.generate"
  | "alt.describe"
  | "image.generate"
  | "moderate";

export const AI_TASKS: Record<
  AiTaskId,
  { id: AiTaskId; label: string; purpose: AiPurpose; capCredits: number; timeoutMs: number }
> = {
  "agent.chat": { id: "agent.chat", label: "Assistant chat", purpose: "writer", capCredits: 3, timeoutMs: 45000 },
  "text.write": { id: "text.write", label: "Write text", purpose: "writer", capCredits: 2, timeoutMs: 25000 },
  "text.improve": { id: "text.improve", label: "Improve text", purpose: "writer", capCredits: 2, timeoutMs: 25000 },
  "list.expand": { id: "list.expand", label: "Expand list", purpose: "writer", capCredits: 2, timeoutMs: 25000 },
  "seo.write": { id: "seo.write", label: "Write SEO metadata", purpose: "writer", capCredits: 2, timeoutMs: 20000 },
  "profile.write": { id: "profile.write", label: "Write business profile", purpose: "writer", capCredits: 2, timeoutMs: 25000 },
  "design.suggest": { id: "design.suggest", label: "Suggest design tweak", purpose: "brief", capCredits: 1, timeoutMs: 20000 },
  "page.generate": { id: "page.generate", label: "Generate page", purpose: "writer", capCredits: 5, timeoutMs: 60000 },
  "design.interpret": { id: "design.interpret", label: "Interpret design brief", purpose: "brief", capCredits: 3, timeoutMs: 30000 },
  "design.options": { id: "design.options", label: "Generate design options", purpose: "brief", capCredits: 3, timeoutMs: 30000 },
  "design.restyle": { id: "design.restyle", label: "Restyle website", purpose: "brief", capCredits: 3, timeoutMs: 30000 },
  "template.fill": { id: "template.fill", label: "Fill template copy", purpose: "writer", capCredits: 6, timeoutMs: 60000 },
  "site.generate": { id: "site.generate", label: "Generate website copy", purpose: "writer", capCredits: 8, timeoutMs: 75000 },
  "section.generate": { id: "section.generate", label: "Generate section", purpose: "writer", capCredits: 3, timeoutMs: 35000 },
  "alt.describe": { id: "alt.describe", label: "Describe image", purpose: "vision", capCredits: 2, timeoutMs: 25000 },
  "image.generate": { id: "image.generate", label: "Generate image", purpose: "image", capCredits: 5, timeoutMs: 60000 },
  "moderate": { id: "moderate", label: "Content safety check", purpose: "guard", capCredits: 0, timeoutMs: 15000 },
};

export const AI_ERROR_CODES = [
  "AI_NOT_CONFIGURED",
  "AI_DISABLED",
  "AI_RATE_LIMIT",
  "AI_TIMEOUT",
  "AI_PROVIDER_ERROR",
  "AI_BAD_RESULT",
  "AI_NO_CREDITS",
  "AI_INSUFFICIENT_CREDITS",
  "AI_DAILY_CAP",
  "AI_DAILY_ACTIONS",
  "AI_PLAN_INACTIVE",
  "AI_MODERATION_BLOCKED",
  "AI_REFUSED",
  "AI_INPUT_TOO_LARGE",
  "AI_TOO_LONG",
  "AI_BUSY",
  "AI_IMAGES_OFF",
] as const;

export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

export class AiError extends Error {
  code: AiErrorCode;
  details: Record<string, string | number>;
  status?: number;
  providerCode?: string;
  constructor(
    code: AiErrorCode,
    options?: {
      message?: string;
      details?: Record<string, string | number>;
      cause?: unknown;
      status?: number;
      providerCode?: string;
    },
  ) {
    super(options?.message ?? code, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "AiError";
    this.code = code;
    this.details = options?.details ?? {};
    this.status = options?.status;
    this.providerCode = options?.providerCode;
  }
}

export function isAiError(error: unknown): error is AiError {
  return error instanceof AiError || (Boolean(error) && typeof error === "object" && (error as { name?: string }).name === "AiError");
}

export function toAiError(error: unknown): AiError {
  if (isAiError(error)) return error;
  const rec =
    error && typeof error === "object"
      ? (error as {
          status?: number;
          statusCode?: number;
          code?: string | number;
          message?: string;
          name?: string;
        })
      : {};
  const status = rec.status ?? rec.statusCode ?? 0;
  const providerCode = rec.code !== undefined ? String(rec.code) : undefined;
  if (status === 429) {
    return new AiError("AI_RATE_LIMIT", {
      message: rec.message,
      status,
      providerCode,
      cause: error,
    });
  }
  if (rec.name === "AbortError" || rec.name === "TimeoutError") {
    return new AiError("AI_TIMEOUT", {
      message: rec.message,
      status: status || undefined,
      providerCode,
      cause: error,
    });
  }
  return new AiError("AI_PROVIDER_ERROR", {
    message: rec.message ?? "AI request failed",
    status: status || undefined,
    providerCode,
    cause: error,
  });
}

export function aiErrorMessage(
  code: AiErrorCode | string,
  details?: Record<string, string | number | unknown>,
): string {
  switch (code) {
    case "AI_RATE_LIMIT":
      return "Too many AI requests right now. Please try again in a moment.";
    case "AI_TIMEOUT":
      return "The AI request timed out. Please try again.";
    case "AI_NO_CREDITS":
    case "AI_INSUFFICIENT_CREDITS":
      if (details && typeof details.n === "number" && typeof details.m === "number") {
        return `You have ${details.n} AI credits available, but this action needs ${details.m}.`;
      }
      return "You do not have enough AI credits for this action.";
    case "AI_DAILY_CAP":
      return "Your daily AI credit limit has been reached.";
    case "AI_DAILY_ACTIONS":
      return "Your daily AI action limit has been reached.";
    case "AI_PLAN_INACTIVE":
      return "Your plan is inactive. Reactivate your plan to continue using AI.";
    case "AI_MODERATION_BLOCKED":
    case "AI_REFUSED":
      return "That request could not be processed by our safety filters.";
    case "AI_INPUT_TOO_LARGE":
    case "AI_TOO_LONG":
      return "Your request is too long to process.";
    case "AI_BUSY":
      return "Another AI request is already running. Please try again in a moment.";
    case "AI_IMAGES_OFF":
      return "AI image generation is currently switched off.";
    case "AI_NOT_CONFIGURED":
    case "AI_DISABLED":
      return "AI features are currently unavailable.";
    default:
      return "Something went wrong while running AI.";
  }
}

export type AiModel = {
  id: string;
  provider: string;
  modelId: string;
  purposes: AiPurpose[];
  neuronsPerMInput: number | null;
  neuronsPerMOutput: number | null;
  neuronsPerImage: number | null;
  contextTokens: number;
  maxOutputTokens: number;
  supportsJson: boolean;
  supportsVision: boolean;
  enabled: boolean;
  fallbackId: string | null;
  notes: string | null;
  verifiedAt: string | null;
};

export const MODEL_SEEDS: AiModel[] = [
  {
    id: "writer-fast",
    provider: "workers-ai",
    modelId: "@cf/meta/llama-3.2-3b-instruct",
    purposes: ["writer", "brief"],
    neuronsPerMInput: 250,
    neuronsPerMOutput: 750,
    neuronsPerImage: null,
    contextTokens: 32000,
    maxOutputTokens: 4096,
    supportsJson: true,
    supportsVision: false,
    enabled: true,
    fallbackId: null,
    notes: "Fast default writer",
    verifiedAt: null,
  },
  {
    id: "vision-fast",
    provider: "workers-ai",
    modelId: "@cf/meta/llama-3.2-11b-vision-instruct",
    purposes: ["vision"],
    neuronsPerMInput: 500,
    neuronsPerMOutput: 1500,
    neuronsPerImage: null,
    contextTokens: 32000,
    maxOutputTokens: 1024,
    supportsJson: false,
    supportsVision: true,
    enabled: true,
    fallbackId: null,
    notes: "Default vision model",
    verifiedAt: null,
  },
  {
    id: "guard-default",
    provider: "workers-ai",
    modelId: "@cf/meta/llama-guard-3-8b",
    purposes: ["guard"],
    neuronsPerMInput: 200,
    neuronsPerMOutput: 200,
    neuronsPerImage: null,
    contextTokens: 8192,
    maxOutputTokens: 256,
    supportsJson: false,
    supportsVision: false,
    enabled: true,
    fallbackId: null,
    notes: "Safety moderation",
    verifiedAt: null,
  },
  {
    id: "image-default",
    provider: "workers-ai",
    modelId: "@cf/black-forest-labs/flux-1-schnell",
    purposes: ["image"],
    neuronsPerMInput: null,
    neuronsPerMOutput: null,
    neuronsPerImage: 173,
    contextTokens: 2048,
    maxOutputTokens: 0,
    supportsJson: false,
    supportsVision: false,
    enabled: true,
    fallbackId: null,
    notes: "Default image generator",
    verifiedAt: null,
  },
];

export type ModelRequirement = {
  needsJson?: boolean;
  needsVision?: boolean;
  preferCheap?: boolean;
};

export function modelFor(
  models: AiModel[],
  purpose: AiPurpose,
  req?: ModelRequirement,
): AiModel | null;
export function modelFor(
  purpose: AiPurpose,
  req: ModelRequirement,
  models: AiModel[],
): AiModel | null;
export function modelFor(
  arg1: AiModel[] | AiPurpose,
  arg2: AiPurpose | ModelRequirement,
  arg3?: ModelRequirement | AiModel[],
): AiModel | null {
  const models = Array.isArray(arg1) ? arg1 : Array.isArray(arg3) ? arg3 : [];
  const purpose = Array.isArray(arg1) ? (arg2 as AiPurpose) : arg1;
  const req = (Array.isArray(arg1) ? (arg3 as ModelRequirement | undefined) : (arg2 as ModelRequirement | undefined)) ?? {};

  const candidates = models.filter(
    (m) =>
      m.enabled &&
      m.purposes.includes(purpose) &&
      (!req.needsJson || m.supportsJson) &&
      (!req.needsVision || m.supportsVision),
  );
  if (candidates.length === 0) {
    const samePurpose = models.find((m) => m.enabled && m.purposes.includes(purpose));
    if (samePurpose) return samePurpose;
    if (purpose === "image" || purpose === "vision" || purpose === "guard") {
      return null;
    }
    return models[0] ?? null;
  }
  return candidates[0] ?? null;
}

export type AiUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  images?: number;
  neurons?: number;
  generationNeurons?: number;
  moderationInputTokens?: number;
  moderationOutputTokens?: number;
  moderationTotalTokens?: number;
  moderationNeurons?: number;
  totalNeurons?: number;
  creditNeurons?: number;
  tokensEstimated?: boolean;
};

export type AiMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | Array<{ type: string; [key: string]: unknown }>;
  tool_call_id?: string;
  name?: string;
};

export type AiResult<T> = {
  value: T;
  text?: string;
  usage: AiUsage;
  modelId: string;
  raw?: unknown;
};

export type AiImageResult = {
  imageBase64: string;
  mime: string;
  usage: AiUsage;
  modelId: string;
  raw?: unknown;
};

export type AiModerationResult = {
  safe: boolean;
  categories: string[];
  usage?: AiUsage;
  raw?: unknown;
};

export type AgentToolCall = {
  id: string;
  name: string;
  arguments: unknown;
};

export type AgentToolDefinition = {
  name: string;
  description: string;
  inputSchema: unknown;
};

export type GenerateTextInput = {
  modelId: string;
  messages: AiMessage[];
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  metadata?: Record<string, string>;
};

export type GenerateStructuredInput = GenerateTextInput & {
  schemaName: string;
  jsonSchema: unknown;
};

export type DescribeImageInput = {
  modelId: string;
  prompt: string;
  mime: string;
  imageBase64: string;
  maxTokens?: number;
  timeoutMs?: number;
  metadata?: Record<string, string>;
};

export type GenerateImageInput = {
  modelId: string;
  prompt: string;
  width?: number;
  height?: number;
  steps?: number;
  timeoutMs?: number;
  metadata?: Record<string, string>;
};

export type ModerateInput = {
  modelId: string;
  text: string;
  timeoutMs?: number;
  metadata?: Record<string, string>;
};

export type ChatWithToolsInput = {
  modelId: string;
  messages: AiMessage[];
  tools: AgentToolDefinition[];
  toolChoice?: "auto" | "none" | "required" | Record<string, unknown>;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  metadata?: Record<string, string>;
};

export type ChatWithToolsOutput = {
  text: string;
  toolCalls: AgentToolCall[];
  usage: AiUsage;
  modelId: string;
  raw?: unknown;
};

export interface AiProvider {
  id: string;
  generateText(input: GenerateTextInput): Promise<AiResult<string>>;
  generateStructured(input: GenerateStructuredInput): Promise<AiResult<unknown>>;
  describeImage(input: DescribeImageInput): Promise<AiResult<string>>;
  generateImage(input: GenerateImageInput): Promise<AiImageResult>;
  moderate(input: ModerateInput): Promise<AiModerationResult>;
  chatWithTools(input: ChatWithToolsInput): Promise<ChatWithToolsOutput>;
}

export class FakeAiProvider implements AiProvider {
  readonly id = "fake";
  private readonly mode: "default" | "tool_calls";
  private readonly toolCalls: AgentToolCall[];

  constructor(options?: { mode?: "default" | "tool_calls"; toolCalls?: AgentToolCall[] }) {
    this.mode = options?.mode ?? "default";
    this.toolCalls = options?.toolCalls ?? [];
  }

  async generateText(input: GenerateTextInput): Promise<AiResult<string>> {
    const text = "Sample generated copy for your website.";
    return { value: text, text, usage: { inputTokens: 20, outputTokens: 12 }, modelId: input.modelId };
  }

  async generateStructured(input: GenerateStructuredInput): Promise<AiResult<unknown>> {
    return { value: {}, usage: { inputTokens: 20, outputTokens: 12 }, modelId: input.modelId };
  }

  async describeImage(input: DescribeImageInput): Promise<AiResult<string>> {
    const text = "A clear photo showing the business and its workspace.";
    return { value: text, text, usage: { inputTokens: 30, outputTokens: 12, images: 1 }, modelId: input.modelId };
  }

  async generateImage(input: GenerateImageInput): Promise<AiImageResult> {
    return {
      imageBase64:
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      mime: "image/png",
      usage: { images: 1 },
      modelId: input.modelId,
    };
  }

  async moderate(): Promise<AiModerationResult> {
    return { safe: true, categories: [], usage: { inputTokens: 12, outputTokens: 2, totalTokens: 14 } };
  }

  async chatWithTools(input: ChatWithToolsInput): Promise<ChatWithToolsOutput> {
    if (this.mode === "tool_calls" && this.toolCalls.length > 0) {
      return {
        text: "I will set that up for you right now.",
        toolCalls: this.toolCalls,
        usage: { inputTokens: 30, outputTokens: 20 },
        modelId: input.modelId,
      };
    }
    return {
      text: "Hello! Tell me about the website you want to build.",
      toolCalls: [],
      usage: { inputTokens: 20, outputTokens: 15 },
      modelId: input.modelId,
    };
  }
}

export type SkillBlock = {
  id: string;
  version: number;
  priority: number;
  scope: string;
  text: string;
};

export type TextAiMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
};

export type ComposedPrompt = {
  messages: TextAiMessage[];
  manifest: {
    task: string;
    skills: Array<{ id: string; version: number }>;
  };
};

export function composePrompt(input: {
  taskId: string;
  taskRules: string;
  taskVersion: string;
  skills?: SkillBlock[];
  brandVoice?: unknown;
  businessFacts?: Array<{ label: string; value: string }>;
  userInput: string;
  existingText?: string;
  maxPromptTokens?: number;
  skillBudgetTokens?: number;
}): ComposedPrompt;
export function composePrompt(input: {
  rules: string;
  skills?: SkillBlock[];
  userText: string;
  contextText?: string;
}): TextAiMessage[];
export function composePrompt(
  input:
    | {
        taskId: string;
        taskRules: string;
        taskVersion: string;
        skills?: SkillBlock[];
        brandVoice?: unknown;
        businessFacts?: Array<{ label: string; value: string }>;
        userInput: string;
        existingText?: string;
        maxPromptTokens?: number;
        skillBudgetTokens?: number;
      }
    | {
        rules: string;
        skills?: SkillBlock[];
        userText: string;
        contextText?: string;
      },
): ComposedPrompt | TextAiMessage[] {
  const sortedSkills = (input.skills ?? [])
    .slice()
    .sort((a, b) => a.priority - b.priority);

  if ("taskRules" in input) {
    const budget = input.skillBudgetTokens ?? 3000;
    let usedTokens = 0;
    const includedSkills: SkillBlock[] = [];
    for (const s of sortedSkills) {
      if (!s.text) continue;
      const tokens = estimateTokens(s.text);
      if (usedTokens + tokens > budget && includedSkills.length > 0) continue;
      includedSkills.push(s);
      usedTokens += tokens;
    }

    const factsText =
      input.businessFacts && input.businessFacts.length > 0
        ? `Business facts:\n${input.businessFacts.map((f) => `- ${f.label}: ${f.value}`).join("\n")}`
        : "";
    const voiceText =
      input.brandVoice && typeof input.brandVoice === "object" && Object.keys(input.brandVoice as Record<string, unknown>).length > 0
        ? `Brand voice: ${JSON.stringify(input.brandVoice)}`
        : "";
    const skillText = includedSkills.map((s) => s.text).join("\n\n");
    const system = [input.taskRules, skillText, voiceText, factsText].filter(Boolean).join("\n\n");
    const user = [
      input.existingText ? `Existing text:\n${input.existingText}` : "",
      input.userInput,
    ]
      .filter(Boolean)
      .join("\n\n");

    return {
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      manifest: {
        task: input.taskVersion,
        skills: includedSkills.map((s) => ({ id: s.id, version: s.version })),
      },
    };
  }

  const skillText = sortedSkills
    .map((s) => s.text)
    .filter(Boolean)
    .join("\n\n");
  const system = [input.rules, skillText].filter(Boolean).join("\n\n");
  const user = [input.contextText, input.userText].filter(Boolean).join("\n\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function isAiModel(value: unknown): value is AiModel {
  return Boolean(value && typeof value === "object" && "modelId" in value && "purposes" in value);
}

export function usageToNeurons(model: AiModel, usage: AiUsage): number;
export function usageToNeurons(usage: AiUsage, model: AiModel): number;
export function usageToNeurons(a: AiModel | AiUsage, b: AiUsage | AiModel): number {
  const model = isAiModel(a) ? a : (b as AiModel);
  const usage = isAiModel(a) ? (b as AiUsage) : a;
  const defaultIn = model.neuronsPerImage != null ? 0 : 250;
  const defaultOut = model.neuronsPerImage != null ? 0 : 750;
  const inNeurons = ((usage.inputTokens ?? 0) / 1_000_000) * (model.neuronsPerMInput ?? defaultIn);
  const outNeurons = ((usage.outputTokens ?? 0) / 1_000_000) * (model.neuronsPerMOutput ?? defaultOut);
  const imgNeurons = (usage.images ?? 0) * (model.neuronsPerImage ?? 100);
  return Math.ceil(inNeurons + outNeurons + imgNeurons);
}

export function buildRequestUsage(input: {
  model: AiModel;
  generationUsage?: AiUsage;
  moderationInputUsage?: AiUsage;
  moderationOutputUsage?: AiUsage;
  guardModel?: AiModel | null;
  creditNeurons?: number;
}): AiUsage & { totalTokens: number; totalNeurons: number } {
  const genIn = Math.max(0, Math.round(input.generationUsage?.inputTokens ?? 0));
  const genOut = Math.max(0, Math.round(input.generationUsage?.outputTokens ?? 0));
  const images = Math.max(0, Math.round(input.generationUsage?.images ?? 0));
  const genProviderNeurons =
    typeof input.generationUsage?.neurons === "number" && Number.isFinite(input.generationUsage.neurons)
      ? Math.max(0, Math.ceil(input.generationUsage.neurons))
      : undefined;
  const generationNeurons =
    genProviderNeurons ??
    usageToNeurons(input.model, {
      inputTokens: genIn,
      outputTokens: genOut,
      images,
    });

  const modModel = input.guardModel ?? null;
  const modParts = [input.moderationInputUsage, input.moderationOutputUsage].filter(
    (part): part is AiUsage => Boolean(part),
  );
  let modIn = 0;
  let modOut = 0;
  let moderationNeurons = 0;
  for (const part of modParts) {
    const pIn = Math.max(0, Math.round(part.inputTokens ?? 0));
    const pOut = Math.max(0, Math.round(part.outputTokens ?? 0));
    modIn += pIn;
    modOut += pOut;
    if (typeof part.neurons === "number" && Number.isFinite(part.neurons)) {
      moderationNeurons += Math.max(0, Math.ceil(part.neurons));
    } else if (modModel) {
      moderationNeurons += usageToNeurons(modModel, { inputTokens: pIn, outputTokens: pOut });
    } else {
      moderationNeurons += Math.ceil((pIn / 1_000_000) * 200 + (pOut / 1_000_000) * 200);
    }
  }

  const totalTokens = genIn + genOut + modIn + modOut;
  const totalNeurons = generationNeurons + moderationNeurons;
  const creditNeurons =
    typeof input.creditNeurons === "number" && input.creditNeurons > 0
      ? Math.round(input.creditNeurons)
      : undefined;
  const tokensEstimated = Boolean(
    input.generationUsage?.tokensEstimated || modParts.some((p) => p.tokensEstimated),
  );

  return {
    inputTokens: genIn,
    outputTokens: genOut,
    totalTokens,
    ...(images > 0 ? { images } : {}),
    neurons: totalNeurons,
    generationNeurons,
    moderationInputTokens: modIn,
    moderationOutputTokens: modOut,
    moderationTotalTokens: modIn + modOut,
    moderationNeurons,
    totalNeurons,
    ...(creditNeurons ? { creditNeurons } : {}),
    ...(tokensEstimated ? { tokensEstimated: true } : {}),
  };
}

export function estimateCredits(input: {
  inputTokens: number;
  expectedOutputTokens: number;
  model: AiModel;
  creditNeurons?: number;
}): number;
export function estimateCredits(
  model: AiModel,
  inputTokens: number,
  expectedOutputTokens: number,
  creditNeurons?: number,
): number;
export function estimateCredits(
  arg1:
    | AiModel
    | {
        inputTokens: number;
        expectedOutputTokens: number;
        model: AiModel;
        creditNeurons?: number;
      },
  inputTokens?: number,
  expectedOutputTokens?: number,
  creditNeurons = 100,
): number {
  if (!isAiModel(arg1)) {
    const neurons = usageToNeurons(arg1.model, {
      inputTokens: arg1.inputTokens,
      outputTokens: arg1.expectedOutputTokens,
    });
    return Math.max(1, Math.ceil(neurons / Math.max(1, arg1.creditNeurons ?? 100)));
  }
  const neurons = usageToNeurons(arg1, {
    inputTokens: inputTokens ?? 0,
    outputTokens: expectedOutputTokens ?? 0,
  });
  return Math.max(1, Math.ceil(neurons / Math.max(1, creditNeurons)));
}

export function actualCredits(
  usage: AiUsage,
  model: AiModel,
  roundUp?: boolean,
  opts?: { creditNeurons?: number; usdPerNeuron?: number },
): number;
export function actualCredits(
  model: AiModel,
  usage: AiUsage,
  creditNeurons?: number,
): number;
export function actualCredits(
  arg1: AiModel | AiUsage,
  arg2: AiUsage | AiModel,
  arg3?: number | boolean,
  arg4?: { creditNeurons?: number; usdPerNeuron?: number },
): number {
  const model = isAiModel(arg1) ? arg1 : (arg2 as AiModel);
  const usage = isAiModel(arg1) ? (arg2 as AiUsage) : arg1;
  const creditNeurons =
    typeof arg3 === "number" ? arg3 : arg4?.creditNeurons ?? 100;
  const neurons = usageToNeurons(model, usage);
  const raw = neurons / Math.max(1, creditNeurons);
  return Math.max(1, arg3 === false ? Math.round(raw) : Math.ceil(raw));
}

export function reserveCredits(estimate: number, cap: number): number;
export function reserveCredits(
  model: AiModel,
  inputTokens: number,
  maxOutputTokens: number,
  creditNeurons?: number,
): number;
export function reserveCredits(
  arg1: number | AiModel,
  arg2: number,
  arg3?: number,
  creditNeurons = 100,
): number {
  if (typeof arg1 === "number") {
    return arg2 > 0 ? Math.min(arg1, arg2) : arg1;
  }
  return estimateCredits(arg1, arg2, arg3 ?? 0, creditNeurons);
}

export type ImageDimensions = {
  width: number;
  height: number;
  steps?: number;
};

export function imageNeurons(input?: AiModel | ImageDimensions | null): number {
  if (!input) return 100;
  if ("neuronsPerImage" in input) return input.neuronsPerImage ?? 100;
  const pixels = Math.max(1, (input.width * input.height) / (1024 * 1024));
  const steps = Math.max(1, (input.steps ?? 4) / 4);
  return Math.ceil(100 * pixels * steps);
}

export function imageCredits(
  input?: AiModel | ImageDimensions | null,
  creditNeurons = 100,
): number {
  return Math.max(1, Math.ceil(imageNeurons(input) / Math.max(1, creditNeurons)));
}

export type FeelId =
  | "elegant"
  | "modern"
  | "techy"
  | "friendly"
  | "bold"
  | "classic"
  | "quirky";

export const REQUIREMENT_KINDS = [
  "palette",
  "color_exact",
  "mode",
  "font_feel",
  "font",
  "hero",
  "hero_layout",
  "header",
  "footer",
  "density",
  "rhythm",
  "corners",
  "button_shape",
  "button_style",
  "image_style",
  "align",
  "section_include",
  "section_exclude",
  "page_include",
  "page_exclude",
  "page_count",
  "tone",
] as const;

export type RequirementKind = (typeof REQUIREMENT_KINDS)[number];

export const FONT_CATALOGUE: Array<{ id: string; feel: FeelId; category: "sans" | "serif" | "mono" }> = [
  { id: "Bricolage Grotesque", feel: "friendly", category: "sans" },
  { id: "Manrope", feel: "modern", category: "sans" },
  { id: "Libre Baskerville", feel: "classic", category: "serif" },
  { id: "DM Serif Display", feel: "elegant", category: "serif" },
  { id: "JetBrains Mono", feel: "techy", category: "mono" },
  { id: "Cormorant Garamond", feel: "elegant", category: "serif" },
  { id: "Fraunces", feel: "quirky", category: "serif" },
  { id: "Oswald", feel: "bold", category: "sans" },
  { id: "Lora", feel: "classic", category: "serif" },
  { id: "Space Grotesk", feel: "modern", category: "sans" },
  { id: "Inter", feel: "modern", category: "sans" },
  { id: "Plus Jakarta Sans", feel: "modern", category: "sans" },
  { id: "Figtree", feel: "friendly", category: "sans" },
];

export type DesignRequirement = {
  id: string;
  kind: RequirementKind;
  target: string;
  value: unknown;
  strength: "must" | "should" | "nice";
  source: "explicit" | "inferred";
  evidence?: string;
};

export type DesignSpec = {
  raw: string;
  requirements: DesignRequirement[];
  palette: {
    primary?: string;
    accent?: string;
    background?: string;
    text?: string;
    soft?: string;
    mode?: "light" | "dark" | "auto";
    mood?: string;
  };
  fonts: {
    feel?: FeelId;
    heading?: { id: string; weight?: number };
    body?: { id: string; weight?: number };
  };
  layout: {
    hero?: string;
    header?: string;
    footer?: string;
    density?: "compact" | "comfortable" | "airy";
    rhythm?: "even" | "alternate" | "tinted" | "bold";
    corners?: "sharp" | "soft" | "round";
    buttonShape?: "square" | "soft" | "round" | "pill";
    buttonStyle?: "solid" | "outline" | "soft";
    imageStyle?: "rounded" | "sharp" | "arch" | "offset" | "circle";
    align?: "left" | "center";
  };
  sections: {
    include: string[];
    exclude: string[];
    order?: string[];
  };
  pages: {
    include: string[];
    exclude: string[];
    count?: number;
  };
  unsupported: Array<{ text: string; nearest?: string }>;
  clarifications: Array<{ requirementId: string; question: string; options: string[] }>;
  confidence: number;
};

export type DesignBrief = {
  businessName: string;
  businessType?: string;
  teamId?: string;
  requestId?: string;
};

export type DesignPlan = {
  planId: string;
  maxPages?: number;
};

export type SectionPlanItem = {
  type: string;
  variant?: string;
  source: "template" | "generated";
};

export type DesignReport = {
  accuracy: number;
  weights?: Record<string, number>;
  unmet?: unknown[];
  unsupported: Array<{ text: string; nearest?: string }>;
};

export type DesignDecision = {
  archetype: string;
  compositionId: string;
  theme: Theme;
  heroLayout: string;
  heroProps: Record<string, unknown>;
  header: { style?: string; sticky?: boolean };
  footer?: { style?: string };
  sectionPlan: SectionPlanItem[];
  pages: string[];
  report: DesignReport;
};

export type DesignLook = {
  id: string;
  key: string;
  name: string;
  description: string;
  decision: DesignDecision;
};

export type CurrentLook = {
  theme: Theme;
  heroLayout: string;
  heroProps?: Record<string, unknown>;
  header?: { style?: string; sticky?: boolean };
  footer?: { style?: string };
  sectionPlan: SectionPlanItem[];
  pages: string[];
};

export type RestyleChange = {
  area: string;
  from: string;
  to: string;
};

export type RestyleResult = {
  contentChanged: false;
  decision: DesignDecision;
  changes: RestyleChange[];
};

export function parseDesign(raw: string): DesignSpec {
  const lower = raw.toLowerCase();
  const requirements: DesignRequirement[] = [];
  const palette: DesignSpec["palette"] = {};
  const fonts: DesignSpec["fonts"] = {};
  const layout: DesignSpec["layout"] = {};
  const include: string[] = [];
  const exclude: string[] = [];

  const hexes = raw.match(/#[0-9a-fA-F]{6}/g) ?? [];
  if (hexes[0]) {
    palette.primary = hexes[0];
    requirements.push({
      id: "req-primary",
      kind: "palette",
      target: "primary",
      value: hexes[0],
      strength: "must",
      source: "explicit",
    });
  }
  if (hexes[1]) {
    palette.accent = hexes[1];
  }

  if (/\bdark\b/.test(lower)) {
    palette.mode = "dark";
    requirements.push({
      id: "req-mode-dark",
      kind: "mode",
      target: "mode",
      value: "dark",
      strength: "must",
      source: "explicit",
    });
  } else if (/\blight\b/.test(lower)) {
    palette.mode = "light";
    requirements.push({
      id: "req-mode-light",
      kind: "mode",
      target: "mode",
      value: "light",
      strength: "must",
      source: "explicit",
    });
  }

  for (const hero of [
    "split",
    "centered",
    "fullbleed",
    "editorial",
    "minimal",
    "product-shot",
    "arch",
    "offset-frame",
    "card-over-image",
    "diagonal",
  ]) {
    if (lower.includes(hero)) {
      layout.hero = hero;
      requirements.push({
        id: `req-hero-${hero}`,
        kind: "hero",
        target: "hero",
        value: hero,
        strength: "must",
        source: "explicit",
      });
      break;
    }
  }

  if (/\bairy\b/.test(lower)) layout.density = "airy";
  else if (/\bcompact\b/.test(lower)) layout.density = "compact";
  else if (/\bcomfortable\b/.test(lower)) layout.density = "comfortable";

  if (/\bround\b|\brounded\b/.test(lower)) layout.corners = "round";
  else if (/\bsharp\b/.test(lower)) layout.corners = "sharp";
  else if (/\bsoft\b/.test(lower)) layout.corners = "soft";

  for (const feel of ["elegant", "modern", "techy", "friendly", "bold", "classic", "quirky"] as const) {
    if (lower.includes(feel)) {
      fonts.feel = feel;
      break;
    }
  }

  for (const sec of ["pricing", "faq", "testimonials", "team", "gallery", "services", "contact"]) {
    if (lower.includes(`include ${sec}`)) include.push(sec);
    if (lower.includes(`leave out ${sec}`) || lower.includes(`without ${sec}`)) exclude.push(sec);
  }

  return {
    raw,
    requirements,
    palette,
    fonts,
    layout,
    sections: { include, exclude },
    pages: { include: [], exclude: [] },
    unsupported: [],
    clarifications: [],
    confidence: requirements.length > 0 ? 0.85 : 0.6,
  };
}

function archetypeForBrief(brief: DesignBrief): string {
  const kind = (brief.businessType ?? "").toLowerCase();
  if (kind.includes("restaurant") || kind.includes("cafe") || kind.includes("bakery")) return "restaurant";
  if (kind.includes("software") || kind.includes("saas") || kind.includes("tech")) return "software-company";
  if (kind.includes("law") || kind.includes("legal")) return "law-firm";
  if (kind.includes("salon") || kind.includes("beauty")) return "salon-beauty";
  if (kind.includes("shop") || kind.includes("retail")) return "boutique-shop";
  if (kind.includes("church") || kind.includes("community")) return "community-church";
  if (kind.includes("creative") || kind.includes("design") || kind.includes("agency")) return "creative-studio";
  if (kind.includes("portfolio") || kind.includes("developer")) return "developer-portfolio";
  if (kind.includes("plumb") || kind.includes("service") || kind.includes("repair")) return "home-services";
  return "starter";
}

export function designLooks(
  spec: DesignSpec,
  brief: DesignBrief,
  plan: DesignPlan,
  options?: { count?: number },
): DesignLook[] {
  const count = options?.count ?? 3;
  const archetype = archetypeForBrief(brief);
  const maxPages = plan.maxPages ?? 5;
  const allPages = ["home", "about", "services", "pricing", "contact"].slice(0, Math.max(1, maxPages));
  const sectionPlan: SectionPlanItem[] = [
    { type: "hero", source: "template" },
    { type: "features", source: "template" },
    ...spec.sections.include.map((s) => ({ type: s.toLowerCase(), source: "template" as const })),
    { type: "cta", source: "template" },
  ];

  const baseColors = resolveThemeColors();
  const variants = [
    {
      key: "clean",
      name: "Clean & Balanced",
      description: "Clear hierarchy with inviting spacing.",
      hero: spec.layout.hero ?? "split",
      header: spec.layout.header ?? "classic",
      font: spec.fonts.heading?.id ?? "Bricolage Grotesque",
      palette: { ...baseColors, primary: spec.palette.primary ?? baseColors.primary, accent: spec.palette.accent ?? baseColors.accent },
    },
    {
      key: "editorial",
      name: "Editorial Contrast",
      description: "Expressive headings and structured bands.",
      hero: spec.layout.hero ?? "centered",
      header: spec.layout.header ?? "centered",
      font: spec.fonts.heading?.id ?? "Fraunces",
      palette: { ...baseColors, primary: spec.palette.primary ?? "#0369A1", accent: spec.palette.accent ?? "#F59E0B" },
    },
    {
      key: "bold",
      name: "Bold Showcase",
      description: "High-impact visual framing for visitors.",
      hero: spec.layout.hero ?? "editorial",
      header: spec.layout.header ?? "split",
      font: spec.fonts.heading?.id ?? "Space Grotesk",
      palette: { ...baseColors, primary: spec.palette.primary ?? "#9D174D", accent: spec.palette.accent ?? "#F43F5E" },
    },
  ];

  return variants.slice(0, count).map((v, idx) => ({
    id: `look_${v.key}`,
    key: v.key,
    name: v.name,
    description: v.description,
    decision: {
      archetype,
      compositionId: `${archetype}-${idx + 1}`,
      theme: {
        corners: spec.layout.corners ?? "soft",
        density: spec.layout.density ?? "comfortable",
        colorMode: spec.palette.mode === "dark" ? "dark" : "light",
        colors: {
          primary: v.palette.primary,
          accent: v.palette.accent,
          background: spec.palette.background ?? v.palette.background,
          text: spec.palette.text ?? v.palette.text,
          soft: spec.palette.soft ?? v.palette.soft,
        },
        fonts: {
          heading: { id: v.font, weight: 700 },
          body: { id: spec.fonts.body?.id ?? "Inter", weight: 400 },
          scale: "comfortable",
        },
        header: { style: v.header },
        design: {
          rhythm: spec.layout.rhythm ?? "even",
          buttonShape: spec.layout.buttonShape ?? "soft",
        },
      },
      heroLayout: v.hero,
      heroProps: { layout: v.hero },
      header: { style: v.header },
      sectionPlan,
      pages: allPages,
      report: {
        accuracy: 92,
        unsupported: spec.unsupported,
      },
    },
  }));
}

export function restyleDesign(
  instruction: string,
  current: CurrentLook,
  _context: Record<string, unknown> = {},
  _prefs: Record<string, unknown> = {},
  interpretedSpec?: DesignSpec,
): RestyleResult {
  const spec = interpretedSpec ?? parseDesign(instruction);
  const nextTheme: Theme = structuredClone(current.theme);
  const changes: RestyleChange[] = [];

  if (spec.palette.primary && spec.palette.primary !== current.theme.colors?.primary) {
    nextTheme.colors = { ...nextTheme.colors, primary: spec.palette.primary };
    changes.push({
      area: "colour primary",
      from: current.theme.colors?.primary ?? "",
      to: spec.palette.primary,
    });
  }
  if (spec.palette.accent && spec.palette.accent !== current.theme.colors?.accent) {
    nextTheme.colors = { ...nextTheme.colors, accent: spec.palette.accent };
    changes.push({
      area: "colour accent",
      from: current.theme.colors?.accent ?? "",
      to: spec.palette.accent,
    });
  }
  if (spec.layout.density && spec.layout.density !== current.theme.density) {
    nextTheme.density = spec.layout.density;
    changes.push({
      area: "spacing density",
      from: current.theme.density ?? "",
      to: spec.layout.density,
    });
  }
  if (spec.layout.corners && spec.layout.corners !== current.theme.corners) {
    nextTheme.corners = spec.layout.corners;
    changes.push({
      area: "corners",
      from: current.theme.corners ?? "",
      to: spec.layout.corners,
    });
  }
  if (spec.fonts.heading?.id && spec.fonts.heading.id !== current.theme.fonts?.heading?.id) {
    nextTheme.fonts = {
      ...nextTheme.fonts,
      heading: { id: spec.fonts.heading.id, weight: 700 },
      body: nextTheme.fonts?.body ?? { id: "Inter", weight: 400 },
    };
    changes.push({
      area: "heading font",
      from: current.theme.fonts?.heading?.id ?? "",
      to: spec.fonts.heading.id,
    });
  }

  return {
    contentChanged: false,
    changes,
    decision: {
      archetype: "starter",
      compositionId: "starter-1",
      theme: nextTheme,
      heroLayout: spec.layout.hero ?? current.heroLayout,
      heroProps: current.heroProps ?? { layout: current.heroLayout },
      header: nextTheme.header ?? { style: "classic" },
      sectionPlan: current.sectionPlan,
      pages: current.pages,
      report: {
        accuracy: 95,
        unsupported: spec.unsupported,
      },
    },
  };
}
