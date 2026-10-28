import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { AppCard } from "@/components/app/card";
import { AppPage } from "@/components/app/app-page";
import { InfoBox } from "@/components/app/info-box";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { getAiOverview } from "@/lib/admin";
import { cn } from "@/lib/utils";
import { saveAiSettings, toggleAiModel } from "./actions";

export const dynamic = "force-dynamic";

const ERROR_COPY: Record<string, string> = {
  GATEWAY: "The Gateway id is too long.",
  LANGUAGE: "Use a language code like en or en-gb.",
  CREDIT_NEURONS: "Credits per neuron must be between 1 and 100,000.",
  DAILY_CAP: "The daily cap must be between 0 and 1,000,000.",
  FREE_GRANT: "The free grant must be between 0 and 10,000.",
  PROMPT_CHARS: "The prompt limit must be between 100 and 200,000.",
  RETENTION: "Payload retention must be between 1 and 365 days.",
  SAVE_FAILED: "Settings could not be saved.",
  MODEL: "That model is not valid.",
  MODEL_SAVE_FAILED: "The model could not be changed.",
};

function formatNumber(value: unknown): string {
  return Number(value ?? 0).toLocaleString("en-GB");
}

function dayLabel(value: unknown): string {
  const text = String(value ?? "");
  if (!text) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${text}T00:00:00Z`));
}

export default async function AdminAiPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const { settings, models, daily, failures } = await getAiOverview();
  const today = daily.find((row) => row.day === new Date().toISOString().slice(0, 10));
  const weekCredits = daily.reduce((sum, row) => sum + Number(row.credits ?? 0), 0);
  const weekRequests = daily.reduce((sum, row) => sum + Number(row.requests ?? 0), 0);

  return (
    <AppPage width="wide">
      <PageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "AI" },
        ]}
        title="AI"
        description="Settings, models and usage for the whole platform."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/ai/design"
              className={cn(buttonVariants({ variant: "secondary", size: "md" }))}
            >
              Design accuracy
            </Link>
            <Link
              href="/admin"
              className={cn(buttonVariants({ variant: "ghost", size: "md" }))}
            >
              <ArrowLeft size={20} strokeWidth={1.75} aria-hidden />
              Admin
            </Link>
          </div>
        }
      />

      {params.saved ? (
        <InfoBox variant="success" className="mb-6">
          {params.saved === "model" ? "Model updated." : "AI settings saved."}
        </InfoBox>
      ) : null}
      {params.error ? (
        <InfoBox variant="danger" className="mb-6">
          {ERROR_COPY[params.error] ?? "That change could not be saved."}
        </InfoBox>
      ) : null}

      {!settings.enabled ? (
        <InfoBox variant="danger" className="mb-6">
          AI is switched off for everyone. Existing content is unchanged.
        </InfoBox>
      ) : null}

      <div className="grid grid-cols-1 gap-4 min-[768px]:grid-cols-4">
        <AppCard className="p-5">
          <p className="text-sm text-text-muted">Credits today</p>
          <p className="text-stat-number mt-1 text-text">
            {formatNumber(today?.credits)}
          </p>
        </AppCard>
        <AppCard className="p-5">
          <p className="text-sm text-text-muted">Requests today</p>
          <p className="text-stat-number mt-1 text-text">
            {formatNumber(today?.requests)}
          </p>
        </AppCard>
        <AppCard className="p-5">
          <p className="text-sm text-text-muted">Credits in 7 days</p>
          <p className="text-stat-number mt-1 text-text">{formatNumber(weekCredits)}</p>
        </AppCard>
        <AppCard className="p-5">
          <p className="text-sm text-text-muted">Failed or refused</p>
          <p className="text-stat-number mt-1 text-text">{formatNumber(failures)}</p>
        </AppCard>
      </div>

      <Section title="Settings">
        <AppCard className="p-6">
          <form action={saveAiSettings} className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-3 min-[768px]:grid-cols-3">
              <label className="flex items-start gap-3 rounded-input border border-border p-3">
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={settings.enabled}
                  className="mt-0.5 h-5 w-5 shrink-0 rounded border-border-strong accent-primary"
                />
                <span>
                  <span className="block text-sm font-semibold text-text">AI is on</span>
                  <span className="text-sm text-text-muted">
                    Turning this off stops every AI action.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-input border border-border p-3">
                <input
                  type="checkbox"
                  name="moderation_enabled"
                  defaultChecked={settings.moderationEnabled}
                  className="mt-0.5 h-5 w-5 shrink-0 rounded border-border-strong accent-primary"
                />
                <span>
                  <span className="block text-sm font-semibold text-text">Safety checks</span>
                  <span className="text-sm text-text-muted">
                    Check input and output before and after AI.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-input border border-border p-3">
                <input
                  type="checkbox"
                  name="images_enabled"
                  defaultChecked={settings.imagesEnabled}
                  className="mt-0.5 h-5 w-5 shrink-0 rounded border-border-strong accent-primary"
                />
                <span>
                  <span className="block text-sm font-semibold text-text">AI pictures</span>
                  <span className="text-sm text-text-muted">
                    Also needs AI_IMAGES_ENABLED=true.
                  </span>
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-4">
              <div>
                <Label htmlFor="credit_neurons">Neurons per credit</Label>
                <Input
                  id="credit_neurons"
                  name="credit_neurons"
                  type="number"
                  min={1}
                  max={100000}
                  defaultValue={settings.creditNeurons}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="daily_cap_credits">Daily platform cap</Label>
                <Input
                  id="daily_cap_credits"
                  name="daily_cap_credits"
                  type="number"
                  min={0}
                  max={1000000}
                  defaultValue={settings.dailyCapCredits}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="free_grant_credits">Free grant</Label>
                <Input
                  id="free_grant_credits"
                  name="free_grant_credits"
                  type="number"
                  min={0}
                  max={10000}
                  defaultValue={settings.freeGrantCredits}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="max_prompt_chars">Longest request</Label>
                <Input
                  id="max_prompt_chars"
                  name="max_prompt_chars"
                  type="number"
                  min={100}
                  max={200000}
                  defaultValue={settings.maxPromptChars}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="payload_retention_days">Keep AI content (days)</Label>
                <Input
                  id="payload_retention_days"
                  name="payload_retention_days"
                  type="number"
                  min={1}
                  max={365}
                  defaultValue={settings.payloadRetentionDays}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="default_language">Default language</Label>
                <Input
                  id="default_language"
                  name="default_language"
                  defaultValue={settings.defaultLanguage}
                  maxLength={5}
                  className="mt-1.5"
                />
              </div>
              <div className="min-[640px]:col-span-2">
                <Label htmlFor="gateway_id" optional>
                  AI Gateway id
                </Label>
                <Input
                  id="gateway_id"
                  name="gateway_id"
                  defaultValue={settings.gatewayId ?? ""}
                  maxLength={120}
                  placeholder="get-on"
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className={cn(buttonVariants({ variant: "primary", size: "md" }))}
              >
                Save settings
              </button>
              <p className="text-sm text-text-muted">
                Changes apply to new AI actions right away.
              </p>
            </div>
          </form>
        </AppCard>
      </Section>

      <Section
        title="Usage by day"
        description={`${formatNumber(weekRequests)} requests in the last 7 days.`}
      >
        <AppCard className="overflow-x-auto p-0">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-label-caps text-text-muted">Day</th>
                <th className="px-5 py-3 text-right text-label-caps text-text-muted">Credits</th>
                <th className="px-5 py-3 text-right text-label-caps text-text-muted">Requests</th>
                <th className="px-5 py-3 text-right text-label-caps text-text-muted">Neurons</th>
              </tr>
            </thead>
            <tbody>
              {daily.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-text-muted">
                    No AI use in the last 7 days.
                  </td>
                </tr>
              ) : (
                daily.map((row) => (
                  <tr key={String(row.day)} className="border-b border-border last:border-b-0">
                    <td className="px-5 py-3 text-text">{dayLabel(row.day)}</td>
                    <td className="px-5 py-3 text-right text-text">{formatNumber(row.credits)}</td>
                    <td className="px-5 py-3 text-right text-text-muted">
                      {formatNumber(row.requests)}
                    </td>
                    <td className="px-5 py-3 text-right text-text-muted">
                      {formatNumber(row.neurons)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </AppCard>
      </Section>

      <Section
        title="Models"
        description="Turn a model off to stop new requests from using it."
      >
        <AppCard className="overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-label-caps text-text-muted">Model</th>
                <th className="px-5 py-3 text-left text-label-caps text-text-muted">Used for</th>
                <th className="px-5 py-3 text-left text-label-caps text-text-muted">Features</th>
                <th className="px-5 py-3 text-left text-label-caps text-text-muted">Fallback</th>
                <th className="px-5 py-3 text-right text-label-caps text-text-muted">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {models.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-text-muted">
                    No models are set up.
                  </td>
                </tr>
              ) : (
                models.map((row) => {
                  const id = String(row.id);
                  const enabled = row.enabled !== false;
                  const purposes = Array.isArray(row.purposes) ? row.purposes : [];
                  return (
                    <tr key={id} className="border-b border-border last:border-b-0">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-text">{id}</p>
                        <p className="mt-0.5 break-all text-xs text-text-muted">
                          {String(row.model_id ?? "")}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1">
                          {purposes.length === 0 ? (
                            <span className="text-text-muted">—</span>
                          ) : (
                            purposes.map((purpose: unknown) => (
                              <Badge key={String(purpose)} variant="neutral">
                                {String(purpose)}
                              </Badge>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1">
                          {row.supports_json === true ? (
                            <Badge variant="info">Structured</Badge>
                          ) : null}
                          {row.supports_vision === true ? (
                            <Badge variant="accent">Pictures</Badge>
                          ) : null}
                          {row.supports_json !== true && row.supports_vision !== true ? (
                            <span className="text-text-muted">Text</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-text-muted">
                        {row.fallback_id ? String(row.fallback_id) : "—"}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Badge variant={enabled ? "live" : "neutral"} dot={enabled}>
                          {enabled ? "On" : "Off"}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <form action={toggleAiModel}>
                          <input type="hidden" name="id" value={id} />
                          <input
                            type="hidden"
                            name="enabled"
                            value={enabled ? "false" : "true"}
                          />
                          <button
                            type="submit"
                            className={cn(
                              buttonVariants({
                                variant: enabled ? "danger-outline" : "secondary",
                                size: "sm",
                              }),
                            )}
                          >
                            {enabled ? "Turn off" : "Turn on"}
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </AppCard>
      </Section>

      <p className="mt-6 flex items-start gap-2 text-sm text-text-muted">
        <Sparkles size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0" />
        Every change is written to the admin history. Model prices are set in the model row.
      </p>
    </AppPage>
  );
}
