import { processNotificationOutbox } from "../../lib/email/outbox";

async function main() {
  const result = await processNotificationOutbox(50);
  console.log(
    `[notifications] processed=${result.processed} sent=${result.sent} failed=${result.failed} suppressed=${result.suppressed} deferred=${result.deferred}`,
  );
  if (result.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("[notifications] job failed", error);
  process.exitCode = 1;
});
