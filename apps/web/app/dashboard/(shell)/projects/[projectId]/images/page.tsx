import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";

export default async function ImagesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    notFound();
  }

  return (
    <div>
      <h1 className="text-h1">Pictures</h1>
      <p className="mt-1 text-sm text-text-muted">Manage pictures for your website.</p>
      <Card className="mt-6 p-6 text-center">
        <p className="text-text-muted">Picture library coming soon.</p>
      </Card>
    </div>
  );
}
