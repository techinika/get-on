"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Globe2, Share2 } from "lucide-react";
import { AppCard } from "@/components/app/card";
import { CopyValue } from "@/components/app/copy-value";
import { InfoBox } from "@/components/app/info-box";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import type { Domain, DomainHostname } from "@/lib/domains/types";
import { DomainStatusBadge, HostnameStatusBadge } from "./address-status";
import {
  checkDomainAction,
  refreshAddressAction,
  removeDomainAction,
  saveAddressOptionsAction,
  setMainAddressAction,
} from "./actions";

function statusLine(domain: Domain, hosts: DomainHostname[]): string {
  if (domain.status === "draft" || domain.status === "awaiting_txt") {
    return "Waiting for you to add the verification record.";
  }
  if (domain.status === "verified") return "Choose the address people will use.";
  if (domain.status === "connecting") return "Waiting for the connection record.";
  if (domain.status === "live") {
    const main = hosts.find((host) => host.role === "main" && host.status === "live");
    return main ? "Your website is live on this domain." : "Connected. We are finishing the setup.";
  }
  if (domain.status === "attention") return "Needs attention: the connection record changed.";
  if (domain.status === "stalled") return "Not connected yet. Check the connection record.";
  if (domain.status === "plan_lapsed") return "Paused because your plan no longer includes it.";
  if (domain.status === "paused") return "Paused by our team. Contact support if you need help.";
  return "This domain is not used by a website.";
}

export function AddressManager({
  projectId,
  freeUrl,
  published,
  domains,
  hostnames,
  limit,
  planName,
  canManage,
  redirectFreeAddress,
}: {
  projectId: string;
  freeUrl: string;
  published: boolean;
  domains: Domain[];
  hostnames: DomainHostname[];
  limit: number;
  planName: string;
  canManage: boolean;
  redirectFreeAddress: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [redirect, setRedirectChoice] = useState(redirectFreeAddress);
  const [savingRedirect, setSavingRedirect] = useState(false);

  const mainHost = hostnames.find(
    (host) => host.role === "main" && host.status === "live",
  );
  const countedDomains = domains.filter(
    (domain) =>
      !["draft", "removed", "failed", "plan_lapsed"].includes(domain.status),
  );
  const atLimit = countedDomains.length >= limit;
  const connectHref = `/dashboard/projects/${projectId}/settings/address/connect`;

  async function run(key: string, work: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(key);
    setMessage(null);
    const result = await work();
    setBusy(null);
    if (!result.ok) {
      setMessage(result.error ?? "We could not do that. Please try again.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function share() {
    if (!freeUrl) return;
    try {
      if (navigator.share) await navigator.share({ url: freeUrl });
      else {
        await navigator.clipboard.writeText(freeUrl);
        toast("Copied");
      }
    } catch {
      // The share sheet was closed.
    }
  }

  async function saveRedirect(next: boolean) {
    setRedirectChoice(next);
    setSavingRedirect(true);
    const form = new FormData();
    form.set("redirect_free_address", next ? "true" : "false");
    const result = await saveAddressOptionsAction(projectId, form);
    setSavingRedirect(false);
    if (!result.ok) {
      setRedirectChoice(!next);
      setMessage(result.error);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <AppCard className="max-w-[760px] p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-text-muted">Your free address</p>
        <p className="mt-1 break-all text-xl font-bold text-primary">{freeUrl || "Not available yet"}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <CopyValue value={freeUrl} label="free address" />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!published}
            onClick={() => freeUrl && window.open(freeUrl, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="h-4 w-4" aria-hidden /> Open
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={share}>
            <Share2 className="h-4 w-4" aria-hidden /> Share
          </Button>
        </div>
        {mainHost ? (
          <div className="mt-5 border-t border-border pt-4">
            <Switch
              checked={redirect}
              onCheckedChange={saveRedirect}
              disabled={!canManage || savingRedirect}
              label={`Send visitors from this address to ${mainHost.hostname}`}
              description="Visitors and Google go to your own address. This address keeps working as a redirect."
            />
          </div>
        ) : null}
        <p className="mt-3 text-sm text-text-muted">This address is free and comes with your plan.</p>
      </AppCard>

      <section className="max-w-[760px]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-[17px] font-semibold text-text">Your domains</h2>
          <p className="text-sm text-text-muted">
            {countedDomains.length} of {limit}
          </p>
        </div>

        {limit <= 0 ? (
          <AppCard className="mt-3 border-2 border-dashed border-border-strong p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-accent-soft text-accent-text">
                <Globe2 className="h-6 w-6" aria-hidden />
              </span>
              <div>
                <h3 className="text-[17px] font-semibold text-text">Use your own domain</h3>
                <p className="mt-1 text-[15px] text-text-muted">
                  Use an address like www.yourbusiness.com instead of {freeUrl}. Included from the Basic plan.
                </p>
                <Link href="/dashboard/plan">
                  <Button type="button" className="mt-4">See plans</Button>
                </Link>
              </div>
            </div>
          </AppCard>
        ) : null}

        {limit > 0 && domains.length === 0 ? (
          <AppCard className="mt-3 border-2 border-dashed border-border-strong p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-accent-soft text-accent-text">
                <Globe2 className="h-6 w-6" aria-hidden />
              </span>
              <div>
                <h3 className="text-[17px] font-semibold text-text">Connect a domain</h3>
                <p className="mt-1 text-[15px] text-text-muted">
                  Keep your DNS where it is. We show you the two records to add.
                </p>
                {canManage ? (
                  <Link href={connectHref}>
                    <Button type="button" size="lg" className="mt-4">Connect a domain</Button>
                  </Link>
                ) : null}
              </div>
            </div>
          </AppCard>
        ) : null}

        {domains.map((domain) => {
          const hosts = hostnames.filter((host) => host.domainId === domain.id);
          const needsSetup =
            domain.status === "draft" ||
            domain.status === "awaiting_txt" ||
            domain.status === "verified" ||
            (domain.status === "connecting" && hosts.length === 0);
          return (
            <AppCard
              key={domain.id}
              className={`mt-3 p-5 ${domain.status === "attention" ? "border-l-4 border-l-warning-text" : ""}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-surface-muted text-text-muted">
                    <Globe2 className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/projects/${projectId}/settings/address/domains/${domain.id}`}
                        className="break-all text-[17px] font-semibold text-text hover:text-primary hover:underline"
                      >
                        {domain.displayName}
                      </Link>
                      <DomainStatusBadge status={domain.status} />
                      <Badge variant="primary">{domain.role === "primary" ? "Main domain" : "Also redirects"}</Badge>
                    </div>
                    <p className="mt-1 text-[13px] text-text-muted">{statusLine(domain, hosts)}</p>
                    {domain.status === "plan_lapsed" || domain.status === "paused" ? (
                      <div className="mt-2">
                        <InfoBox variant="warning">
                          Your domain is paused because your plan no longer includes it.{" "}
                          <Link href="/dashboard/plan" className="font-semibold underline">See plans</Link>
                        </InfoBox>
                      </div>
                    ) : null}
                  </div>
                </div>
                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    {needsSetup ? (
                      <Link href={`${connectHref}?domain=${domain.id}`}>
                        <Button type="button" size="sm">Continue setup</Button>
                      </Link>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      loading={busy === `check-${domain.id}`}
                      loadingLabel="Checking..."
                      onClick={() =>
                        void run(`check-${domain.id}`, async () => {
                          const result = await checkDomainAction(projectId, domain.id);
                          return result.ok ? { ok: true } : { ok: false, error: result.error };
                        })
                      }
                    >
                      Check now
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setRemoveId(domain.id)}>
                      Remove
                    </Button>
                  </div>
                ) : null}
              </div>

              {hosts.length > 0 ? (
                <ul className="mt-4 grid gap-2">
                  {hosts.map((host) => (
                    <li key={host.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card bg-surface-muted px-3 py-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <code className="break-all font-mono text-[14px] text-text">{host.hostname}</code>
                        <HostnameStatusBadge status={host.status} />
                        <Badge variant={host.role === "main" ? "primary" : "neutral"}>
                          {host.role === "main" ? "Main address" : "Also redirects"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {canManage && host.role !== "main" && host.status === "live" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            loading={busy === `main-${host.id}`}
                            loadingLabel="Saving..."
                            onClick={() =>
                              void run(`main-${host.id}`, async () => {
                                const result = await setMainAddressAction(projectId, host.id);
                                return result.ok ? { ok: true } : { ok: false, error: result.error };
                              })
                            }
                          >
                            Make main
                          </Button>
                        ) : null}
                        {host.status !== "live" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            loading={busy === `host-${host.id}`}
                            loadingLabel="Checking..."
                            onClick={() =>
                              void run(`host-${host.id}`, async () => {
                                const result = await refreshAddressAction(projectId, host.id);
                                return result.ok ? { ok: true } : { ok: false, error: result.error };
                              })
                            }
                          >
                            Check
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </AppCard>
          );
        })}

        {limit > 0 && domains.length > 0 ? (
          <div className="mt-4">
            {atLimit ? (
              <InfoBox variant="warning">
                Your {planName} plan includes {limit} domain{limit === 1 ? "" : "s"} for each website.{" "}
                <Link href="/dashboard/plan" className="font-semibold underline">See plans</Link>
              </InfoBox>
            ) : canManage ? (
              <Link href={connectHref}>
                <Button type="button" variant="secondary">Connect a domain</Button>
              </Link>
            ) : null}
          </div>
        ) : null}
      </section>

      <AppCard className="max-w-[760px] border-2 border-dashed border-border-strong p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-surface-muted text-text-muted">
            <Globe2 className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[17px] font-semibold text-text">Buy a domain</h2>
              <Badge>Coming soon</Badge>
            </div>
            <p className="mt-1 text-[15px] text-text-muted">
              Soon you will be able to buy and connect a domain here.
            </p>
          </div>
        </div>
      </AppCard>

      {message ? (
        <p className="max-w-[760px] text-sm text-danger-text" role="alert">{message}</p>
      ) : null}

      <Dialog
        open={removeId !== null}
        onClose={() => setRemoveId(null)}
        title="Remove this domain?"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setRemoveId(null)}>Cancel</Button>
            <Button
              type="button"
              variant="danger"
              loading={busy === "remove"}
              loadingLabel="Removing..."
              onClick={() =>
                void run("remove", async () => {
                  const result = await removeDomainAction(projectId, removeId!);
                  if (result.ok) {
                    setRemoveId(null);
                    toast("Domain removed");
                    return { ok: true };
                  }
                  return { ok: false, error: result.error };
                })
              }
            >
              Remove domain
            </Button>
          </>
        }
      >
        <p className="text-[15px] text-text-muted">
          Your website will stop opening on this domain. We will also remove the connection from our side.
        </p>
      </Dialog>
    </div>
  );
}
