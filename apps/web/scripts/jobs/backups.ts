import { createAdminClient } from "@/lib/supabase/admin";

export async function runBackupsJob() {
  const admin = createAdminClient();
  // TODO: iterate projects due for backups
  return { ok: true, processed: 0 };
}

if (require.main === module) {
  runBackupsJob()
    .then((r) => {
      console.log(JSON.stringify(r));
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
