import { processEmailQueue } from "../lib/email/send";

async function main() {
  const once = process.argv.includes("--once");
  const intervalMs = Number(process.env.EMAIL_QUEUE_INTERVAL_MS ?? 60_000);

  if (once) {
    const result = await processEmailQueue();
    console.log(`Sent ${result.sent} of ${result.processed} queued emails.`);
    return;
  }

  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const result = await processEmailQueue();
      if (result.processed > 0) {
        console.log(
          `${new Date().toISOString()} sent ${result.sent} of ${result.processed} queued emails.`,
        );
      }
    } catch (error) {
      console.error("Email queue run failed:", error);
    } finally {
      running = false;
    }
  };

  await tick();
  const timer = setInterval(tick, intervalMs);
  const stop = () => {
    clearInterval(timer);
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

void main();
