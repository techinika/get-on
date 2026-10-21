import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronDown, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Params = { params: Promise<{ projectId: string; pageId: string }> };

type Block = {
  id?: string;
  type?: string;
  text?: string;
  phone?: string;
  email?: string;
  address?: string;
};

function BlockPreview({ block }: { block: Block }) {
  switch (block.type) {
    case "heading":
      return <h2 className="text-h2 break-words">{block.text}</h2>;
    case "text":
      return <p className="text-base text-text break-words">{block.text}</p>;
    case "button":
      return (
        <div>
          <Button variant="secondary" disabled className="rounded-pill">
            {block.text}
          </Button>
        </div>
      );
    case "contact-details": {
      const lines = [block.phone, block.email, block.address].filter(
        (line): line is string => Boolean(line && line.trim()),
      );
      if (lines.length === 0) return null;
      return (
        <ul className="space-y-1 text-sm text-text">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      );
    }
    default:
      return null;
  }
}

export default async function PageEditorPage({ params }: Params) {
  const { projectId, pageId } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("pages")
    .select("id, project_id, title, path, blocks")
    .eq("id", pageId)
    .eq("project_id", projectId)
    .maybeSingle();

  const page = data as
    | { id: string; project_id: string; title: string; path: string; blocks: unknown }
    | null;
  if (!page) {
    notFound();
  }

  const blocks = Array.isArray(page.blocks) ? (page.blocks as Block[]) : [];

  return (
    <div>
      <Link
        href={`/dashboard/projects/${projectId}/pages`}
        className="inline-flex h-11 items-center gap-2 text-sm font-semibold text-primary"
      >
        <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
        Pages
      </Link>

      <h1 className="text-h1 mt-1">Editing: {page.title}</h1>

      <div className="mt-4 flex gap-3 rounded-info bg-info-soft px-4 py-3.5 text-sm text-info-text">
        <Info size={18} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0" />
        <p>The visual editor is coming soon. For now you can see what is on this page below.</p>
      </div>

      <Card className="mt-6 p-6">
        <h3 className="text-h3">What is on this page</h3>

        <div className="mt-4 space-y-4 rounded-info border border-border bg-surface p-6">
          {blocks.length === 0 ? (
            <p className="text-sm text-text-muted">This page has no content yet.</p>
          ) : (
            blocks.map((block, index) => (
              <BlockPreview key={block.id ?? index} block={block} />
            ))
          )}
        </div>

        <details className="group mt-4">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-input text-base font-semibold text-text outline-offset-2 hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
            Developer view
            <ChevronDown
              size={18}
              strokeWidth={1.75}
              aria-hidden
              className="text-text-muted transition-transform group-open:rotate-180"
            />
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-input bg-surface-muted p-4 text-sm text-text">
            {JSON.stringify(blocks, null, 2)}
          </pre>
        </details>
      </Card>
    </div>
  );
}
