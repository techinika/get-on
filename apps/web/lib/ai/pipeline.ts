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
  type AiResult,
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
import { textTask, type TextTaskConfig } from "./tasks";

type Admin = ReturnType<typeof createAdminClient>;

export type RunTextTaskInput = {
  taskId: AiTaskId;
  teamId: string;
  userId: string;
  projectId?: string | null;
  userInput: string;
  existingText?: string;
  idempotencyKey?: string;
};

export type RunTextTaskSuccess = {
  ok: true;
  requestId: string;
  text: string;
  credits: number;
  flags: AiFlags;
  status: "succeeded" | "partial";
};

export type RunTextTaskFailure = {
  ok: false;
  requestId?: string;
  code: AiErrorCode;
  message: string;
  details?: Record<string, string | number>;
};

export type RunTextTaskResult = RunTextTaskSuccess | RunTextTaskFailure;

function numeric(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function failure(error: unknown, requestId?: string): RunTextTaskFailure {
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

function mapDbError(error: { message?: string } | null): AiError {
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

function gatewayMetadata(
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

async function loadAccess(
  admin: Admin,
  teamId: string,
  userId: string,
): Promise<{ planId: PlanId }> {
  const { data: member } = await admin
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .maybeSingle();
  if (
    !member ||
    !["owner", "admin", "editor"].includes(String(member.role))
  ) {
    throw new AiError("AI_PROVIDER_ERROR", {
      details: { reason: "not_allowed" },
    });
  }

  const { data: team } = await admin
    .from("teams")
    .select("plan_id")
    .eq("id", teamId)
    .maybeSingle();
  return { planId: ((team?.plan_id as PlanId) ?? "free") satisfies PlanId };
}

async function verifyProject(
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

async function checkRateLimits(
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

async function updateRequest(
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

async function releaseRequest(admin: Admin, requestId: string): Promise<void> {
  const { error } = await admin.rpc("ai_release", { p_request: requestId });
  if (error) {
    console.error("[ai] could not release request", requestId, error);
  }
}

async function storePayload(
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

async function recordUsage(
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

async function moderateText(
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

export async function runTextTask(
  input: RunTextTaskInput,
): Promise<RunTextTaskResult> {
  const task: TextTaskConfig | null = textTask(input.taskId);
  return runTextTaskWithConfig(task, input);
}

async function runTextTaskWithConfig(
  task: TextTaskConfig | null,
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

    const { planId } = await loadAccess(admin, input.teamId, input.userId);
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
    const estimate = estimateCredits({
      inputTokens,
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

    let providerResult: AiResult<string>;
    try {
      providerResult = await provider.generateText({
        modelId: model.modelId,
        messages: composed.messages,
        maxTokens: maxOutputTokens,
        temperature: task.temperature,
        timeoutMs: AI_TASKS[task.taskId].timeoutMs,
        metadata,
      });
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

    const text = sanitiseText(providerResult.value, task.maxChars);
    const flags = scanOutput(text);
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
          text,
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
      inputTokens: providerResult.usage.inputTokens ?? inputTokens,
      outputTokens: providerResult.usage.outputTokens ?? estimateTokens(text),
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
      { text },
      settings.payloadRetentionDays,
    );
    await recordUsage(admin, input.teamId, charged, neurons);

    return {
      ok: true,
      requestId,
      text,
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
  return runTextTaskWithConfig(textTask(taskId), { ...input, taskId });
}
