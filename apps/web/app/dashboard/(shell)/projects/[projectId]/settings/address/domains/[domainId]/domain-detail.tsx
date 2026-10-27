"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  Globe2,
  Lock,
  Pause,
  Plus,
  Share2,
  Trash2,
} from "lucide-react";
import { AppCard } from "@/components/app/card";
import { CopyValue } from "@/components/app/copy-value";
import { InfoBox } from "@/components/app/info-box";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import {
  recordFullName,
  relativeName,
  verificationRecord,
} from "@/lib/domains/records";
import type { DnsRecord, Domain, DomainHostname } from "@/lib/domains/types";
import type { CaaCheck, HostnameDnsCheck } from "@/lib/domains/diagnostics";
import { CaaNotice } from "../../caa-notice";
import { DnsChecks } from "../../dns-checks";
import { RecordCard } from "../../record-card";
import { DomainStatusBadge, HostnameStatusBadge } from "../../address-status";
import type { DomainEventRow } from "./page";
import {
  addAddressAction,
  checkDomainAction,
  detachDomainAction,
  reassignDomainAction,
  refreshAddressAction,
  removeAddressAction,
  removeDomainAction,
  saveAddressOptionsAction,
  saveAutoPublishAction,
  setMainAddressAction,
} from "../../actions";

type Tab = "overview" | "settings" | "activity";

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

function statusTitle(domain: Domain, hosts: DomainHostname[]): string {
  switch (domain.status) {
    case "draft":
    case "awaiting_txt":
      return `Prove you own ${domain.registrable}`;
    case "verified":
      return hosts.length === 0 ? "Choose how people reach your website" : "Waiting for your connection record";
    case "connecting":
      return hosts.length === 0
        ? "Choose how people reach your website"
        : "Waiting for your connection record";
    case "live":
      return "Your website is live";
    case "attention":
      return "This domain needs attention";
    case "stalled":
      return "Still waiting for your connection record";
    case "plan_lapsed":
    case "paused":
      return "This domain is paused";
    default:
      return "Domain status";
  }
}

function plainReason(domain: Domain): string {
  switch (domain.statusReason) {
    case "cname_missing":
      return "The connection record was removed or changed. Please set it back to the value below so your website works.";
    case "cname_wrong":
      return "The connection record points somewhere else. Please set it back to the value below.";
    case "ssl_failed":
      return "Your secure padlock could not be renewed. We are looking into it.";
    case "health_failed":
      return "We cannot reach your website on this address right now. We will keep checking.";
    case "blocked":
      return "This address was blocked. Please contact us.";
    default:
      return domain.statusReason
        ? "We found a problem with this domain. Check the records below."
        : "Check the records below and try again.";
  }
}

export function DomainDetail({
  projectId,
  domain,
  hosts,
  events,
  freeUrl,
  redirectFreeAddress,
  autoPublish: initialAutoPublish,
  caa,
  dnsChecks,
  websites,
  canManage,
  tab,
}: {
  projectId: string;
  domain: Domain;
  hosts: DomainHostname[];
  events: DomainEventRow[];
  freeUrl: string;
  redirectFreeAddress: boolean;
  autoPublish: boolean;
  caa: CaaCheck | null;
  dnsChecks: HostnameDnsCheck[];
  websites: { id: string; name: string }[];
  canManage: boolean;
  tab: Tab;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingMain, setPendingMain] = useState<DomainHostname | null>(null);
  const [detachOpen, setDetachOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState("");
  const [removeOpen, setRemoveOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const confirmNameRef = useRef<HTMLInputElement>(null);
  const [redirect, setRedirect] = useState(redirectFreeAddress);
  const [savingRedirect, setSavingRedirect] = useState(false);
  const [autoPublish, setAutoPublish] = useState(initialAutoPublish);
  const [savingAutoPublish, setSavingAutoPublish] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addChoice, setAddChoice] = useState<"other" | "custom">("other");
  const [addLabel, setAddLabel] = useState("");
  const [addMode, setAddMode] = useState<"prepare_first" | "switch_now">("prepare_first");
  const [removeHost, setRemoveHost] = useState<DomainHostname | null>(null);

  const addressHref = `/dashboard/projects/${projectId}/settings/address`;
  const connectHref = `${addressHref}/connect?domain=${domain.id}`;
  const liveHost = hosts.find((host) => host.role === "main" && host.status === "live")
    ?? hosts.find((host) => host.status === "live");
  const txt = verificationRecord(domain.registrable, domain.verificationValue);
  const expiryDays = daysUntil(domain.registrar.expiresAt);
  const basePath = `${addressHref}/domains/${domain.id}`;
  const mainLabel = hosts.find((host) => host.role === "main")?.label ?? hosts[0]?.label;
  const otherForm = mainLabel === "www" ? "@" : mainLabel === "@" ? "www" : null;
  const otherHostname =
    otherForm === "@" ? domain.registrable : otherForm ? `www.${domain.registrable}` : "";
  const hasMainAddress = hosts.some((host) => host.role === "main");
  const canAddAddress =
    canManage &&
    ["verified", "connecting", "live", "attention", "stalled"].includes(domain.status) &&
    hosts.length < 2 &&
    (!hasMainAddress || mainLabel === "www" || mainLabel === "@");

  function prepareRecords(host: DomainHostname): DnsRecord[] {
    return [host.ownershipTxt, host.validationTxt].filter(
      (record, index, all): record is DnsRecord =>
        record != null &&
        all.findIndex(
          (item) => item?.name === record.name && item?.value === record.value,
        ) === index,
    );
  }

  function cnameReady(host: DomainHostname): boolean {
    return (
      host.mode !== "prepare_first" ||
      ["ready_to_switch", "active", "live", "moved"].includes(host.status)
    );
  }

  async function checkDomain() {
    setBusy("domain");
    setError(null);
    const result = await checkDomainAction(projectId, domain.id);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast("Checked");
    router.refresh();
  }

  async function checkHost(hostId: string) {
    setBusy(`host-${hostId}`);
    setError(null);
    const result = await refreshAddressAction(projectId, hostId);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast("Checked");
    router.refresh();
  }

  async function makeMain() {
    if (!pendingMain) return;
    setBusy("main");
    const result = await setMainAddressAction(projectId, pendingMain.id);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPendingMain(null);
    toast("Main address changed. Publish to update your sitemap and links.");
    router.refresh();
  }

  async function addAddress() {
    const label =
      addChoice === "other" ? otherForm : addLabel.trim().toLowerCase();
    if (!label) {
      setError("Enter the name you want to use.");
      return;
    }
    setBusy("add");
    setError(null);
    const result = await addAddressAction(
      projectId,
      domain.id,
      label,
      hosts.some((host) => host.role === "main") ? "extra" : "main",
      addMode,
    );
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setAddOpen(false);
    setAddLabel("");
    setAddChoice(otherForm ? "other" : "custom");
    toast(
      addMode === "prepare_first"
        ? "Address added. Add the prepare records below."
        : "Address added",
    );
    router.refresh();
  }

  async function removeAddress() {
    if (!removeHost) return;
    setBusy("remove-address");
    setError(null);
    const result = await removeAddressAction(projectId, removeHost.id);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast(`${removeHost.hostname} was removed.`);
    setRemoveHost(null);
    router.refresh();
  }

  async function saveAutoPublish(next: boolean) {
    setAutoPublish(next);
    setSavingAutoPublish(true);
    setError(null);
    const result = await saveAutoPublishAction(projectId, next);
    setSavingAutoPublish(false);
    if (!result.ok) {
      setAutoPublish(!next);
      setError(result.error);
      return;
    }
    toast("Auto-publish setting saved");
  }

  async function saveRedirect(next: boolean) {
    setRedirect(next);
    setSavingRedirect(true);
    const form = new FormData();
    form.set("redirect_free_address", next ? "true" : "false");
    const result = await saveAddressOptionsAction(projectId, form);
    setSavingRedirect(false);
    if (!result.ok) {
      setRedirect(!next);
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  async function detach() {
    setBusy("detach");
    const result = await detachDomainAction(projectId, domain.id);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDetachOpen(false);
    toast("Domain disconnected");
    router.push(addressHref);
    router.refresh();
  }

  async function move() {
    if (!moveTarget) return;
    setBusy("move");
    const result = await reassignDomainAction(projectId, domain.id, moveTarget);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMoveOpen(false);
    toast("Domain moved to another website");
    router.push(`/dashboard/projects/${moveTarget}/settings/address/domains/${domain.id}`);
    router.refresh();
  }

  async function remove() {
    setBusy("remove");
    const result = await removeDomainAction(projectId, domain.id);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRemoveOpen(false);
    toast(`${domain.displayName} was removed.`);
    router.push(addressHref);
    router.refresh();
  }

  function recordStatus(host: DomainHostname): "found" | "wrong" | "missing" {
    if (host.status === "moved") return "wrong";
    if (host.cnameSeen || host.status === "live") return "found";
    return "missing";
  }

  return (
    <div className="flex flex-col gap-5">
      <Link href={addressHref} className="inline-flex h-11 items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Address
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="break-all text-[22px] font-bold text-text">{domain.displayName}</h1>
          <DomainStatusBadge status={domain.status} />
          <Badge variant={domain.role === "primary" ? "primary" : "neutral"}>
            {domain.role === "primary" ? "Main domain" : "Also redirects"}
          </Badge>
        </div>
        {domain.displayName !== domain.registrable ? (
          <p className="mt-1 font-mono text-xs text-text-muted">{domain.registrable}</p>
        ) : null}
      </header>

      <nav className="flex overflow-x-auto border-b border-border" aria-label="Domain">
        {(["overview", "settings", "activity"] as const).map((item) => (
          <Link
            key={item}
            href={`${basePath}?tab=${item}`}
            aria-current={tab === item ? "page" : undefined}
            className={`flex h-12 shrink-0 items-center border-b-2 px-4 text-sm font-semibold capitalize ${
              tab === item ? "border-primary text-primary" : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {item}
          </Link>
        ))}
      </nav>

      {error ? <p className="text-sm text-danger-text" role="alert">{error}</p> : null}

      {tab === "overview" ? (
        <>
          <AppCard className={`p-5 ${domain.status === "attention" ? "border-l-4 border-l-warning-text" : ""}`} aria-live="polite">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-surface-muted text-text-muted">
                {domain.status === "plan_lapsed" || domain.status === "paused" ? <Pause className="h-5 w-5" aria-hidden /> : <Globe2 className="h-5 w-5" aria-hidden />}
              </span>
              <div className="min-w-0">
                <h2 className="text-[17px] font-semibold text-text">{statusTitle(domain, hosts)}</h2>
                <p className="mt-1 text-sm leading-5 text-text-muted">
                  {domain.status === "draft" || domain.status === "awaiting_txt"
                    ? "Add the verification record below, then check again."
                    : domain.status === "verified"
                      ? "Choose the address people will use for your website."
                      : domain.status === "connecting"
                        ? hosts.length === 0
                          ? "Choose the address people will use for your website."
                          : "Add the connection record below. We check it automatically."
                        : domain.status === "live"
                          ? liveHost ? `${liveHost.hostname} is connected.` : "This domain is connected."
                          : domain.status === "plan_lapsed"
                            ? "Your domain is paused because your plan no longer includes it."
                            : domain.status === "paused"
                              ? "Our team paused this domain. Contact support if you need help."
                            : domain.status === "attention" || domain.status === "stalled"
                              ? plainReason(domain)
                              : plainReason(domain)}
                </p>

                {(domain.status === "draft" || domain.status === "awaiting_txt") ? (
                  <div className="mt-4 grid gap-3">
                    <RecordCard
                      type="TXT"
                      title={`Prove you own ${domain.registrable}`}
                      name={txt.name}
                      fullName={recordFullName(txt, domain.registrable)}
                      value={txt.value}
                      status={domain.verifiedAt ? "found" : "missing"}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Link href={connectHref}><Button type="button" size="sm">Continue setup</Button></Link>
                      <Button type="button" size="sm" variant="secondary" onClick={checkDomain} loading={busy === "domain"} loadingLabel="Checking...">
                        Check now
                      </Button>
                    </div>
                  </div>
                ) : null}

                {hosts.length === 0 && (domain.status === "verified" || domain.status === "connecting") ? (
                  <Link href={connectHref}><Button type="button" size="sm" className="mt-4">Choose an address</Button></Link>
                ) : null}

                {(domain.status === "connecting" || domain.status === "attention" || domain.status === "stalled") && hosts.length > 0 ? (
                  <div className="mt-4 grid gap-3">
                    {hosts.map((host) => {
                      const record = { type: "CNAME" as const, name: relativeName(host.hostname, domain.registrable), value: host.cnameTarget };
                      const prepare = prepareRecords(host);
                      return (
                        <div key={host.id} className="grid gap-3">
                          {prepare.map((item) => (
                            <RecordCard
                              key={`${host.id}-${item.name}`}
                              type="TXT"
                              title={`Prepare ${host.hostname}`}
                              name={item.name}
                              fullName={recordFullName(item, domain.registrable)}
                              value={item.value}
                              status="optional"
                            />
                          ))}
                          {cnameReady(host) ? (
                            <RecordCard
                              type="CNAME"
                              title={`Connect ${host.hostname}`}
                              name={record.name}
                              fullName={recordFullName(record, domain.registrable)}
                              value={record.value}
                              status={recordStatus(host)}
                              onCheck={() => void checkHost(host.id)}
                              checking={busy === `host-${host.id}`}
                            />
                          ) : (
                            <InfoBox variant="info">
                              Wait until we say it is ready, then add the connection
                              record for {host.hostname}.
                            </InfoBox>
                          )}
                        </div>
                      );
                    })}
                    {caa?.blocking ? (
                      <CaaNotice records={caa.suggested} registrable={domain.registrable} />
                    ) : null}
                    <DnsChecks checks={dnsChecks} />
                    <div>
                      <Button type="button" size="sm" variant="secondary" onClick={checkDomain} loading={busy === "domain"} loadingLabel="Checking...">
                        Check now
                      </Button>
                    </div>
                  </div>
                ) : null}

                {domain.status === "live" && liveHost ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <CopyValue value={`https://${liveHost.hostname}`} label="website address" />
                    <Button type="button" size="sm" variant="secondary" onClick={() => window.open(`https://${liveHost.hostname}`, "_blank", "noopener,noreferrer")}>
                      <ExternalLink className="h-4 w-4" aria-hidden /> Open
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        const url = `https://${liveHost.hostname}`;
                        try {
                          if (navigator.share) await navigator.share({ url });
                          else {
                            await navigator.clipboard.writeText(url);
                            toast("Copied");
                          }
                        } catch {
                          // The share sheet was closed.
                        }
                      }}
                    >
                      <Share2 className="h-4 w-4" aria-hidden /> Share
                    </Button>
                  </div>
                ) : null}

                {hosts.some(
                  (host) => host.status !== "live" && host.mode === "prepare_first",
                ) ? (
                  <InfoBox variant="info" className="mt-4">
                    We are preparing another address. Add its TXT records under Your
                    records below. We will tell you when it is ready to switch.
                  </InfoBox>
                ) : null}

                {domain.status === "plan_lapsed" ? (
                  <Link href="/dashboard/plan"><Button type="button" size="sm" className="mt-4">See plans</Button></Link>
                ) : null}
              </div>
            </div>
          </AppCard>

          <AppCard className="p-5">
            <h2 className="text-[17px] font-semibold text-text">Your records</h2>
            <p className="mt-1 text-sm text-text-muted">
              These are the records that connect {domain.registrable}. Keep the connection records in place.
            </p>
            <div className="mt-4 grid gap-3">
              <RecordCard
                type="TXT"
                title={`Prove you own ${domain.registrable}`}
                name={txt.name}
                fullName={recordFullName(txt, domain.registrable)}
                value={txt.value}
                status={domain.verifiedAt ? "found" : "missing"}
                onCheck={checkDomain}
                checking={busy === "domain"}
              />
              {hosts.map((host) => {
                const record = { type: "CNAME" as const, name: relativeName(host.hostname, domain.registrable), value: host.cnameTarget };
                const prepare = prepareRecords(host);
                return (
                  <div key={host.id} className="grid gap-3">
                    {host.status !== "live"
                      ? prepare.map((item) => (
                          <RecordCard
                            key={`${host.id}-${item.name}`}
                            type="TXT"
                            title={`Prepare ${host.hostname}`}
                            name={item.name}
                            fullName={recordFullName(item, domain.registrable)}
                            value={item.value}
                            status="optional"
                          />
                        ))
                      : null}
                    {cnameReady(host) ? (
                      <RecordCard
                        type="CNAME"
                        title={`Connect ${host.hostname}`}
                        name={record.name}
                        fullName={recordFullName(record, domain.registrable)}
                        value={record.value}
                        status={recordStatus(host)}
                        onCheck={() => void checkHost(host.id)}
                        checking={busy === `host-${host.id}`}
                      />
                    ) : (
                      <InfoBox variant="info">
                        Wait until we say it is ready, then add the connection
                        record for {host.hostname}.
                      </InfoBox>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[13px] text-text-muted">
              You can remove the verification record once your website is live, but keeping it is fine.
            </p>
          </AppCard>

          <AppCard className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[17px] font-semibold text-text">Addresses</h2>
              {canAddAddress ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setAddChoice(otherForm ? "other" : "custom");
                    setAddOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" aria-hidden /> Add an address
                </Button>
              ) : null}
            </div>
            {hosts.length === 0 ? (
              <p className="mt-2 text-sm text-text-muted">No addresses yet.</p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {hosts.map((host) => (
                  <li key={host.id} className="flex min-h-16 flex-wrap items-center justify-between gap-2 rounded-card bg-surface-muted px-3 py-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <code className="break-all font-mono text-[15px] font-semibold text-text">{host.hostname}</code>
                      <HostnameStatusBadge status={host.status} />
                      <Badge variant={host.role === "main" ? "primary" : "neutral"}>
                        {host.role === "main" ? "Main address" : "Also redirects"}
                      </Badge>
                      {host.mode === "prepare_first" && host.status !== "live" ? (
                        <Badge variant="draft">Preparing</Badge>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {host.status === "live" ? (
                        <Button type="button" size="sm" variant="ghost" onClick={() => window.open(`https://${host.hostname}`, "_blank", "noopener,noreferrer")}>
                          Open
                        </Button>
                      ) : null}
                      {canManage && host.role !== "main" && host.status === "live" ? (
                        <Button type="button" size="sm" variant="ghost" onClick={() => setPendingMain(host)}>
                          Make main address
                        </Button>
                      ) : null}
                      {canManage ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-danger-text"
                          onClick={() => setRemoveHost(host)}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </AppCard>

          <AppCard className="p-5">
            <h2 className="text-[17px] font-semibold text-text">Domain info</h2>
            <dl className="mt-3 grid gap-2 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-text-muted">Registered with</dt>
                <dd className="font-medium text-text">{domain.registrar.name ?? "Your domain provider"}</dd>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="text-text-muted">Expires</dt>
                <dd className="flex items-center gap-2 font-medium text-text">
                  {formatDate(domain.registrar.expiresAt)}
                  {expiryDays !== null && expiryDays <= 30 ? (
                    <Badge variant={expiryDays <= 7 ? "danger" : "draft"}>
                      {expiryDays <= 7 ? "Renew now" : "Renew soon"}
                    </Badge>
                  ) : null}
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-text-muted">Added</dt>
                <dd className="font-medium text-text">{formatDate(domain.createdAt)}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-text-muted">Verified</dt>
                <dd className="font-medium text-text">{formatDate(domain.verifiedAt)}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-text-muted">Last checked</dt>
                <dd className="font-medium text-text">{domain.lastCheckedAt ? formatDateTime(domain.lastCheckedAt) : "Not yet"}</dd>
              </div>
            </dl>
            {expiryDays !== null && expiryDays <= 30 ? (
              <InfoBox variant={expiryDays <= 7 ? "danger" : "warning"} className="mt-4">
                Your domain expires on {formatDate(domain.registrar.expiresAt)}. Renew it with your registrar so your website stays online.
              </InfoBox>
            ) : null}
          </AppCard>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={checkDomain} loading={busy === "domain"} loadingLabel="Checking...">
              Check now
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!liveHost}
              onClick={() => liveHost && window.open(`https://${liveHost.hostname}`, "_blank", "noopener,noreferrer")}
            >
              Open website
            </Button>
          </div>
        </>
      ) : null}

      {tab === "settings" ? (
        <>
          <AppCard className="p-5">
            <h2 className="text-[17px] font-semibold text-text">Main address</h2>
            <p className="mt-1 text-sm text-text-muted">
              Visitors and Google use this address. Your other addresses send visitors here.
            </p>
            {hosts.length === 0 ? (
              <p className="mt-3 text-sm text-text-muted">Connect an address first.</p>
            ) : (
              <div className="mt-3 grid gap-2" role="radiogroup" aria-label="Main address">
                {hosts.map((host) => {
                  const selectable = host.status === "live";
                  return (
                    <label
                      key={host.id}
                      className={`flex min-h-11 items-center gap-3 rounded-card border p-3 ${
                        host.role === "main" ? "border-primary bg-primary-soft" : "border-border"
                      } ${selectable ? "cursor-pointer" : "opacity-60"}`}
                    >
                      <input
                        type="radio"
                        name="main-address"
                        checked={host.role === "main"}
                        disabled={!canManage || !selectable}
                        onChange={() => setPendingMain(host)}
                        className="h-[20px] w-[20px] accent-primary"
                      />
                      <span className="min-w-0 flex-1">
                        <code className="break-all font-mono text-[15px] font-semibold text-text">{host.hostname}</code>
                        <span className="mt-1 block"><HostnameStatusBadge status={host.status} /></span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            <p className="mt-2 text-xs text-text-muted">Only live addresses can be chosen.</p>
          </AppCard>

          {liveHost ? (
            <AppCard className="p-5">
              <Switch
                checked={redirect}
                onCheckedChange={saveRedirect}
                disabled={!canManage || savingRedirect}
                label="Redirect from my free address"
                description={`Visitors who use ${freeUrl} are sent to ${liveHost.hostname}.`}
              />
            </AppCard>
          ) : null}

          <AppCard className="p-5">
            <Switch
              checked={autoPublish}
              onCheckedChange={saveAutoPublish}
              disabled={!canManage || savingAutoPublish}
              label="Publish automatically when this address goes live"
              description="We only do this if you have no unfinished changes."
            />
          </AppCard>

          <AppCard className="p-5">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-5 w-5 text-text-muted" aria-hidden />
              <div>
                <h2 className="text-[17px] font-semibold text-text">Secure connection (HTTPS)</h2>
                <p className="mt-1 text-sm text-text-muted">
                  Always on. Visitors are sent to the secure version automatically.
                </p>
              </div>
            </div>
          </AppCard>

          {canManage ? (
            <AppCard className="border-l-4 border-l-danger p-5">
              <h2 className="text-[17px] font-semibold text-danger-text">Danger area</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={websites.length === 0}
                  onClick={() => setMoveOpen(true)}
                >
                  Move to another website
                </Button>
                <Button type="button" variant="secondary" onClick={() => setDetachOpen(true)}>
                  Disconnect from this website
                </Button>
                <Button type="button" variant="danger" onClick={() => setRemoveOpen(true)}>
                  Remove this domain from Get-On
                </Button>
              </div>
            </AppCard>
          ) : null}
        </>
      ) : null}

      {tab === "activity" ? (
        <AppCard className="p-0">
          {events.length === 0 ? (
            <p className="p-6 text-sm text-text-muted">Nothing has happened yet.</p>
          ) : (
            <ul>
              {events.map((event) => (
                <li key={event.id} className="flex items-start gap-3 border-b border-border p-4 last:border-b-0">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-text-muted">
                    <Globe2 className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-text">{event.summary}</p>
                    <p className="mt-0.5 text-sm text-text-muted">Automatically · {formatDateTime(event.created_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </AppCard>
      ) : null}

      <Dialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add another address?"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={addAddress}
              loading={busy === "add"}
              loadingLabel="Adding..."
              disabled={addChoice === "custom" && !addLabel.trim()}
            >
              Add address
            </Button>
          </>
        }
      >
        <p className="text-[15px] text-text-muted">
          {hosts.some((host) => host.role === "main")
            ? "Visitors who use another address are sent to your main address."
            : "Choose the main address people will use for your website."}
        </p>
        <div className="mt-4 grid gap-2" role="radiogroup" aria-label="Address">
          {otherForm ? (
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-card border border-border p-3">
              <input
                type="radio"
                name="add-address"
                checked={addChoice === "other"}
                onChange={() => setAddChoice("other")}
                className="h-[20px] w-[20px] accent-primary"
              />
              <code className="break-all font-mono text-[15px] font-semibold text-text">
                {otherHostname}
              </code>
            </label>
          ) : null}
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-card border border-border p-3">
            <input
              type="radio"
              name="add-address"
              checked={addChoice === "custom"}
              onChange={() => setAddChoice("custom")}
              className="h-[20px] w-[20px] accent-primary"
            />
            <span className="text-sm font-semibold text-text">A different name</span>
          </label>
        </div>
        {addChoice === "custom" ? (
          <div className="mt-3 flex items-center gap-1">
            <Input
              value={addLabel}
              onChange={(event) => setAddLabel(event.target.value)}
              aria-label="Name"
              placeholder="shop"
              className="max-w-[180px]"
            />
            <span className="text-sm text-text-muted">.{domain.registrable}</span>
          </div>
        ) : null}
        <p className="mt-5 text-sm font-semibold text-text">How do you want to switch?</p>
        <div className="mt-2 grid gap-2" role="radiogroup" aria-label="Switch method">
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-card border border-border p-3">
            <input
              type="radio"
              name="add-mode"
              checked={addMode === "prepare_first"}
              onChange={() => setAddMode("prepare_first")}
              className="mt-1 h-[20px] w-[20px] accent-primary"
            />
            <span>
              <span className="block text-sm font-semibold text-text">Prepare first (recommended)</span>
              <span className="mt-0.5 block text-sm text-text-muted">
                Keeps any existing website online while we prepare the secure connection.
              </span>
            </span>
          </label>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-card border border-border p-3">
            <input
              type="radio"
              name="add-mode"
              checked={addMode === "switch_now"}
              onChange={() => setAddMode("switch_now")}
              className="mt-1 h-[20px] w-[20px] accent-primary"
            />
            <span>
              <span className="block text-sm font-semibold text-text">Switch now</span>
              <span className="mt-0.5 block text-sm text-text-muted">
                Visitors may see an error for a few minutes while we connect it.
              </span>
            </span>
          </label>
        </div>
      </Dialog>

      <Dialog
        open={removeHost !== null}
        onClose={() => setRemoveHost(null)}
        title={`Remove ${removeHost?.hostname ?? "this address"}?`}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setRemoveHost(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={removeAddress}
              loading={busy === "remove-address"}
              loadingLabel="Removing..."
            >
              Remove address
            </Button>
          </>
        }
      >
        <p className="text-[15px] text-text-muted">
          This address stops opening your website. Your domain and other addresses stay
          connected.
        </p>
        {removeHost?.role === "main" ? (
          <InfoBox variant="warning" className="mt-4">
            {hosts.some((host) => host.id !== removeHost.id && host.status === "live")
              ? "Another live address will become your main address."
              : "Your website will use its free address until you add a new main address."}
          </InfoBox>
        ) : null}
        <p className="mt-4 text-sm text-text-muted">
          You can delete the connection record for this address at your DNS provider.
        </p>
      </Dialog>

      <Dialog
        open={pendingMain !== null}
        onClose={() => setPendingMain(null)}
        title="Change your main address?"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setPendingMain(null)}>Cancel</Button>
            <Button type="button" onClick={makeMain} loading={busy === "main"} loadingLabel="Saving...">Change address</Button>
          </>
        }
      >
        <p className="text-[15px] text-text-muted">
          Visitors and Google will move to {pendingMain?.hostname}. This can take a few days to show in search results.
        </p>
      </Dialog>

      <Dialog
        open={moveOpen}
        onClose={() => { setMoveOpen(false); setMoveTarget(""); }}
        title="Move to another website?"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => { setMoveOpen(false); setMoveTarget(""); }}>Cancel</Button>
            <Button type="button" onClick={move} disabled={!moveTarget} loading={busy === "move"} loadingLabel="Moving...">
              Move domain
            </Button>
          </>
        }
      >
        <p className="text-[15px] text-text-muted">
          The old website stops using this domain. Visitors will go to the website you choose here.
        </p>
        <label htmlFor="move-website" className="mt-4 block text-sm font-semibold text-text">
          Website
        </label>
        <select
          id="move-website"
          value={moveTarget}
          onChange={(event) => setMoveTarget(event.target.value)}
          className="mt-2 h-11 w-full rounded-card border border-border bg-surface px-3 text-[15px] text-text"
        >
          <option value="">Choose a website</option>
          {websites.map((website) => (
            <option key={website.id} value={website.id}>{website.name}</option>
          ))}
        </select>
      </Dialog>

      <Dialog
        open={detachOpen}
        onClose={() => setDetachOpen(false)}
        title={`Disconnect ${domain.registrable}?`}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setDetachOpen(false)}>Cancel</Button>
            <Button type="button" variant="danger" onClick={detach} loading={busy === "detach"} loadingLabel="Disconnecting...">
              Disconnect
            </Button>
          </>
        }
      >
        <p className="text-[15px] text-text-muted">
          Your website will no longer open on this domain. You can connect it to another website later.
        </p>
      </Dialog>

      <Dialog
        open={removeOpen}
        onClose={() => { setRemoveOpen(false); setConfirmName(""); }}
        title={`Remove ${domain.registrable} from Get-On?`}
        initialFocusRef={confirmNameRef}
        icon={
          <span className="flex h-12 w-12 items-center justify-center rounded-card bg-danger-soft text-danger-text">
            <Trash2 className="h-6 w-6" aria-hidden />
          </span>
        }
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => { setRemoveOpen(false); setConfirmName(""); }}>Cancel</Button>
            <Button
              type="button"
              variant="danger"
              onClick={remove}
              disabled={confirmName.trim().toLowerCase() !== domain.registrable}
              loading={busy === "remove"}
              loadingLabel="Removing..."
            >
              Remove domain
            </Button>
          </>
        }
      >
        <p className="text-[15px] text-text-muted">
          Your website will stop opening on this domain. We will also remove the connection from our side.
        </p>
        <p className="mt-4 text-sm text-text-muted">After this, you can delete these records at your DNS provider:</p>
        <ul className="mt-2 grid gap-1">
          <li><CopyValue value={txt.name} label="TXT name" /></li>
          {hosts.map((host) => (
            <li key={host.id}><CopyValue value={relativeName(host.hostname, domain.registrable)} label="CNAME name" /></li>
          ))}
        </ul>
        <InfoBox variant="warning" className="mt-4">
          If you leave the connection record in place, visitors will see an error page on that address until you delete it.
        </InfoBox>
        <label htmlFor="confirm-domain" className="mt-4 block text-sm font-semibold text-text">
          Type {domain.registrable} to confirm
        </label>
        <Input
          id="confirm-domain"
          ref={confirmNameRef}
          value={confirmName}
          onChange={(event) => setConfirmName(event.target.value)}
          className="mt-2"
          autoComplete="off"
        />
      </Dialog>
    </div>
  );
}
