"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { AppCard } from "@/components/app/card";
import { useToast } from "@/components/ui/toast";
import type { ApprovalRequestKind } from "@/lib/admin/approval-request";
import { createApprovalRequestAction } from "./actions";

const selectClass =
  "h-12 w-full rounded-input border-[1.5px] border-border-strong bg-surface px-3.5 text-base text-text";

function localToIso(value: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : value;
}

export function NewApprovalRequestForm({
  kinds,
  plans,
  initial,
}: {
  kinds: ApprovalRequestKind[];
  plans: { id: string; name: string }[];
  initial?: {
    kind?: string;
    targetId?: string;
    amountUsd?: string;
    teamId?: string;
    monthlyCredits?: string;
    planId?: string;
    decision?: string;
  };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [kind, setKind] = useState<string>(initial?.kind ?? kinds[0]?.kind ?? "refund");
  const [targetId, setTargetId] = useState(initial?.targetId ?? "");
  const [reason, setReason] = useState("");
  const [amountUsd, setAmountUsd] = useState(initial?.amountUsd ?? "");
  const [amountCredits, setAmountCredits] = useState("");
  const [teamId, setTeamId] = useState(initial?.teamId ?? "");
  const [monthlyCredits, setMonthlyCredits] = useState(initial?.monthlyCredits ?? "");
  const [days, setDays] = useState("");
  const [holdAction, setHoldAction] = useState("place");
  const [planId, setPlanId] = useState(
    initial?.planId ??
      plans.find((plan) => plan.id === "basic")?.id ??
      plans[0]?.id ??
      "",
  );
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [decision, setDecision] = useState(initial?.decision ?? "approve");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = kinds.find((item) => item.kind === kind) ?? kinds[0];

  function changeKind(value: string) {
    setKind(value);
    setTargetId("");
    setAmountUsd("");
    setAmountCredits("");
    setTeamId("");
    setMonthlyCredits("");
    setDays("");
    setHoldAction("place");
    setStartsAt("");
    setEndsAt("");
    setExpiresAt("");
    setDecision("approve");
    setError(null);
  }

  async function send() {
    if (!config) return;
    setBusy(true);
    setError(null);
    const result = await createApprovalRequestAction({
      kind,
      targetId,
      reason,
      amountUsd,
      amountCredits,
      teamId,
      monthlyCredits,
      days,
      holdAction,
      planId,
      startsAt: localToIso(startsAt),
      endsAt: localToIso(endsAt),
      expiresAt: localToIso(expiresAt),
      decision,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast("Request sent to the other Super admins.");
    router.push(`/admin/approvals/${result.requestId}`);
  }

  if (!config) return null;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
      className="space-y-5"
    >
      <AppCard className="space-y-5 p-5 min-[640px]:p-6">
        <div>
          <Label htmlFor="request-kind">Action</Label>
          <select
            id="request-kind"
            value={kind}
            onChange={(event) => changeKind(event.target.value)}
            className={`mt-2 ${selectClass}`}
          >
            {kinds.map((item) => (
              <option key={item.kind} value={item.kind}>
                {item.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[13px] text-text-muted">{config.description}</p>
        </div>

        <div>
          <Label htmlFor="request-target">{config.targetLabel}</Label>
          <Input
            id="request-target"
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
            className="mt-2 font-mono text-[13px]"
            placeholder="00000000-0000-0000-0000-000000000000"
            maxLength={200}
            autoComplete="off"
            spellCheck={false}
            required
          />
          <p className="mt-1.5 text-[13px] text-text-muted">{config.targetHint}</p>
        </div>

        {config.extra === "refund_amount" || config.extra === "payment_amount" ? (
          <div>
            <Label htmlFor="request-amount">
              {config.extra === "refund_amount"
                ? "Refund amount (USD)"
                : "Payment amount (USD)"}
            </Label>
            <Input
              id="request-amount"
              type="number"
              inputMode="decimal"
              min="0.01"
              max="1000000"
              step="0.01"
              value={amountUsd}
              onChange={(event) => setAmountUsd(event.target.value)}
              className="mt-2"
              placeholder="0.00"
              required
            />
          </div>
        ) : null}

        {config.extra === "ai_limit" ? (
          <div className="grid gap-4 min-[640px]:grid-cols-2">
            <div>
              <Label htmlFor="request-team">Team ID</Label>
              <Input
                id="request-team"
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
                className="mt-2 font-mono text-[13px]"
                placeholder="00000000-0000-0000-0000-000000000000"
                maxLength={200}
                autoComplete="off"
                spellCheck={false}
                required
              />
            </div>
            <div>
              <Label htmlFor="request-monthly-credits">Monthly credits</Label>
              <Input
                id="request-monthly-credits"
                type="number"
                inputMode="numeric"
                min="0"
                max="1000000"
                step="1"
                value={monthlyCredits}
                onChange={(event) => setMonthlyCredits(event.target.value)}
                className="mt-2"
                placeholder="400"
                required
              />
              <p className="mt-1.5 text-[13px] text-text-muted">
                0 means this member cannot use AI.
              </p>
            </div>
          </div>
        ) : null}

        {config.extra === "days" ? (
          <div>
            <Label htmlFor="request-days">Extra days</Label>
            <Input
              id="request-days"
              type="number"
              inputMode="numeric"
              min="1"
              max="365"
              step="1"
              value={days}
              onChange={(event) => setDays(event.target.value)}
              className="mt-2"
              placeholder="14"
              required
            />
            <p className="mt-1.5 text-[13px] text-text-muted">
              Added after the normal grace window.
            </p>
          </div>
        ) : null}

        {config.extra === "hold" ? (
          <div className="grid gap-4 min-[640px]:grid-cols-2">
            <div>
              <Label htmlFor="request-hold-action">Hold</Label>
              <select
                id="request-hold-action"
                value={holdAction}
                onChange={(event) => setHoldAction(event.target.value)}
                className={`mt-2 ${selectClass}`}
              >
                <option value="place">Place a hold</option>
                <option value="release">Release the hold</option>
              </select>
            </div>
            {holdAction === "place" ? (
              <div>
                <Label htmlFor="request-days" optional>
                  Days
                </Label>
                <Input
                  id="request-days"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="365"
                  step="1"
                  value={days}
                  onChange={(event) => setDays(event.target.value)}
                  className="mt-2"
                  placeholder="No end"
                />
                <p className="mt-1.5 text-[13px] text-text-muted">
                  Leave empty to keep the hold until someone releases it.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {config.extra === "plan" || config.extra === "plan_dates" ? (
          <div>
            <Label htmlFor="request-plan">Plan</Label>
            <select
              id="request-plan"
              value={planId}
              onChange={(event) => setPlanId(event.target.value)}
              className={`mt-2 ${selectClass}`}
              required
            >
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {config.extra === "plan_dates" ? (
          <div className="grid gap-4 min-[640px]:grid-cols-2">
            <div>
              <Label htmlFor="request-starts" optional>
                Starts
              </Label>
              <Input
                id="request-starts"
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                className="mt-2"
              />
              <p className="mt-1.5 text-[13px] text-text-muted">Now if left empty.</p>
            </div>
            <div>
              <Label htmlFor="request-ends" optional>
                Ends
              </Label>
              <Input
                id="request-ends"
                type="datetime-local"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
                className="mt-2"
              />
              <p className="mt-1.5 text-[13px] text-text-muted">No end if left empty.</p>
            </div>
          </div>
        ) : null}

        {config.extra === "credits" ? (
          <div className="grid gap-4 min-[640px]:grid-cols-2">
            <div>
              <Label htmlFor="request-credits">Credits</Label>
              <Input
                id="request-credits"
                type="number"
                inputMode="numeric"
                min="1"
                max="1000000"
                step="1"
                value={amountCredits}
                onChange={(event) => setAmountCredits(event.target.value)}
                className="mt-2"
                placeholder="100"
                required
              />
            </div>
            <div>
              <Label htmlFor="request-expires" optional>
                Expires
              </Label>
              <Input
                id="request-expires"
                type="datetime-local"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
                className="mt-2"
              />
              <p className="mt-1.5 text-[13px] text-text-muted">No expiry if left empty.</p>
            </div>
          </div>
        ) : null}

        {config.extra === "domain_decision" ? (
          <div>
            <Label htmlFor="request-decision">Decision</Label>
            <select
              id="request-decision"
              value={decision}
              onChange={(event) => setDecision(event.target.value)}
              className={`mt-2 ${selectClass}`}
            >
              <option value="approve">Approve the domain</option>
              <option value="reject">Reject the domain</option>
            </select>
          </div>
        ) : null}

        <div>
          <Label htmlFor="request-reason">Why do you need this?</Label>
          <Textarea
            id="request-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-2 min-h-[120px]"
            minLength={10}
            maxLength={500}
            placeholder="Explain what happened and why this change is needed."
            required
          />
          <p className="mt-1 text-[13px] text-text-muted">
            {reason.trim().length}/500 · at least 10 characters
          </p>
        </div>

        {error ? (
          <p role="alert" className="rounded-input bg-danger-soft px-3 py-2 text-sm text-danger-text">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-border pt-5 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between">
          <p className="max-w-[46ch] text-[13px] leading-5 text-text-muted">
            Another Super admin must approve this. Requests expire after 72 hours, and
            you cannot approve your own request.
          </p>
          <Button type="submit" loading={busy} loadingLabel="Sending...">
            Send request
          </Button>
        </div>
      </AppCard>
    </form>
  );
}
