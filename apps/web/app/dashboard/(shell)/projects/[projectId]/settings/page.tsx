import { redirect } from "next/navigation";

type Params = { params: Promise<{ projectId: string }> };

export default async function SettingsPage({ params }: Params) {
  const { projectId } = await params;
  redirect(`/dashboard/projects/${projectId}/settings/business`);
}
