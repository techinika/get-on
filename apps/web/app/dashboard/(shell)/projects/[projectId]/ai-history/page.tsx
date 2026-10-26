import { redirect } from "next/navigation";

type Params = { params: Promise<{ projectId: string }> };

export default async function AiHistoryRedirect({ params }: Params) {
  const { projectId } = await params;
  redirect(`/dashboard/projects/${projectId}/settings/ai-history`);
}

