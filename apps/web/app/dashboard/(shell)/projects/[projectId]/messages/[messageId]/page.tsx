import { notFound, redirect } from "next/navigation";
import { AppPage } from "@/components/app/app-page";
import { createClient } from "@/lib/supabase/server";
import { getShellData } from "@/lib/dashboard";
import { MessageDetailClient } from "@/components/project/message-detail-client";
import type { MessageItem } from "@/components/project/messages-content";

type Props = { params: Promise<{ projectId: string; messageId: string }> };

export default async function MessagePage({ params }: Props) {
  const { projectId, messageId } = await params;
  const data = await getShellData();
  if (!data) redirect("/login");

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .eq("team_id", data.currentTeam.id)
    .maybeSingle();
  if (!project) notFound();

  const [{ data: messages }, { data: pages }] = await Promise.all([
    supabase
      .from("contact_messages")
      .select("id, name, email, phone, message, status, replied, page_path, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("pages").select("path, title").eq("project_id", projectId),
  ]);

  const list = (messages ?? []) as MessageItem[];
  const index = list.findIndex((message) => message.id === messageId);
  if (index === -1) notFound();

  const pageTitles: Record<string, string> = {};
  for (const page of pages ?? []) pageTitles[String(page.path)] = String(page.title);
  const message = list[index]!;

  return (
    <AppPage width="narrow">
      <div className="-mx-1 rounded-app-card border border-border bg-surface max-[1023px]:-mx-4 max-[1023px]:rounded-none max-[1023px]:border-x-0">
        <MessageDetailClient
          projectId={project.id}
          projectName={project.name}
          initialMessage={message}
          pageLabel={message.page_path ? (pageTitles[message.page_path] ?? message.page_path) : ""}
          previous={list[index + 1] ?? null}
          next={list[index - 1] ?? null}
        />
      </div>
    </AppPage>
  );
}
