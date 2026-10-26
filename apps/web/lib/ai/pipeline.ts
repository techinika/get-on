import { createHash, randomUUID } from "node:crypto";
import {
  AI_ERROR_CODES,
  AI_TASKS,
  AiError,
  actualCredits,
  aiErrorMessage,
  composePrompt,
  estimateCredits,
  estimateTokens,
  isAiError,
  modelFor,
  reserveCredits,
  usageToNeurons,
  type AiErrorCode,
  type AiMessage,
  type AiTaskId,
  type AiUsage,
  type SkillBlock,
} from "@get-on/ai";
import { PLAN_BY_ID, type PlanId } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { aiConfig } from "./config";
import { sanitiseText, scanOutput, type AiFlags } from "./guards";
import { createAiProvider } from "./provider-factory";
import {
  ensureFreeGrant,
  loadAiModels,
  loadAiSettings,
  loadBrandContext,
  loadDailyUsage,
  loadPlatformUsage,
  loadSkills,
} from "./settings";
import {
  structuredTask,
  textTask,
  visionTask,
  type TaskConfig,
} from "./tasks";

export type Admin = ReturnType<typeof createAdminClient>;

export type RunTextTaskInput = {
  taskId: AiTaskId;
  teamId: string;
  userId: string;
  projectId?: string | null;
  userInput: string;
  existingText?: string;
  idempotencyKey?: string;
  image?: { base64: string; mime: string };
};

export type RunTextTaskSuccess = {
  ok: true;
  requestId: string;
  text: string;
  credits: number;
  flags: AiFlags;
  status: "succeeded" | "partial";
  data?: unknown;
};

export type RunTextTaskFailure = {
  ok: false;
  requestId?: string;
  code: AiErrorCode;
  message: string;
  details?: Record<string, string | number>;
};

export type RunTextTaskResult = RunTextTaskSuccess | RunTextTaskFailure;

export function numeric(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function failure(error: unknown, requestId?: string): RunTextTaskFailure {
  const ai = isAiError(error)
    ? error
    : new AiError("AI_PROVIDER_ERROR", { cause: error });
  return {
    ok: false,
    requestId,
    code: ai.code,
    message: aiErrorMessage(ai.code, ai.details),
    details: ai.details,
  };
}

export function mapDbError(error: { message?: string } | null): AiError {
  const message = error?.message ?? "";
  for (const code of AI_ERROR_CODES) {
    if (!message.includes(code)) continue;
    const need = Number(message.match(/need (\d+)/)?.[1]);
    const available = Number(message.match(/available (\d+)/)?.[1]);
    return new AiError(code, {
      cause: error,
      details:
        Number.isFinite(need) && Number.isFinite(available)
          ? { n: available, m: need }
          : undefined,
    });
  }
  return new AiError("AI_PROVIDER_ERROR", { cause: error });
}

export function gatewayMetadata(
  teamId: string,
  taskId: AiTaskId,
  requestId: string,
): Record<string, string> {
  return {
    team: createHash("sha256").update(teamId).digest("hex").slice(0, 16),
    task: taskId,
    request: requestId,
  };
}

export async function loadAccess(
  admin: Admin,
  teamId: string,
  userId: string,
): Promise<{ planId: PlanId; status: string }> {
  const { data: member } = await admin
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (
    !member ||
    !["owner", "admin", "editor"].includes(String(member.role))
  ) {
    throw new AiError("AI_PROVIDER_ERROR", {
      details: { reason: "not_allowed" },
    });
  }

  const { data, error } = await admin.rpc("billing_resolve_team", {
    p_team: teamId,
  });
  if (error) {
    throw new AiError("AI_PROVIDER_ERROR", {
      details: { reason: "plan_lookup_failed" },
    });
  }
  const access = (data ?? {}) as { plan_id?: string; status?: string };
  return {
    planId: ((access.plan_id as PlanId) ?? "free") satisfies PlanId,
    status: access.status ?? "free",
  };
}

export async function verifyProject(
  admin: Admin,
  teamId: string,
  projectId: string | null | undefined,
): Promise<void> {
  if (!projectId) return;
  const { data } = await admin
    .from("projects")
    .select("team_id, deleted_at")
    .eq("id", projectId)
    .maybeSingle();
  if (!data || data.team_id !== teamId || data.deleted_at) {
    throw new AiError("AI_PROVIDER_ERROR", {
      details: { reason: "project_not_found" },
    });
  }
}

export async function checkRateLimits(
  admin: Admin,
  teamId: string,
  userId: string,
): Promise<void> {
  const now = Date.now();
  const minuteAgo = new Date(now - 60 * 1000).toISOString();
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();

  const [{ count: minuteCount }, { count: hourCount }] = await Promise.all([
    admin
      .from("ai_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", minuteAgo),
    admin
      .from("ai_requests")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .gte("created_at", hourAgo),
  ]);

  if ((minuteCount ?? 0) >= 6 || (hourCount ?? 0) >= 60) {
    throw new AiError("AI_RATE_LIMIT");
  }
}

export async function updateRequest(
  admin: Admin,
  requestId: string,
  values: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin
    .from("ai_requests")
    .update(values)
    .eq("id", requestId);
  if (error) {
    console.error("[ai] could not update request", requestId, error);
  }
}

export async function releaseRequest(admin: Admin, requestId: string): Promise<void> {
  const { error } = await admin.rpc("ai_release", { p_request: requestId });
  if (error) {
    console.error("[ai] could not release request", requestId, error);
  }
}

export async function storePayload(
  admin: Admin,
  requestId: string,
  input: Record<string, unknown>,
  output: Record<string, unknown>,
  retentionDays: number,
): Promise<void> {
  const expiresAt = new Date(
    Date.now() + retentionDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { error } = await admin.from("ai_payloads").upsert({
    request_id: requestId,
    input,
    output,
    expires_at: expiresAt,
  });
  if (error) {
    console.error("[ai] could not store payload", requestId, error);
  }
}

export async function recordUsage(
  admin: Admin,
  teamId: string,
  credits: number,
  neurons: number,
): Promise<void> {
  const { error } = await admin.rpc("ai_record_usage", {
    p_team: teamId,
    p_credits: credits,
    p_neurons: Math.round(neurons),
    p_requests: 1,
  });
  if (error) {
    console.error("[ai] could not record usage", teamId, error);
  }
}

export async function moderateText(
  provider: ReturnType<typeof createAiProvider>,
  modelId: string | undefined,
  text: string,
  timeoutMs: number,
  metadata: Record<string, string>,
): Promise<{ safe: boolean; categories: string[] }> {
  if (!modelId) {
    throw new AiError("AI_PROVIDER_ERROR", {
      details: { reason: "guard_model_missing" },
    });
  }
  const result = await provider.moderate({
    modelId,
    text,
    timeoutMs,
    metadata,
  });
  return { safe: result.safe, categories: result.categories };
}

function parseJsonValue(value: string): unknown {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(match?.[1] ?? trimmed);
}

function sanitiseDeep(value: unknown): unknown {
  if (typeof value === "string") return sanitiseText(value, 20000);
  if (Array.isArray(value)) return value.map(sanitiseDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        sanitiseDeep(entry),
      ]),
    );
  }
  return value;
}

function addUsage(a: AiUsage, b: AiUsage): AiUsage {
  return {
    inputTokens: (a.inputTokens ?? 0) + (b.inputTokens ?? 0) || undefined,
    outputTokens: (a.outputTokens ?? 0) + (b.outputTokens ?? 0) || undefined,
    images: (a.images ?? 0) + (b.images ?? 0) || undefined,
    neurons: (a.neurons ?? 0) + (b.neurons ?? 0) || undefined,
  };
}

export async function runTextTask(
  input: RunTextTaskInput,
): Promise<RunTextTaskResult> {
  return runTextTaskWithConfig(textTask(input.taskId), input);
}

async function runTextTaskWithConfig(
  task: TaskConfig | null,
  input: RunTextTaskInput,
): Promise<RunTextTaskResult> {
  const config = aiConfig();
  const admin = createAdminClient();
  let requestId: string | undefined;

  try {
    if (!task) {
      throw new AiError("AI_PROVIDER_ERROR", {
        details: { reason: "unsupported_task" },
      });
    }
    if (!config.enabled) throw new AiError("AI_DISABLED");

    const settings = await loadAiSettings(admin);
    if (!settings.enabled) throw new AiError("AI_DISABLED");

    const { planId, status: accessStatus } = await loadAccess(admin, input.teamId, input.userId);
    if (accessStatus === "lapsed") {
      throw new AiError("AI_PLAN_INACTIVE");
    }
    await verifyProject(admin, input.teamId, input.projectId);
    await checkRateLimits(admin, input.teamId, input.userId);

    const [daily, platform] = await Promise.all([
      loadDailyUsage(admin, input.teamId),
      loadPlatformUsage(admin),
    ]);
    const plan = PLAN_BY_ID[planId];
    if (daily.requests >= plan.aiDailyActions) {
      throw new AiError("AI_DAILY_ACTIONS");
    }
    if (
      settings.dailyCapCredits > 0 &&
      platform.credits >= settings.dailyCapCredits
    ) {
      throw new AiError("AI_DAILY_CAP");
    }

    if (planId === "free") {
      await ensureFreeGrant(
        admin,
        input.teamId,
        input.userId,
        settings.freeGrantCredits,
      );
    }

    const models = await loadAiModels(admin);
    const model = modelFor(task.purpose, task.requirement, models);
    if (!model) {
      throw new AiError("AI_PROVIDER_ERROR", {
        details: { reason: "no_model" },
      });
    }
    const guard = modelFor("guard", {}, models);

    const maxOutputTokens = Math.min(
      task.maxOutputTokens,
      model.maxOutputTokens > 0 ? model.maxOutputTokens : task.maxOutputTokens,
    );
    const maxPromptTokens = Math.max(
      256,
      model.contextTokens - maxOutputTokens - 512,
    );
    const brand = await loadBrandContext(admin, input.projectId ?? null);
    const skills: SkillBlock[] = await loadSkills(
      admin,
      task.taskId,
      brand,
      settings.defaultLanguage,
    );
    const composed = composePrompt({
      taskId: task.taskId,
      taskRules: task.rules,
      taskVersion: task.version,
      skills,
      brandVoice: brand.brandVoice,
      businessFacts: brand.businessFacts,
      userInput: input.userInput,
      existingText: input.existingText,
      maxPromptTokens,
      skillBudgetTokens: 3000,
    });

    const promptChars = composed.messages.reduce(
      (total, message) => total + message.content.length,
      0,
    );
    if (promptChars > settings.maxPromptChars) {
      throw new AiError("AI_TOO_LONG");
    }

    const promptText = composed.messages
      .map((message) => message.content)
      .join("\n");
    const inputTokens = estimateTokens(promptText);
    const estimateInputTokens = task.kind === "vision" ? inputTokens + 1000 : inputTokens;
    const estimate = estimateCredits({
      inputTokens: estimateInputTokens,
      expectedOutputTokens: task.expectedOutputTokens,
      model,
      creditNeurons: settings.creditNeurons,
    });
    const cap = AI_TASKS[task.taskId].capCredits;
    const reserved = reserveCredits(estimate, cap);
    const idempotencyKey = input.idempotencyKey ?? randomUUID();
    const inputHash = createHash("sha256")
      .update(`${task.taskId}\n${input.userInput}\n${input.existingText ?? ""}`)
      .digest("hex");

    const { data: created, error: createError } = await admin
      .from("ai_requests")
      .insert({
        team_id: input.teamId,
        project_id: input.projectId ?? null,
        user_id: input.userId,
        task: task.taskId,
        feature: task.feature,
        status: "queued",
        source: "platform",
        estimate_credits: estimate,
        cap_credits: cap,
        steps: [
          { name: "moderate" },
          { name: "reserve" },
          { name: "generate" },
          { name: "review" },
          { name: "settle" },
        ],
        model_ids: [model.id],
        prompt_version: composed.manifest.task,
        skill_versions: composed.manifest.skills,
        input_hash: inputHash,
        idempotency_key: idempotencyKey,
      })
      .select("id")
      .single();
    if (createError || !created) {
      if (createError?.code === "23505") {
        throw new AiError("AI_BUSY");
      }
      throw mapDbError(createError);
    }
    requestId = String(created.id);

    const provider = createAiProvider({
      ...config,
      gatewayId: settings.gatewayId ?? config.gatewayId,
    });
    const metadata = gatewayMetadata(
      input.teamId,
      task.taskId,
      requestId,
    );

    if (settings.moderationEnabled) {
      const moderation = await moderateText(
        provider,
        guard?.modelId,
        `${task.rules}\n\n${input.userInput}\n\n${input.existingText ?? ""}`,
        AI_TASKS.moderate.timeoutMs,
        metadata,
      );
      await updateRequest(admin, requestId, {
        moderation,
        ...(moderation.safe
          ? {}
          : { status: "refused", finished_at: new Date().toISOString() }),
      });
      if (!moderation.safe) {
        return failure(new AiError("AI_REFUSED"), requestId);
      }
    }

    const { error: reserveError } = await admin.rpc("ai_reserve", {
      p_team: input.teamId,
      p_user: input.userId,
      p_request: requestId,
      p_amount: reserved,
      p_idempotency: idempotencyKey,
    });
    if (reserveError) {
      const mapped = mapDbError(reserveError);
      await updateRequest(admin, requestId, {
        status: "failed",
        error_code: mapped.code,
        finished_at: new Date().toISOString(),
      });
      return failure(mapped, requestId);
    }

    const startedAt = Date.now();
    await updateRequest(admin, requestId, {
      status: "running",
      started_at: new Date(startedAt).toISOString(),
    });

    let outputText: string;
    let outputData: unknown;
    let providerUsage: AiUsage;
    try {
      if (task.kind === "text") {
        const providerResult = await provider.generateText({
          modelId: model.modelId,
          messages: composed.messages,
          maxTokens: maxOutputTokens,
          temperature: task.temperature,
          timeoutMs: AI_TASKS[task.taskId].timeoutMs,
          metadata,
        });
        outputText = sanitiseText(providerResult.value, task.maxChars);
        outputData = undefined;
        providerUsage = providerResult.usage;
      } else if (task.kind === "vision") {
        if (!input.image) {
          throw new AiError("AI_PROVIDER_ERROR", {
            details: { reason: "image_required" },
          });
        }
        const providerResult = await provider.describeImage({
          modelId: model.modelId,
          imageBase64: input.image.base64,
          mime: input.image.mime,
          prompt: composed.messages
            .map((message) => message.content)
            .join("\n\n"),
          maxTokens: maxOutputTokens,
          timeoutMs: AI_TASKS[task.taskId].timeoutMs,
          metadata,
        });
        outputText = sanitiseText(providerResult.value, task.maxChars);
        outputData = undefined;
        providerUsage = providerResult.usage;
      } else {
        const callStructured = async (messages: AiMessage[]) => {
          if (model.supportsJson) {
            const result = await provider.generateStructured({
              modelId: model.modelId,
              messages,
              maxTokens: maxOutputTokens,
              temperature: task.temperature,
              timeoutMs: AI_TASKS[task.taskId].timeoutMs,
              metadata,
              jsonSchema: task.jsonSchema,
              schemaName: task.schemaName,
            });
            return { value: result.value, usage: result.usage };
          }
          const result = await provider.generateText({
            modelId: model.modelId,
            messages,
            maxTokens: maxOutputTokens,
            temperature: task.temperature,
            timeoutMs: AI_TASKS[task.taskId].timeoutMs,
            metadata,
          });
          return { value: parseJsonValue(result.value), usage: result.usage };
        };

        let first: { value: unknown; usage: AiUsage };
        try {
          first = await callStructured(composed.messages);
        } catch (error) {
          if (!(isAiError(error) && error.code === "AI_BAD_RESULT")) {
            throw error;
          }
          first = { value: null, usage: {} };
        }

        providerUsage = first.usage;
        let validation = task.validate(sanitiseDeep(first.value));
        if (!validation.ok) {
          const repair = await callStructured([
            ...composed.messages,
            {
              role: "user",
              content: `The previous answer did not fit the required format. Fix these problems and return only the corrected JSON: ${validation.issues.join("; ")}`,
            },
          ]);
          providerUsage = addUsage(providerUsage, repair.usage);
          validation = task.validate(sanitiseDeep(repair.value));
          if (!validation.ok) {
            throw new AiError("AI_BAD_RESULT", {
              details: { reason: "repair_failed" },
            });
          }
        }
        outputData = validation.data;
        outputText = JSON.stringify(outputData);
      }
    } catch (error) {
      const mapped = isAiError(error) ? error : new AiError("AI_PROVIDER_ERROR", { cause: error });
      await releaseRequest(admin, requestId);
      await updateRequest(admin, requestId, {
        status: mapped.code === "AI_REFUSED" ? "refused" : "failed",
        error_code: mapped.code,
        latency_ms: Date.now() - startedAt,
        finished_at: new Date().toISOString(),
      });
      return failure(mapped, requestId);
    }

    const flags = scanOutput(outputText);
    if (flags.empty || flags.injection) {
      const mapped = new AiError("AI_BAD_RESULT");
      await releaseRequest(admin, requestId);
      await updateRequest(admin, requestId, {
        status: "failed",
        error_code: mapped.code,
        flags,
        latency_ms: Date.now() - startedAt,
        finished_at: new Date().toISOString(),
      });
      return failure(mapped, requestId);
    }

    if (task.moderateOutput && settings.moderationEnabled) {
      try {
        const outputModeration = await moderateText(
          provider,
          guard?.modelId,
          outputText,
          AI_TASKS.moderate.timeoutMs,
          metadata,
        );
        if (!outputModeration.safe) {
          await releaseRequest(admin, requestId);
          await updateRequest(admin, requestId, {
            status: "refused",
            moderation: outputModeration,
            flags,
            latency_ms: Date.now() - startedAt,
            finished_at: new Date().toISOString(),
          });
          return failure(new AiError("AI_REFUSED"), requestId);
        }
      } catch (error) {
        const mapped = isAiError(error)
          ? error
          : new AiError("AI_PROVIDER_ERROR", { cause: error });
        await releaseRequest(admin, requestId);
        await updateRequest(admin, requestId, {
          status: "failed",
          error_code: mapped.code,
          flags,
          latency_ms: Date.now() - startedAt,
          finished_at: new Date().toISOString(),
        });
        return failure(mapped, requestId);
      }
    }

    const usage: AiUsage = {
      inputTokens: providerUsage.inputTokens ?? estimateInputTokens,
      outputTokens: providerUsage.outputTokens ?? estimateTokens(outputText),
    };
    const neurons = usageToNeurons(usage, model);
    const credits =
      reserved > 0
        ? actualCredits(usage, model, true, {
            creditNeurons: settings.creditNeurons,
            usdPerNeuron: config.usdPerNeuron,
          })
        : 0;

    let charged = 0;
    if (reserved > 0) {
      const { data: settled, error: settleError } = await admin.rpc(
        "ai_settle",
        { p_request: requestId, p_actual: credits },
      );
      if (settleError) {
        const mapped = mapDbError(settleError);
        await releaseRequest(admin, requestId);
        await updateRequest(admin, requestId, {
          status: "failed",
          error_code: mapped.code,
          flags,
          latency_ms: Date.now() - startedAt,
          finished_at: new Date().toISOString(),
        });
        return failure(mapped, requestId);
      }
      charged = numeric(settled, credits);
    }

    const status =
      flags.factClaims.length > 0 || flags.sampleClaims.length > 0
        ? "partial"
        : "succeeded";
    await updateRequest(admin, requestId, {
      status,
      charged_credits: charged,
      usage,
      flags,
      latency_ms: Date.now() - startedAt,
      finished_at: new Date().toISOString(),
    });
    await storePayload(
      admin,
      requestId,
      {
        userInput: input.userInput,
        existingText: input.existingText ?? null,
        brandVoice: brand.brandVoice,
        businessFacts: brand.businessFacts,
        skills: composed.manifest.skills,
        promptVersion: composed.manifest.task,
      },
      task.kind === "structured" ? { data: outputData } : { text: outputText },
      settings.payloadRetentionDays,
    );
    await recordUsage(admin, input.teamId, charged, neurons);

    return {
      ok: true,
      requestId,
      text: outputText,
      data: outputData,
      credits: charged,
      flags,
      status,
    };
  } catch (error) {
    const mapped = isAiError(error)
      ? error
      : new AiError("AI_PROVIDER_ERROR", { cause: error });
    if (requestId) {
      await releaseRequest(admin, requestId);
      await updateRequest(admin, requestId, {
        status: mapped.code === "AI_REFUSED" ? "refused" : "failed",
        error_code: mapped.code,
        finished_at: new Date().toISOString(),
      });
    }
    return failure(mapped, requestId);
  }
}

export async function runTask(
  taskId: AiTaskId,
  input: Omit<RunTextTaskInput, "taskId">,
): Promise<RunTextTaskResult> {
  return runTextTaskWithConfig(
    textTask(taskId) ?? structuredTask(taskId) ?? visionTask(taskId),
    { ...input, taskId },
  );
}
