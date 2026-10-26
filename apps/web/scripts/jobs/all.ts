import { spawnSync } from "node:child_process";

const jobs = [
  "scripts/email-queue.ts",
  "scripts/cleanup-spam.ts",
  "scripts/jobs/backups.ts",
  "scripts/jobs/backup-gc.ts",
  "scripts/jobs/exports-cleanup.ts",
  "scripts/jobs/imports-cleanup.ts",
  "scripts/jobs/transfers-expire.ts",
  "scripts/jobs/deleted-purge.ts",
  "scripts/jobs/subdomain-release.ts",
  "scripts/jobs/activity-trim.ts",
  "scripts/jobs/invitations-expire.ts",
  "scripts/jobs/referrals-qualify.ts",
  "scripts/jobs/team-reconcile.ts",
  "scripts/jobs/redirects-resync.ts",
  "scripts/jobs/billing.ts",
];

let failed = 0;
for (const job of jobs) {
  const result = spawnSync("pnpm", ["exec", "tsx", job], { stdio: "inherit" });
  if (result.status !== 0) {
    failed += 1;
    console.error(`[all] ${job} failed`);
  }
}

if (failed > 0) process.exitCode = 1;
