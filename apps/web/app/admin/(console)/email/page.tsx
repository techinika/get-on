import Link from "next/link";
import { AppPage } from "@/components/app/app-page";
import { AppCard } from "@/components/app/card";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { getEmailSummary, listEmailLog, listEmailSuppressions } from "@/lib/admin";
import { relativeTime } from "@/lib/relative-time";
import { createAdminClient } from "@/lib/supabase/admin";
import { useEffect, useState } from "react";

export const dynamic = "force-dynamic";

type EmailRow = {
  id: string;
  kind: string | null;
  stream: string | null;
  to_email: string | null;
  status: "queued" | "sending" | "sent" | "failed" | "suppressed" | "cancelled";
  attempts: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
};

type SuppressionRow = {
  email: string;
  reason: "bounce" | "complaint" | "manual";
  detail: string | null;
  created_at: string;
};

function statusVariant(status: EmailRow["status"]) {
  if (status === "sent") return "live" as const;
  if (status === "failed" || status === "cancelled") return "danger" as const;
  if (status === "suppressed") return "draft" as const;
  return "info" as const;
}

const FILTERS = ["all", "queued", "sent", "failed", "suppressed"] as const;
const PROVIDERS = ["ses", "smtp", "console", "memory"] as const;

export default async function AdminEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const [logs, suppressions, summary] = await Promise.all([
    listEmailLog(200) as Promise<EmailRow[]>,
    listEmailSuppressions(50) as Promise<SuppressionRow[]>,
    getEmailSummary(),
  ]);
  const active = FILTERS.includes((params.status ?? "all") as (typeof FILTERS)[number])
    ? (params.status ?? "all")
    : "all";
  const rows = active === "all" ? logs : logs.filter((row) => row.status === active);

  const [selectedProvider, setSelectedProvider] = useState<typeof PROVIDERS[number]>("console");
  const [smtpHost, setSmtpHost] = useState<string>("");
  const [smtpPort, setSmtpPort] = useState<number>(587);
  const [smtpSecure, setSmtpSecure] = useState<string>("false");
  const [smtpUser, setSmtpUser] = useState<string>("");
  const [smtpFrom, setSmtpFrom] = useState<string>("");
  const [smtpName, setSmtpName] = useState<string>("");

  useEffect(() => {
    async function loadSettings() {
      try {
        const supabase = createAdminClient();
        const { data } = await supabase
          .from("email_settings")
          .select("email_provider")
          .eq("id", true)
          .maybeSingle();
        if (data?.email_provider && PROVIDERS.includes(data.email_provider)) {
          setSelectedProvider(data.email_provider as typeof PROVIDERS[number]);
        }
      } catch (error) {
        console.error("[admin] failed to load email settings", error);
      }
    }
    loadSettings();
  }, []);

  useEffect(() => {
    if (selectedProvider === "smtp") {
      async function loadSmtpSettings() {
        try {
          const supabase = createAdminClient();
          const { data } = await supabase
            .from("email_settings")
            .select("*")
            .eq("id", true)
            .maybeSingle();
          if (data) {
            setSmtpHost(data.smtp_host || "");
            setSmtpPort(data.smtp_port ?? 587);
            setSmtpSecure(data.smtp_secure ?? false);
            setSmtpUser(data.smtp_user || "");
            setSmtpFrom(data.smtp_from || "");
            setSmtpName(data.smtp_name || "Get-On");
          }
        } catch (error) {
          console.error("[admin] failed to load SMTP settings", error);
        }
      }
      loadSmtpSettings();
    }
  }, [selectedProvider]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const supabase = createAdminClient();
      await supabase.rpc("admin_set_email_provider", {
        p_provider: selectedProvider,
      });

      if (selectedProvider === "smtp") {
        await supabase.rpc("admin_set_smtp_settings", {
          p_host: smtpHost,
          p_port: smtpPort,
          p_secure: smtpSecure === "true",
          p_user: smtpUser,
          p_from: smtpFrom,
          p_name: smtpName,
        });
      }

      // Reload settings
      setSelectedProvider(selectedProvider);
      if (selectedProvider === "smtp") {
        setSmtpHost(smtpHost);
        setSmtpPort(smtpPort);
        setSmtpSecure(smtpSecure);
        setSmtpUser(smtpUser);
        setSmtpFrom(smtpFrom);
        setSmtpName(smtpName);
      }
    } catch (error) {
      console.error("[admin] failed to save email settings", error);
    }
  };

  const resetForm = () => {
    setSelectedProvider("console");
    setSmtpHost("");
    setSmtpPort(587);
    setSmtpSecure("false");
    setSmtpUser("");
    setSmtpFrom("");
    setSmtpName("Get-On");
  };

  return (
    <AppPage width="wide">
      <PageHeader
        title="Email"
        description="Everything Get-On has tried to send. Addresses are masked."
        actions={
          <Link href="/admin" className="text-sm font-semibold text-primary hover:underline">
            Back to overview
          </Link>
        }
      />

      <form
        className="mt-6 space-y-4 max-w-2xl"
        onSubmit={handleSave}
      >
        <div>
          <label className="text-sm font-medium text-text">Email provider</label>
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value as typeof PROVIDERS[number])}
            className="mt-1 block w-full rounded-md border-input p-2"
          >
            {PROVIDERS.map((provider) => (
              <option key={provider} value={provider}>
                {provider[0].toUpperCase() + provider.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {selectedProvider === "smtp" && (
          <div>
            <div>
              <label className="text-sm font-medium text-text">SMTP Host</label>
              <input
                type="text"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                className="mt-1 block w-full rounded-md border-input p-2"
                placeholder="smtp.example.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="text-sm font-medium text-text">SMTP Port</label>
                <input
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(Number(e.target.value))}
                  className="mt-1 block w-full rounded-md border-input p-2"
                  min="1"
                  placeholder="587"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text">SMTP Secure</label>
                <select
                  value={smtpSecure}
                  onChange={(e) => setSmtpSecure((e.target as HTMLSelectElement).value)}
                  className="mt-1 block w-full rounded-md border-input p-2"
                >
                  <option value="true">True (SSL/TLS)</option>
                  <option value="false">False (STARTTLS)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-text">SMTP User</label>
              <input
                type="text"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                className="mt-1 block w-full rounded-md border-input p-2"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text">SMTP From</label>
              <input
                type="text"
                value={smtpFrom}
                onChange={(e) => setSmtpFrom(e.target.value)}
                className="mt-1 block w-full rounded-md border-input p-2"
                placeholder="no-reply@example.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text">SMTP Name</label>
              <input
                type="text"
                value={smtpName}
                onChange={(e) => setSmtpName(e.target.value)}
                className="mt-1 block w-full rounded-md border-input p-2"
                placeholder="Get-On"
              />
            </div>
          </div>
        )}

        <div className="mt-6">
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary/90"
          >
            Save email provider
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="ml-2 rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary hover:bg-secondary/90"
          >
            Reset
          </button>
        </div>
      </form>

      <div className="mt-6 grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-4">
        <AppCard className="p-5">
          <p className="text-sm text-text-muted">Queued</p>
          <p className="text-stat-number mt-1 text-text">{summary.queued ?? 0}</p>
        </AppCard>
        <AppCard className="p-5">
          <p className="text-sm text-text-muted">Sent (24 h)</p>
          <p className="text-stat-number mt-1 text-text">{summary.sent_24h ?? 0}</p>
        </AppCard>
        <AppCard className="p-5">
          <p className="text-sm text-text-muted">Failed (24 h)</p>
          <p className="text-stat-number mt-1 text-text">{summary.failed_24h ?? 0}</p>
        </AppCard>
        <AppCard className="p-5">
          <p className="text-sm text-text-muted">Blocked addresses</p>
          <p className="text-stat-number mt-1 text-text">{summary.suppressions ?? 0}</p>
        </AppCard>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter}
            href={filter === "all" ? "/admin/email" : `/admin/email?status=${filter}`}
            className={
              active === filter
                ? "flex h-9 items-center rounded-pill bg-primary px-3 text-sm font-semibold text-on-primary"
                : "flex h-9 items-center rounded-pill bg-surface-muted px-3 text-sm font-semibold text-text-muted hover:bg-row-hover"
            }
          >
            {filter === "all" ? "All" : filter[0].toUpperCase() + filter.slice(1)}
          </Link>
        ))}
      </div>

      <section className="mt-4">
        <h2 className="sr-only">Email log</h2>
        {rows.length === 0 ? (
          <AppCard className="p-6">
            <p className="text-base text-text-muted">No email matches this filter.</p>
          </AppCard>
        ) : (
          <div className="overflow-hidden rounded-card border border-border bg-surface">
            <ul className="divide-y divide-border">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-col gap-2 p-4 min-[768px]:flex-row min-[768px]:items-start"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                      <span className="text-sm font-semibold text-text">
                        {row.kind ?? "email"}
                      </span>
                      {row.stream ? (
                        <span className="text-xs text-text-muted">{row.stream}</span>
                      ) : null}
                    </div>
                    <p className="mt-1 break-all text-sm text-text-muted">
                      {row.to_email ?? "Unknown address"}
                    </p>
                    {row.last_error ? (
                      <p className="mt-1 break-words text-sm text-danger-text">{row.last_error}</p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-sm text-text-muted min-[768px]:text-right">
                    <p>{relativeTime(row.sent_at ?? row.created_at)}</p>
                    {row.attempts > 0 ? <p className="text-xs">Attempt {row.attempts}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-section-title text-text">Blocked addresses</h2>
        <p className="mt-1 text-sm text-text-muted">
          We do not email these addresses because they bounced or were marked as spam.
        </p>
        {suppressions.length === 0 ? (
          <AppCard className="mt-3 p-6">
            <p className="text-base text-text-muted">No addresses are blocked.</p>
          </AppCard>
        ) : (
          <div className="mt-3 overflow-hidden rounded-card border border-border bg-surface">
            <ul className="divide-y divide-border">
              {suppressions.map((row) => (
                <li
                  key={`${row.email}-${row.created_at}`}
                  className="flex flex-col gap-1 p-4 min-[768px]:flex-row min-[768px]:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="break-all text-sm font-semibold text-text">{row.email}</p>
                    <p className="text-sm text-text-muted">
                      {row.reason === "bounce"
                        ? "The address bounced."
                        : row.reason === "complaint"
                          ? "Marked as spam."
                          : "Blocked by a person."}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm text-text-muted">
                    {relativeTime(row.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </AppPage>
  );
}