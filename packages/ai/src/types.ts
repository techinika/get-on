export type AiPurpose =
  | "brief"
  | "writer"
  | "judge"
  | "vision"
  | "image"
  | "guard";

export type AiTaskId =
  | "moderate"
  | "site.generate"
  | "template.fill"
  | "template.generate"
  | "page.generate"
  | "section.generate"
  | "text.write"
  | "text.improve"
  | "list.expand"
  | "seo.write"
  | "alt.describe"
  | "design.suggest"
  | "profile.write"
  | "tips.fix"
  | "image.generate"
  | "repair";

export type AiRole = "system" | "user" | "assistant";

export type AiMessage = {
  role: AiRole;
  content: string;
};

export type AiUsage = {
  inputTokens?: number;
  outputTokens?: number;
  neurons?: number;
  images?: number;
};

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

export type AiResult<T = string> = {
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
  raw?: unknown;
};

export type AiRefusal = {
  refusal: {
    reason: string;
  };
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
  jsonSchema?: unknown;
  expectedValue?: unknown;
};

export type DescribeImageInput = {
  modelId: string;
  imageBase64: string;
  mime: string;
  prompt: string;
  maxTokens?: number;
  timeoutMs?: number;
  metadata?: Record<string, string>;
};

export type GenerateImageInput = {
  modelId: string;
  prompt: string;
  width: number;
  height: number;
  steps: number;
  timeoutMs?: number;
  metadata?: Record<string, string>;
};

export type ModerateInput = {
  modelId: string;
  text: string;
  timeoutMs?: number;
  metadata?: Record<string, string>;
};

export type AiProvider = {
  readonly id: string;
  generateText(input: GenerateTextInput): Promise<AiResult<string>>;
  generateStructured(
    input: GenerateStructuredInput,
  ): Promise<AiResult<unknown>>;
  describeImage(input: DescribeImageInput): Promise<AiResult<string>>;
  generateImage(input: GenerateImageInput): Promise<AiImageResult>;
  moderate(input: ModerateInput): Promise<AiModerationResult>;
};

export type CreditSettings = {
  creditNeurons: number;
  usdPerNeuron: number;
};
