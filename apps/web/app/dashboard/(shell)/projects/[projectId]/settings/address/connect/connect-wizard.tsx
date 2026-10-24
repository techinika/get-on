"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  Circle,
  Share2,
} from "lucide-react";
import { AppCard } from "@/components/app/card";
import { CopyValue } from "@/components/app/copy-value";
import { InfoBox } from "@/components/app/info-box";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  recordFullName,
  relativeName,
  verificationRecord,
} from "@/lib/domains/records";
import type { Domain, DomainHostname } from "@/lib/domains/types";
import { RecordCard } from "../record-card";
import { HostnameStatusBadge } from "../address-status";
import {
  addAddressAction,
  removeDomainAction,
  refreshAddressAction,
  startDomainAction,
  verifyDomainAction,
} from "../actions";

type Step = 1 | 2 | 3 | 4;
type Choice = "www" | "bare" | "custom";

const STEPS = ["Your domain", "Choose your address", "Prove it is yours", "Connect your website"];

function initialStep(domain: Domain | null, hosts: DomainHostname[]): Step {
  if (!domain) return 1;
  if (hosts.length === 0) return 2;
  if (!domain.verifiedAt) return 3;
  return 4;
}

function stripInput(value: string): string {
  let host = value.trim().toLowerCase();
  const scheme = host.indexOf("://");
  if (scheme >= 0) host = host.slice(scheme + 3);
  host = host.split(/[/?#]/, 1)[0] ?? "";
  host = host.replace(/:\d+$/, "").replace(/\.$/, "");
  return host;
}

function formatDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function formatTime(value: Date | null): string {
  if (!value) return "not yet";
  return value.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function StepIndicator({ step }: { step: Step }) {
  return (
    <div className="mt-3 flex items-center gap-2" aria-label={`Step ${step} of 4: ${STEPS[step - 1]}`}>
      {STEPS.map((name, index) => {
        const number = (index + 1) as Step;
        const state = number < step ? "done" : number === step ? "current" : "waiting";
        return (
          <span
            key={name}
            className={`h-2 rounded-pill transition-all ${
              state === "current" ? "w-6 bg-primary" : state === "done" ? "w-2 bg-success" : "w-2 bg-border-strong"
            }`}
          />
        );
      })}
      <span className="ml-1 text-[13px] text-text-muted">
        Step {step} of 4: {STEPS[step - 1]}
      </span>
    </div>
  );
}

function Stepper({ verified, connected, live }: { verified: boolean; connected: boolean; live: boolean }) {
  const rows = [
    { title: "Verification record found", done: verified, waiting: !verified },
    { title: "Connection record found", done: connected, waiting: !connected },
    { title: "Secure padlock (HTTPS) ready", done: live, waiting: !live, helper: "Usually a few minutes after your record is found." },
    { title: "Website connected", done: live, waiting: !live },
  ];
  return (
    <ol className="mt-6 grid gap-5" aria-live="polite">
      {rows.map((row) => (
        <li key={row.title} className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
              row.done
                ? "border-success bg-success text-white"
                : "border-border-strong bg-surface text-text-muted"
            }`}
          >
            {row.done ? <Check className="h-4 w-4" aria-hidden /> : <Circle className="h-3 w-3" aria-hidden />}
          </span>
          <div>
            <p className="text-[15px] font-semibold text-text">{row.title}</p>
            {row.helper ? <p className="mt-0.5 text-sm text-text-muted">{row.helper}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ConnectWizard({
  projectId,
  initialDomain,
  initialHosts,
  freeUrl,
  published,
}: {
  projectId: string;
  initialDomain: Domain | null;
  initialHosts: DomainHostname[];
  freeUrl: string;
  published: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [domain, setDomain] = useState<Domain | null>(initialDomain);
  const [hosts, setHosts] = useState<DomainHostname[]>(initialHosts);
  const [step, setStep] = useState<Step>(() => initialStep(initialDomain, initialHosts));
  const [input, setInput] = useState("");
  const [choice, setChoice] = useState<Choice>("www");
  const [customLabel, setCustomLabel] = useState("");
  const [alsoConnect, setAlsoConnect] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const addressHref = `/dashboard/projects/${projectId}/settings/address`;
  const verified = Boolean(domain?.verifiedAt);
  const liveHost = hosts.find((host) => host.role === "main" && host.status === "live")
    ?? hosts.find((host) => host.status === "live");

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (step !== 3 || !domain || domain.verifiedAt) return;
    let cancelled = false;
    const started = Date.now();
    async function tick() {
      if (cancelled || Date.now() - started > 10 * 60 * 1000) return;
      const result = await verifyDomainAction(projectId, domain!.id);
      if (cancelled) return;
      setLastChecked(new Date());
      if (result.ok) {
        setDomain(result.data.domain);
        if (result.data.domain.verifiedAt) {
          setNotice("Domain verified");
          setStep(4);
        } else if (result.data.status === "wrong") {
          setNotice("We found a record, but the value is different. Copy the value again.");
        }
      }
    }
    const timer = window.setInterval(() => void tick(), 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [step, domain, projectId]);

  async function start() {
    setBusy("start");
    setError(null);
    const result = await startDomainAction(projectId, input);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDomain(result.data);
    setInput(result.data.displayName);
    router.replace(`?domain=${result.data.id}`);
  }

  async function addAddress() {
    if (!domain) return;
    const label =
      choice === "www" ? "www" : choice === "bare" ? "@" : customLabel.trim().toLowerCase();
    if (choice === "custom" && !label) {
      setError("Enter the name you want to use.");
      return;
    }
    setBusy("address");
    setError(null);
    const main = await addAddressAction(projectId, domain.id, label, "main", "switch_now");
    if (!main.ok) {
      setBusy(null);
      setError(main.error);
      return;
    }
    const added = [main.data];
    if (alsoConnect && choice !== "custom") {
      const other = choice === "www" ? "@" : "www";
      const extra = await addAddressAction(projectId, domain.id, other, "extra", "switch_now");
      if (!extra.ok) {
        setBusy(null);
        setError(extra.error);
        setHosts(added);
        return;
      }
      added.push(extra.data);
    }
    setHosts(added);
    setBusy(null);
    setStep(domain.verifiedAt ? 4 : 3);
  }

  async function checkTxt() {
    if (!domain) return;
    setBusy("txt");
    setError(null);
    const result = await verifyDomainAction(projectId, domain.id);
    setBusy(null);
    setLastChecked(new Date());
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDomain(result.data.domain);
    if (result.data.domain.verifiedAt) {
      setNotice("Domain verified");
      setStep(4);
    } else if (result.data.status === "wrong") {
      setNotice("We found a record, but the value is different. Copy the value again.");
    } else {
      setNotice("We have not found the record yet. It can take a few minutes to show up.");
    }
  }

  async function checkHost(hostId: string) {
    setBusy(`host-${hostId}`);
    setError(null);
    const result = await refreshAddressAction(projectId, hostId);
    setBusy(null);
    setLastChecked(new Date());
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setHosts((current) => current.map((host) => (host.id === hostId ? result.data : host)));
    if (result.data.status === "live") {
      toast("Your website is live");
      router.refresh();
    }
  }

  async function checkAll() {
    setBusy("all");
    for (const host of hosts) {
      if (host.status === "live") continue;
      const result = await refreshAddressAction(projectId, host.id);
      if (result.ok) {
        setHosts((current) => current.map((item) => (item.id === host.id ? result.data : item)));
      }
    }
    setBusy(null);
    setLastChecked(new Date());
    router.refresh();
  }

  async function removeDraft() {
    if (!domain) return;
    setBusy("delete");
    const result = await removeDomainAction(projectId, domain.id);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setConfirmDelete(false);
    setDomain(null);
    setHosts([]);
    setInput("");
    setStep(1);
    router.replace(addressHref);
  }

  const hostnamePreview = stripInput(input);
  const txtRecord = domain
    ? verificationRecord(domain.registrable, domain.verificationValue)
    : null;
  const removable = domain && ["draft", "awaiting_txt", "verified"].includes(domain.status);

  return (
    <div>
      <h1 className="mt-2 text-[28px] font-bold text-text">Connect your domain</h1>
      <StepIndicator step={step} />

      <AppCard className="mt-6 p-6 sm:p-8">
        <h2 ref={headingRef} tabIndex={-1} className="text-[22px] font-bold text-text outline-none" aria-live="polite">
          {step === 1 ? "What is your domain?" : null}
          {step === 2 ? "Which address should open your website?" : null}
          {step === 3 && domain ? `First, prove you own ${domain.registrable}` : null}
          {step === 4 && liveHost ? `Your website is live on ${liveHost.hostname}!` : null}
          {step === 4 && !liveHost ? `Now connect ${hosts[0]?.hostname ?? "your address"}` : null}
        </h2>

        {step === 1 ? (
          <div className="mt-4">
            <p className="text-[15px] text-text-muted">
              Enter the domain you own, like example.com. You can also enter an address like shop.example.com.
            </p>
            <label htmlFor="domain-input" className="mt-5 block text-sm font-semibold text-text">
              Your domain
            </label>
            <Input
              id="domain-input"
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                setError(null);
                setDomain(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && input.trim() && !busy) void start();
              }}
              autoFocus
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="yourbusiness.com"
              className="mt-2 h-14 text-lg"
            />
            {hostnamePreview ? (
              <p className="mt-3 inline-flex rounded-pill bg-surface-muted px-3 py-1.5 text-[13px] text-text-muted">
                We will use the domain: <span className="ml-1 font-semibold text-text">{hostnamePreview}</span>
              </p>
            ) : null}
            {domain ? (
              <div className="mt-5 rounded-card bg-surface-muted p-4 text-sm">
                <p className="font-semibold text-text">Looks good</p>
                <dl className="mt-3 grid gap-2">
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-text-muted">Registered with</dt>
                    <dd className="font-medium text-text">{domain.registrar.name ?? "Your domain provider"}</dd>
                  </div>
                  {domain.registrar.expiresAt ? (
                    <div className="flex flex-wrap justify-between gap-2">
                      <dt className="text-text-muted">Expires</dt>
                      <dd className="font-medium text-text">{formatDate(domain.registrar.expiresAt)}</dd>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-text-muted">DNS settings</dt>
                    <dd className="font-medium text-text">{domain.dnsProviderHint ?? "At your domain provider"}</dd>
                  </div>
                </dl>
              </div>
            ) : null}
            <p className="mt-4 text-sm text-text-muted">
              You keep your domain and your DNS settings. We only ask you to add two records.
            </p>
          </div>
        ) : null}

        {step === 2 && domain ? (
          <div className="mt-4">
            <p className="text-[15px] text-text-muted">
              This is the address people will type to reach your website.
            </p>
            <div className="mt-5 grid gap-3" role="radiogroup" aria-label="Address">
              {[
                { id: "www" as const, title: `www.${domain.registrable}`, helper: "Works with every domain provider.", recommended: true },
                { id: "bare" as const, title: domain.registrable, helper: "No www. Your provider must allow an ALIAS, ANAME or CNAME at the bare domain. If it does not, choose www." },
                { id: "custom" as const, title: "A different name", helper: "Use another name, like shop or booking." },
              ].map((option) => (
                <label
                  key={option.id}
                  className={`flex min-h-[88px] cursor-pointer items-start gap-3 rounded-card border-[1.5px] p-4 transition-colors ${
                    choice === option.id
                      ? "border-2 border-primary bg-primary-soft"
                      : "border-border-strong bg-surface hover:bg-surface-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name="address-choice"
                    value={option.id}
                    checked={choice === option.id}
                    onChange={() => {
                      setChoice(option.id);
                      setAlsoConnect(option.id === "www");
                      setError(null);
                    }}
                    className="mt-1 h-[22px] w-[22px] accent-primary"
                  />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="break-all text-[15px] font-semibold text-text">{option.title}</span>
                      {option.recommended ? <Badge variant="accent">Recommended</Badge> : null}
                    </span>
                    <span className="mt-1 block text-sm text-text-muted">{option.helper}</span>
                    {option.id === "custom" && choice === "custom" ? (
                      <span className="mt-3 flex items-center gap-1">
                        <Input
                          value={customLabel}
                          onChange={(event) => setCustomLabel(event.target.value)}
                          aria-label="Name"
                          placeholder="shop"
                          className="max-w-[180px]"
                        />
                        <span className="text-sm text-text-muted">.{domain.registrable}</span>
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>

            {choice !== "custom" ? (
              <label className="mt-5 flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={alsoConnect}
                  onChange={(event) => setAlsoConnect(event.target.checked)}
                  className="mt-1 h-[18px] w-[18px] accent-primary"
                />
                <span>
                  <span className="block font-semibold text-text">
                    Also connect {choice === "www" ? domain.registrable : `www.${domain.registrable}`} and send visitors here
                  </span>
                  <span className="mt-0.5 block text-text-muted">
                    People who type {choice === "www" ? domain.registrable : `www.${domain.registrable}`} still arrive.
                  </span>
                </span>
              </label>
            ) : null}
            <p className="mt-3 text-sm text-text-muted">You can change this later.</p>
          </div>
        ) : null}

        {step === 3 && domain && txtRecord ? (
          <div className="mt-4">
            <p className="text-[15px] leading-6 text-text-muted">
              Add this record in your DNS settings. It is a short note that only the owner of the domain can add.
            </p>
            {verified ? (
              <p className="mt-5 flex items-center gap-2 rounded-card bg-success-soft p-4 text-sm font-semibold text-success-text" aria-live="polite">
                <CheckCircle2 className="h-5 w-5" aria-hidden /> Domain verified
              </p>
            ) : (
              <>
                <div className="mt-5">
                  <RecordCard
                    type="TXT"
                    title={`Prove you own ${domain.registrable}`}
                    name={txtRecord.name}
                    fullName={recordFullName(txtRecord, domain.registrable)}
                    value={txtRecord.value}
                    status="missing"
                  />
                </div>
                <div className="mt-4 rounded-card bg-surface-muted p-4">
                  <p className="font-semibold text-text">Where do I add this?</p>
                  <ol className="mt-3 grid gap-2 text-[15px] leading-6 text-text-muted">
                    <li>1. Log in to {domain.dnsProviderHint ?? "the company that manages your domain"}.</li>
                    <li>2. Open the DNS settings (they may be called DNS records, DNS zone or Advanced DNS).</li>
                    <li>3. Add a new record and choose type TXT.</li>
                    <li>4. Paste the name and the value above. If your provider adds your domain automatically, use only {txtRecord.name}.</li>
                    <li>5. Save.</li>
                  </ol>
                  <p className="mt-3 text-sm text-text-muted">Menu names can look a little different.</p>
                </div>
                <InfoBox variant="info" className="mt-4">
                  It can take a few minutes, sometimes up to an hour, to show up.
                </InfoBox>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button type="button" onClick={checkTxt} loading={busy === "txt"} loadingLabel="Checking...">
                    Check now
                  </Button>
                  <p className="text-sm text-text-muted" aria-live="polite">
                    Checking automatically. Last checked {formatTime(lastChecked)}.
                  </p>
                </div>
              </>
            )}
            {notice && !verified ? <p className="mt-3 text-sm text-warning-text" aria-live="polite">{notice}</p> : null}
          </div>
        ) : null}

        {step === 4 && domain ? (
          liveHost ? (
            <div className="mt-5 text-center">
              <span className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-success-soft text-success-text">
                <CheckCircle2 className="h-9 w-9" aria-hidden />
              </span>
              <p className="mt-4 text-[15px] text-text-muted">It may take a minute to show everywhere.</p>
              <div className="mt-4 flex justify-center">
                <CopyValue value={`https://${liveHost.hostname}`} label="website address" />
              </div>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Button type="button" size="lg" onClick={() => window.open(`https://${liveHost.hostname}`, "_blank", "noopener,noreferrer")}>
                  Open my website <ArrowUpRight className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  type="button"
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
              <div className="mt-6 rounded-card bg-surface-muted p-4 text-left">
                <p className="text-sm font-semibold text-text">What to do next</p>
                <ul className="mt-2 grid gap-2 text-sm text-text-muted">
                  <li>Publish your website so the latest changes appear.</li>
                  <li>You can delete the verification record now if you like. Keeping it is fine.</li>
                </ul>
                <Link href={`/dashboard/projects/${projectId}/publish`} className="mt-3 inline-flex text-sm font-semibold text-primary hover:underline">
                  Go to Publish
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-[15px] leading-6 text-text-muted">
                Add this record so your address points to your Get-On website.
              </p>
              <div className="mt-5 grid gap-4">
                {hosts.map((host) => {
                  const record = {
                    type: "CNAME" as const,
                    name: relativeName(host.hostname, domain.registrable),
                    value: host.cnameTarget,
                  };
                  const status =
                    host.status === "moved"
                      ? "wrong"
                      : host.status === "live" || host.cnameSeen || host.status === "active" || host.status === "ready_to_switch"
                        ? "found"
                        : "missing";
                  return (
                    <div key={host.id}>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <HostnameStatusBadge status={host.status} />
                        <Badge variant={host.role === "main" ? "primary" : "neutral"}>
                          {host.role === "main" ? "Main address" : "Also redirects"}
                        </Badge>
                      </div>
                      <RecordCard
                        type="CNAME"
                        title={`Connect ${host.hostname}`}
                        name={record.name}
                        fullName={recordFullName(record, domain.registrable)}
                        value={record.value}
                        status={status}
                        onCheck={() => void checkHost(host.id)}
                        checking={busy === `host-${host.id}`}
                      />
                      {record.name === "@" ? (
                        <InfoBox variant="info" className="mt-3">
                          Some providers call this an ALIAS or ANAME record. If your provider does not allow it, connect www instead and forward {domain.registrable} to www in your provider&apos;s forwarding settings.
                        </InfoBox>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <Stepper verified={Boolean(domain.verifiedAt)} connected={hosts.some((host) => host.cnameSeen)} live={Boolean(liveHost)} />
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button type="button" variant="secondary" onClick={checkAll} loading={busy === "all"} loadingLabel="Checking...">
                  Check now
                </Button>
                <p className="text-sm text-text-muted" aria-live="polite">
                  Last checked {formatTime(lastChecked)}.
                </p>
              </div>
              <InfoBox variant="info" className="mt-4">
                It can take a few minutes for the connection to show up. The secure padlock is usually ready shortly after.
              </InfoBox>
            </div>
          )
        ) : null}

        {error ? <p className="mt-4 text-sm text-danger-text" role="alert">{error}</p> : null}
        {notice && step !== 3 ? <p className="mt-4 text-sm text-success-text" role="status">{notice}</p> : null}
      </AppCard>

      {removable ? (
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="mt-4 inline-flex h-11 items-center text-sm text-danger-text hover:underline"
        >
          Cancel and delete this draft
        </button>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-border bg-surface px-5 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] md:static md:mt-6 md:border-0 md:bg-transparent md:p-0">
        <Link href={addressHref}>
          <Button type="button" variant="ghost">Back</Button>
        </Link>
        {step === 1 ? (
          domain ? (
            <Button type="button" size="lg" onClick={() => setStep(2)}>Continue</Button>
          ) : (
            <Button type="button" size="lg" onClick={start} loading={busy === "start"} loadingLabel="Checking..." disabled={!input.trim()}>
              Continue
            </Button>
          )
        ) : null}
        {step === 2 ? (
          <Button type="button" size="lg" onClick={addAddress} loading={busy === "address"} loadingLabel="Saving...">
            Continue
          </Button>
        ) : null}
        {step === 3 ? (
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={() => router.push(addressHref)}>I will do this later</Button>
            <Button type="button" size="lg" onClick={() => setStep(4)} disabled={!verified}>Continue</Button>
          </div>
        ) : null}
        {step === 4 && !liveHost ? (
          <Button type="button" size="lg" variant="secondary" onClick={() => router.push(addressHref)}>Close and come back later</Button>
        ) : null}
        {step === 4 && liveHost ? (
          <Link href={addressHref}><Button type="button" size="lg">Done</Button></Link>
        ) : null}
      </div>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this draft?"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setConfirmDelete(false)}>Keep it</Button>
            <Button type="button" variant="danger" onClick={removeDraft} loading={busy === "delete"} loadingLabel="Deleting...">
              Delete draft
            </Button>
          </>
        }
      >
        <p className="text-[15px] text-text-muted">
          We will remove this domain setup. Your website and DNS records stay where they are.
        </p>
      </Dialog>

      {!published && freeUrl ? (
        <p className="mt-4 text-sm text-text-muted">Your free address {freeUrl} is ready now.</p>
      ) : null}
      <span className="sr-only" aria-live="polite">{notice}</span>
    </div>
  );
}
