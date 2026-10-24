import { createAdminClient } from "@/lib/supabase/admin";

export type OperationKind =
  | "publish"
  | "apply"
  | "import"
  | "restore"
  | "export"
  | "backup"
  | "transfer"
  | "delete";

export async function beginProjectOperation(params: {
  projectId: string;
  kind: OperationKind;
  heavy: boolean;
  userId?: string | null;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("begin_project_operation", {
    p_project_id: params.projectId,
    p_kind: params.kind,
    p_heavy: params.heavy,
  });
  if (error) {
    const msg = error.message || "";
    if (msg.includes("PROJECT_BUSY")) throw new Error("PROJECT_BUSY");
    throw error;
  }
  return { id: data as string };
}

export async function touchProjectOperation(operationId: string, step?: string, progress?: number) {
  const admin = createAdminClient();
  await admin
    .from("project_operations")
    .update({ step: step ?? null, progress: progress ?? 0, heartbeat_at: new Date().toISOString() })
    .eq("id", operationId);
}

export async function finishProjectOperation(
  operationId: string,
  status: "done" | "failed" | "cancelled",
  result?: unknown,
  errorCode?: string | null,
  errorMessage?: string | null,
) {
  const admin = createAdminClient();
  await admin
    .from("project_operations")
    .update({
      status,
      result: result ? JSON.parse(JSON.stringify(result)) : null,
      error_code: errorCode ?? null,
      error_message: errorMessage ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", operationId);
}
