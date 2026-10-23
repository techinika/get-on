import { cleanupContactSpam } from "../lib/contact/cleanup";

async function main() {
  const removed = await cleanupContactSpam();
  console.log(`Removed ${removed} old spam ${removed === 1 ? "message" : "messages"}.`);
}

void main();
