import { isAiError, type AiErrorCode } from "./errors";
import type { AiMessage, AiProvider, AiUsage } from "./types";

export type EvalExpectation = {
  minChars?: number;
  maxChars?: number;
  includes?: string[];
  excludes?: string[];
  requiredKeys?: string[];
  check?: (value: unknown) => string[];
};

export type EvalCase = {
  id: string;
  taskId: string;
  kind: "text" | "structured";
  modelId: string;
  messages: AiMessage[];
  schemaName?: string;
  jsonSchema?: unknown;
  maxTokens?: number;
  temperature?: number;
  expected?: EvalExpectation;
};

export type EvalResult = {
  caseId: string;
  taskId: string;
  ok: boolean;
  score: number;
  issues: string[];
  latencyMs: number;
  usage: AiUsage;
  error?: AiErrorCode;
  value?: unknown;
};

export type EvalSummary = {
  total: number;
  passed: number;
  failed: number;
  score: number;
  hardFails: string[];
  usage: Required<Pick<AiUsage, "inputTokens" | "outputTokens">>;
  results: EvalResult[];
};

function emptyUsage(): Required<Pick<AiUsage, "inputTokens" | "outputTokens">> {
  return { inputTokens: 0, outputTokens: 0 };
}

function addUsage(
  total: Required<Pick<AiUsage, "inputTokens" | "outputTokens">>,
  usage: AiUsage,
): void {
  total.inputTokens += usage.inputTokens ?? 0;
  total.outputTokens += usage.outputTokens ?? 0;
}

function checkValue(value: unknown, expected?: EvalExpectation): string[] {
  if (!expected) return [];
  const issues: string[] = [];
  const text =
    typeof value === "string" ? value : JSON.stringify(value ?? null);

  if (typeof expected.minChars === "number" && text.length < expected.minChars) {
    issues.push(`Too short: ${text.length} < ${expected.minChars}`);
  }
  if (typeof expected.maxChars === "number" && text.length > expected.maxChars) {
    issues.push(`Too long: ${text.length} > ${expected.maxChars}`);
  }
  for (const phrase of expected.includes ?? []) {
    if (!text.toLowerCase().includes(phrase.toLowerCase())) {
      issues.push(`Missing: ${phrase}`);
    }
  }
  for (const phrase of expected.excludes ?? []) {
    if (text.toLowerCase().includes(phrase.toLowerCase())) {
      issues.push(`Unexpected: ${phrase}`);
    }
  }
  if (expected.requiredKeys?.length) {
    const record =
      value && typeof value === "object"
        ? (value as Record<string, unknown>)
        : {};
    for (const key of expected.requiredKeys) {
      if (!(key in record)) issues.push(`Missing key: ${key}`);
    }
  }
  if (expected.check) issues.push(...expected.check(value));
  return issues;
}

export async function runEvalCase(
  provider: AiProvider,
  evalCase: EvalCase,
): Promise<EvalResult> {
  const startedAt = Date.now();
  try {
    const result =
      evalCase.kind === "structured"
        ? await provider.generateStructured({
            modelId: evalCase.modelId,
            messages: evalCase.messages,
            schemaName: evalCase.schemaName ?? evalCase.taskId,
            jsonSchema: evalCase.jsonSchema,
            maxTokens: evalCase.maxTokens,
            temperature: evalCase.temperature,
          })
        : await provider.generateText({
            modelId: evalCase.modelId,
            messages: evalCase.messages,
            maxTokens: evalCase.maxTokens,
            temperature: evalCase.temperature,
          });

    const value =
      evalCase.kind === "structured" ? result.value : (result.text ?? result.value);
    const issues = checkValue(value, evalCase.expected);
    return {
      caseId: evalCase.id,
      taskId: evalCase.taskId,
      ok: issues.length === 0,
      score: issues.length === 0 ? 1 : 0,
      issues,
      latencyMs: Date.now() - startedAt,
      usage: result.usage,
      value,
    };
  } catch (error) {
    const code: AiErrorCode = isAiError(error)
      ? error.code
      : "AI_PROVIDER_ERROR";
    return {
      caseId: evalCase.id,
      taskId: evalCase.taskId,
      ok: false,
      score: 0,
      issues: [`Provider error: ${code}`],
      latencyMs: Date.now() - startedAt,
      usage: {},
      error: code,
    };
  }
}

export async function runEvalSuite(
  provider: AiProvider,
  cases: EvalCase[],
): Promise<EvalSummary> {
  const results: EvalResult[] = [];
  const usage = emptyUsage();

  for (const evalCase of cases) {
    const result = await runEvalCase(provider, evalCase);
    results.push(result);
    addUsage(usage, result.usage);
  }

  const passed = results.filter((result) => result.ok).length;
  const failed = results.length - passed;
  return {
    total: results.length,
    passed,
    failed,
    score: results.length === 0 ? 0 : passed / results.length,
    hardFails: results
      .filter((result) => !result.ok)
      .map((result) => result.caseId),
    usage,
    results,
  };
}
