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
  "scripts/jobs/links-expire.ts",
  "scripts/jobs/links-kv-resync.ts",
  "scripts/jobs/link-stats-rollup.ts",
  "scripts/jobs/notifications.ts",
  "scripts/jobs/campaigns-send.ts",
  "scripts/jobs/campaign-stats.ts",
  "scripts/jobs/consent-audit.ts",
  "scripts/jobs/approvals-expire.ts",
  "scripts/jobs/sla-check.ts",
  "scripts/jobs/reports-refresh.ts",
  "scripts/jobs/finance-snapshot.ts",
  "scripts/jobs/weekly-report.ts",
  "scripts/jobs/email-tracking-purge.ts",
  "scripts/jobs/staff-sessions-sweep.ts",
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
