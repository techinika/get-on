import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";
import { csvFileName, csvHeader, messageToRow, type CsvMessage } from "@/lib/contact/csv";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 500;

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const current = await getCurrentTeam();
  if (!current) return new Response("Unauthorized", { status: 401 });

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, subdomain")
    .eq("id", projectId)
    .eq("team_id", current.team.teamId)
    .maybeSingle();
  if (!project) return new Response("Not found", { status: 404 });

  const encoder = new TextEncoder();
  let offset = 0;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(`\uFEFF${csvHeader()}\r\n`));
      for (;;) {
        const { data, error } = await supabase
          .from("contact_messages")
          .select("created_at, name, email, phone, message, page_path, status, replied")
          .eq("project_id", projectId)
          .neq("status", "spam")
          .order("created_at", { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);
        if (error || !data || data.length === 0) break;
        for (const row of data as CsvMessage[]) {
          controller.enqueue(encoder.encode(`${messageToRow(row)}\r\n`));
        }
        if (data.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }
      controller.close();
    },
  });

  const filename = csvFileName(String(project.subdomain));
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^A-Za-z0-9._-]/g, "-")}"`,
      "Cache-Control": "no-store",
    },
  });
}
