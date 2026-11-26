import { createHash, randomUUID } from "node:crypto";
import {
  AI_TASKS,
  AiError,
  MODEL_SEEDS,
  buildRequestUsage,
  estimateTokens,
  imageCredits,
  isAiError,
  modelFor,
  reserveCredits,
  type AiModel,
  type AiUsage,
} from "@get-on/ai";
import sharp from "sharp";
import { PLAN_BY_ID } from "@/lib/plans";
import { touchProject } from "@/lib/project-activity";
import { createAdminClient } from "@/lib/supabase/admin";
import { aiConfig } from "./config";
import type { AiFlags } from "./guards";
import {
  checkRateLimits,
  failure,
  gatewayMetadata,
  loadAccess,
  mapDbError,
  moderateText,
  numeric,
  recordUsage,
  releaseRequest,
  storePayload,
  updateRequest,
  verifyProject,
  type RunTextTaskFailure,
} from "./pipeline";
import { createAiProvider } from "./provider-factory";
import {
  ensureFreeGrant,
  loadAiModels,
  loadAiSettings,
  loadBrandContext,
  loadDailyUsage,
  loadPlatformUsage,
  type BrandContext,
} from "./settings";

const BUCKET = "project-media";
const WIDTH = 1024;
const HEIGHT = 1024;
const STEPS = 4;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export type RunImageTaskInput = {
  teamId: string;
  userId: string;
  projectId: string;
  prompt: string;
  idempotencyKey?: string;
};

export type RunImageTaskSuccess = {
  ok: true;
  requestId: string;
  mediaId: string;
  path: string;
  url: string | null;
  media: {
    id: string;
    path: string;
    filename: string | null;
    mime: string | null;
    size_bytes: number | null;
    width: number | null;
    height: number | null;
    alt: string | null;
    created_at: string | null;
  };
  credits: number;
  flags: AiFlags;
  status: "succeeded";
};

export type RunImageTaskFailure = RunTextTaskFailure;
export type RunImageTaskResult = RunImageTaskSuccess | RunImageTaskFailure;

export function imagePrompt(request: string, brand: BrandContext): string {
  const facts = brand.businessFacts
    .map((fact) => `${fact.label}: ${fact.value}`)
    .join("; ");
  return [
    "Create one clean, bright website picture for a small business.",
    "No text, logos, watermarks, faces, brand names or screenshots.",
    "Do not show anything unsafe, violent, sexual, hateful, illegal or misleading.",
    facts ? `Business facts: ${facts}.` : "",
    `Request: ${request.trim()}`,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 2000);
}

function emptyFlags(): AiFlags {
  return {
    factClaims: [],
    sampleClaims: [],
    injection: false,
    empty: false,
  };
}

function logImageFailure(
  requestId: string | undefined,
  error: unknown,
): void {
  const ai = isAiError(error)
    ? error
    : new AiError("AI_PROVIDER_ERROR", { cause: error });
  console.error("[ai] image task failed", {
    requestId,
    code: ai.code,
    status: ai.status,
    providerCode: ai.providerCode,
    reason:
      typeof ai.details.reason === "string" ? ai.details.reason : undefined,
  });
}

async function resolveImageModel(
  admin: ReturnType<typeof createAdminClient>,
  models: AiModel[],
): Promise<AiModel | null> {
  const enabledModel = modelFor("image", {}, models);
  if (enabledModel) return enabledModel;

  // If the database table exists without any image row seeded yet, fall back
  // to the built-in image seed while still respecting an explicitly disabled DB row.
  try {
    const query = admin
      .from("ai_models")
      .select("id, enabled, purposes") as unknown as {
      contains?: (
        col: string,
        val: string[],
      ) => {
        limit: (
          n: number,
        ) => PromiseLike<{ data: Array<{ enabled?: boolean }> | null }>;
      };
    };
    if (typeof query.contains === "function") {
      const { data } = await query.contains("purposes", ["image"]).limit(1);
      if (data && data.length > 0) {
        return null;
      }
    }
  } catch {
    // Ignore partial mock lookup failures and use built-in image seed.
  }

  return modelFor("image", {}, MODEL_SEEDS);
}

export async function runImageTask(
  input: RunImageTaskInput,
): Promise<RunImageTaskResult> {
  const config = aiConfig();
  const admin = createAdminClient();
  let requestId: string | undefined;
  let storagePath: string | undefined;
  let mediaId: string | undefined;
  let reservedCredit = false;

  try {
    if (!config.enabled) throw new AiError("AI_DISABLED");

    const settings = await loadAiSettings(admin);
    if (!settings.enabled) throw new AiError("AI_DISABLED");
    if (!settings.imagesEnabled || !config.imagesEnabled) {
      throw new AiError("AI_IMAGES_OFF");
    }

    const { planId, status: accessStatus } = await loadAccess(
      admin,
      input.teamId,
      input.userId,
    );
    if (accessStatus === "lapsed") {
      throw new AiError("AI_PLAN_INACTIVE");
    }
    await verifyProject(admin, input.teamId, input.projectId);
    if (!input.projectId) {
      throw new AiError("AI_PROVIDER_ERROR", {
        details: { reason: "project_required" },
      });
    }
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
    const model = await resolveImageModel(admin, models);
    if (!model) {
      throw new AiError("AI_PROVIDER_ERROR", {
        details: { reason: "no_image_model" },
      });
    }
    const guard = modelFor("guard", {}, models);

    const brand = await loadBrandContext(admin, input.projectId);
    const prompt = imagePrompt(input.prompt, brand);
    if (prompt.length > settings.maxPromptChars) {
      throw new AiError("AI_TOO_LONG");
    }

    const estimate = imageCredits(
      { width: WIDTH, height: HEIGHT, steps: STEPS },
      settings.creditNeurons,
    );
    const cap = AI_TASKS["image.generate"].capCredits;
    const reserved = reserveCredits(estimate, cap);
    const idempotencyKey = input.idempotencyKey ?? randomUUID();
    const inputHash = createHash("sha256")
      .update(`image.generate\n${input.prompt}`)
      .digest("hex");

    const { data: created, error: createError } = await admin
      .from("ai_requests")
      .insert({
        team_id: input.teamId,
        project_id: input.projectId,
        user_id: input.userId,
        task: "image.generate",
        feature: "images",
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
        prompt_version: "image.generate@1",
        skill_versions: [],
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
    const metadata = gatewayMetadata(input.teamId, "image.generate", requestId);

    let moderationInputUsage: AiUsage | undefined;
    if (settings.moderationEnabled) {
      const moderation = await moderateText(
        provider,
        guard?.modelId,
        input.prompt,
        AI_TASKS.moderate.timeoutMs,
        metadata,
      );
      moderationInputUsage = moderation.usage;
      const moderationOnlyUsage = buildRequestUsage({
        model,
        moderationInputUsage,
        guardModel: guard,
        creditNeurons: settings.creditNeurons,
      });
      await updateRequest(admin, requestId, {
        moderation: { safe: moderation.safe, categories: moderation.categories },
        usage: moderationOnlyUsage,
        ...(moderation.safe
          ? {}
          : { status: "refused", finished_at: new Date().toISOString() }),
      });
      if (!moderation.safe) {
        await recordUsage(admin, input.teamId, 0, moderationOnlyUsage.totalNeurons);
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
    reservedCredit = true;

    const startedAt = Date.now();
    await updateRequest(admin, requestId, {
      status: "running",
      started_at: new Date(startedAt).toISOString(),
    });

    let generated;
    try {
      generated = await provider.generateImage({
        modelId: model.modelId,
        prompt,
        width: WIDTH,
        height: HEIGHT,
        steps: STEPS,
        timeoutMs: AI_TASKS["image.generate"].timeoutMs,
        metadata,
      });
    } catch (error) {
      const mapped = isAiError(error)
        ? error
        : new AiError("AI_PROVIDER_ERROR", { cause: error });
      logImageFailure(requestId, mapped);
      await releaseRequest(admin, requestId);
      await updateRequest(admin, requestId, {
        status: mapped.code === "AI_REFUSED" ? "refused" : "failed",
        error_code: mapped.code,
        latency_ms: Date.now() - startedAt,
        finished_at: new Date().toISOString(),
      });
      return failure(mapped, requestId);
    }

    const imageUsage = buildRequestUsage({
      model,
      generationUsage: {
        ...generated.usage,
        inputTokens: generated.usage.inputTokens ?? estimateTokens(prompt),
        images: 1,
        ...(generated.usage.inputTokens === undefined ? { tokensEstimated: true } : {}),
      },
      moderationInputUsage,
      guardModel: guard,
      creditNeurons: settings.creditNeurons,
    });

    const normalizedBase64 = generated.imageBase64
      .replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "")
      .replace(/\s+/g, "");
    const source = Buffer.from(normalizedBase64, "base64");
    if (source.length === 0 || source.length > MAX_IMAGE_BYTES) {
      const mapped = new AiError("AI_BAD_RESULT", {
        details: { reason: source.length === 0 ? "empty_image" : "image_too_large" },
      });
      logImageFailure(requestId, mapped);
      await releaseRequest(admin, requestId);
      await updateRequest(admin, requestId, {
        status: "failed",
        error_code: mapped.code,
        usage: imageUsage,
        latency_ms: Date.now() - startedAt,
        finished_at: new Date().toISOString(),
      });
      await recordUsage(admin, input.teamId, 0, imageUsage.totalNeurons);
      return failure(mapped, requestId);
    }

    let processed: {
      data: Buffer;
      info: { size: number; width: number; height: number };
    };
    try {
      processed = await sharp(source)
        .rotate()
        .resize({
          width: 1600,
          height: 1600,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });
    } catch (error) {
      const mapped = new AiError("AI_BAD_RESULT", {
        cause: error,
        details: { reason: "sharp_decode_failed" },
      });
      logImageFailure(requestId, mapped);
      await releaseRequest(admin, requestId);
      await updateRequest(admin, requestId, {
        status: "failed",
        error_code: mapped.code,
        usage: imageUsage,
        latency_ms: Date.now() - startedAt,
        finished_at: new Date().toISOString(),
      });
      await recordUsage(admin, input.teamId, 0, imageUsage.totalNeurons);
      return failure(mapped, requestId);
    }

    storagePath = `${input.projectId}/${randomUUID()}-ai.webp`;
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, processed.data, {
        contentType: "image/webp",
        upsert: false,
      });
    if (uploadError) {
      const mapped = new AiError("AI_PROVIDER_ERROR", { cause: uploadError });
      await releaseRequest(admin, requestId);
      await updateRequest(admin, requestId, {
        status: "failed",
        error_code: mapped.code,
        usage: imageUsage,
        latency_ms: Date.now() - startedAt,
        finished_at: new Date().toISOString(),
      });
      await recordUsage(admin, input.teamId, 0, imageUsage.totalNeurons);
      return failure(mapped, requestId);
    }

    const { data: media, error: insertError } = await admin
      .from("media")
      .insert({
        project_id: input.projectId,
        path: storagePath,
        filename: "AI picture.webp",
        mime: "image/webp",
        size_bytes: processed.info.size,
        width: processed.info.width,
        height: processed.info.height,
        alt: "",
        created_by: input.userId,
        ai_generated: true,
        ai_request_id: requestId,
      })
      .select("id, path, filename, mime, size_bytes, width, height, alt, created_at")
      .single();
    if (insertError || !media) {
      await admin.storage.from(BUCKET).remove([storagePath]);
      const mapped = new AiError("AI_PROVIDER_ERROR", { cause: insertError });
      await releaseRequest(admin, requestId);
      await updateRequest(admin, requestId, {
        status: "failed",
        error_code: mapped.code,
        usage: imageUsage,
        latency_ms: Date.now() - startedAt,
        finished_at: new Date().toISOString(),
      });
      await recordUsage(admin, input.teamId, 0, imageUsage.totalNeurons);
      return failure(mapped, requestId);
    }

    mediaId = String(media.id);
    await touchProject(admin, input.projectId);

    const actual = imageCredits(
      { width: processed.info.width, height: processed.info.height, steps: STEPS },
      settings.creditNeurons,
    );
    let charged = 0;
    if (reserved > 0) {
      const { data: settled, error: settleError } = await admin.rpc(
        "ai_settle",
        { p_request: requestId, p_actual: actual },
      );
      if (settleError) {
        const mapped = mapDbError(settleError);
        await admin.from("media").delete().eq("id", mediaId);
        await admin.storage.from(BUCKET).remove([storagePath]);
        mediaId = undefined;
        storagePath = undefined;
        await releaseRequest(admin, requestId);
        await updateRequest(admin, requestId, {
          status: "failed",
          error_code: mapped.code,
          usage: imageUsage,
          latency_ms: Date.now() - startedAt,
          finished_at: new Date().toISOString(),
        });
        await recordUsage(admin, input.teamId, 0, imageUsage.totalNeurons);
        return failure(mapped, requestId);
      }
      charged = numeric(settled, actual);
    }

    const flags = emptyFlags();
    await updateRequest(admin, requestId, {
      status: "succeeded",
      charged_credits: charged,
      usage: imageUsage,
      flags,
      latency_ms: Date.now() - startedAt,
      finished_at: new Date().toISOString(),
    });
    await storePayload(
      admin,
      requestId,
      {
        userInput: input.prompt,
        prompt,
        width: WIDTH,
        height: HEIGHT,
        steps: STEPS,
      },
      {
        mediaId: media.id,
        path: storagePath,
        width: processed.info.width,
        height: processed.info.height,
      },
      settings.payloadRetentionDays,
    );
    await recordUsage(admin, input.teamId, charged, imageUsage.totalNeurons);

    const { data: signed } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 3600);

    return {
      ok: true,
      requestId,
      mediaId: String(media.id),
      path: storagePath,
      url: signed?.signedUrl ?? null,
      media: {
        id: String(media.id),
        path: String(media.path),
        filename: media.filename ? String(media.filename) : null,
        mime: media.mime ? String(media.mime) : null,
        size_bytes: typeof media.size_bytes === "number" ? media.size_bytes : null,
        width: typeof media.width === "number" ? media.width : null,
        height: typeof media.height === "number" ? media.height : null,
        alt: media.alt ? String(media.alt) : null,
        created_at: media.created_at ? String(media.created_at) : null,
      },
      credits: charged,
      flags,
      status: "succeeded",
    };
  } catch (error) {
    const mapped = isAiError(error)
      ? error
      : new AiError("AI_PROVIDER_ERROR", { cause: error });
    logImageFailure(requestId, mapped);
    if (requestId) {
      if (reservedCredit) {
        await releaseRequest(admin, requestId);
      }
      await updateRequest(admin, requestId, {
        status: mapped.code === "AI_REFUSED" ? "refused" : "failed",
        error_code: mapped.code,
        finished_at: new Date().toISOString(),
      });
    }
    if (mediaId) {
      await admin.from("media").delete().eq("id", mediaId);
    }
    if (storagePath) {
      await admin.storage.from(BUCKET).remove([storagePath]);
    }
    return failure(mapped, requestId);
  }
}
