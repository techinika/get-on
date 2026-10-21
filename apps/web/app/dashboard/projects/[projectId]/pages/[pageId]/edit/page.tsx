import { redirect } from 'next/navigation';

type Params = { params: Promise<{ projectId: string; pageId: string }> };

export default async function EditorPage({ params }: Params) {
  const { projectId, pageId } = await params;
  // For now, redirect to the existing page editor or show placeholder
  redirect(`/dashboard/projects/${projectId}/pages/${pageId}`);
}
