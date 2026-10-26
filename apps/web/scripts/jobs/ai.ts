import { runAiJobs, type AiJobMode } from "../../lib/ai/jobs";
import { createAdminClient } from "../../lib/supabase/admin";

const modes: AiJobMode[] = ["monthly", "expire", "payloads", "all"];

function readMode(): AiJobMode {
  const value = process.argv[2] ?? "all";
  if (modes.includes(value as AiJobMode)) return value as AiJobMode;
  throw new Error(`Unknown AI job mode: ${value}. Use ${modes.join(", ")}.`);
}

async function main() {
  const admin = createAdminClient();
  const result = await runAiJobs(admin, readMode());
  console.log(
    `[ai] monthly=${result.monthly} expired=${result.expired} payloads=${result.payloads} failed=${result.failed}`,
  );
  if (result.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("[ai] job failed", error);
  process.exitCode = 1;
});
