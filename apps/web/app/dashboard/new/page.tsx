import { redirect } from "next/navigation";
import { Wizard } from "@/components/wizard/wizard";
import { getCurrentTeam } from "@/lib/team";
import { templatesForPlan } from "@/lib/templates/catalog";

type Props = { searchParams: Promise<{ template?: string }> };

export default async function NewWebsitePage({ searchParams }: Props) {
  const current = await getCurrentTeam();
  if (!current) redirect("/login");

  const { template } = await searchParams;
  const templates = templatesForPlan(current.team.planId)
    .filter((item) => item.available)
    .map((item) => ({ slug: item.slug, name: item.name, tagline: item.tagline }));

  const initialTemplateSlug =
    typeof template === "string" && templates.some((item) => item.slug === template)
      ? template
      : null;

  return <Wizard templates={templates} initialTemplateSlug={initialTemplateSlug} />;
}
