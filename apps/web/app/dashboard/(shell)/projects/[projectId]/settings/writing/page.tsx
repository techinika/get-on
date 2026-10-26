import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { TONES } from "./tone-options";
import { WritingStyleForm } from "./writing-style-form";

type Params = { params: Promise<{ projectId: string }> };

function stringList(value: unknown, allowed?: readonly string[]): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .filter((item) => !allowed || allowed.includes(item))
    .slice(0, 10);
}

export default async function WritingStyleSettingsPage({ params }: Params) {
  const { projectId } = await params;
  const current = await getCurrentTeam();

  let initial: {
    tones: string[];
    audience: string;
    wordsToUse: string[];
    wordsToAvoid: string[];
    facts: Array<{ label: string; value: string }>;
  } = {
    tones: [],
    audience: "",
    wordsToUse: [],
    wordsToAvoid: [],
    facts: [],
  };

  if (current) {
    const supabase = await createClient();
    const { data: settings } = await supabase
      .from("project_settings")
      .select("brand_voice, business_facts")
      .eq("project_id", projectId)
      .maybeSingle();

    const brandVoice =
      settings?.brand_voice && typeof settings.brand_voice === "object"
        ? (settings.brand_voice as Record<string, unknown>)
        : {};
    const facts = Array.isArray(settings?.business_facts)
      ? (settings.business_facts as Array<{ label?: unknown; value?: unknown }>)
          .filter((fact) => fact && typeof fact === "object")
          .map((fact) => ({
            label: String(fact.label ?? "").slice(0, 40),
            value: String(fact.value ?? "").slice(0, 120),
          }))
          .filter((fact) => fact.label && fact.value)
          .slice(0, 20)
      : [];

    initial = {
      tones: stringList(brandVoice.tones, TONES).slice(0, 3),
      audience: typeof brandVoice.audience === "string" ? brandVoice.audience : "",
      wordsToUse: stringList(brandVoice.wordsToUse),
      wordsToAvoid: stringList(brandVoice.wordsToAvoid),
      facts,
    };
  }

  return (
    <div>
      <SettingsPageHeader
        title="Writing style"
        description="Tell AI how to sound and what is true about your business."
        timing="right"
      />
      <WritingStyleForm projectId={projectId} initial={initial} />
    </div>
  );
}
