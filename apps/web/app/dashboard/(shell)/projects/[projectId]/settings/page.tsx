import { getShellData } from "@/lib/dashboard";
import { redirect } from "next/navigation";

type Params = { params: Promise<{ projectId: string }> };

export default async function SettingsIndex({ params }: Params) {
  const { projectId } = await params;
  const data = await getShellData();
  if (!data) redirect("/login");
  redirect(`/dashboard/projects/${projectId}/settings/business`);
}
