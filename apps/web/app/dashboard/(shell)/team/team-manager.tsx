"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Crown, Mail, MoreHorizontal, PauseCircle, Shield, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import { Menu, MenuItem } from "@/components/ui/menu";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { InfoBox } from "@/components/app/info-box";
import { useToast } from "@/components/ui/toast";
import { relativeTime } from "@/lib/relative-time";
import type { Role } from "@/lib/permissions";
import {
  changeMemberRole,
  inviteMembers,
  leaveTeam,
  removeMember,
  resendInvitation,
  revokeInvitation,
  transferOwnership,
} from "./actions";

export type TeamMemberItem = {
  userId: string;
  name: string;
  email: string;
  role: Role;
  status: "active" | "paused";
  joinedAt: string;
  isYou: boolean;
};

export type InvitationItem = {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
  expiresAt: string;
  lastSentAt: string;
  emailState: "queued" | "sent" | "suppressed" | "failed";
};

type Props = {
  teamName: string;
  currentUserId: string;
  role: Role;
  planName: string;
  seats: { used: number; limit: number | null; members: number; invitations: number };
  members: TeamMemberItem[];
  invitations: InvitationItem[];
  canInvite: boolean;
  canManageRoles: boolean;
  canRemove: boolean;
  canTransfer: boolean;
  canLeave: boolean;
};

const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

const ROLE_ICON: Record<Role, React.ReactNode> = {
  owner: <Crown size={12} aria-hidden />,
  admin: <Shield size={12} aria-hidden />,
  editor: <Pencil size={12} aria-hidden />,
  viewer: <Eye size={12} aria-hidden />,
};

function initials(name: string): string {
  return name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";
}

function RoleBadge({ role, paused }: { role: Role; paused?: boolean }) {
  if (paused) {
    return (
      <Badge variant="draft">
        <PauseCircle size={12} aria-hidden />
        Paused
      </Badge>
    );
  }
  return (
    <Badge variant={role === "owner" ? "primary" : role === "admin" ? "info" : "neutral"}>
      {ROLE_ICON[role]}
      {ROLE_LABEL[role]}
    </Badge>
  );
}

function Avatar({ name, paused }: { name: string; paused?: boolean }) {
  return (
    <span
      aria-hidden
      className={
        paused
          ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-sm font-bold text-text-muted"
          : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent-text"
      }
    >
      {paused ? "?" : initials(name)}
    </span>
  );
}

export function TeamManager(props: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [confirm, setConfirm] = React.useState<
    | { kind: "remove"; member: TeamMemberItem }
    | { kind: "leave" }
    | { kind: "role"; member: TeamMemberItem; role: Role }
    | null
  >(null);
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [transferTo, setTransferTo] = React.useState("");
  const [transferEmail, setTransferEmail] = React.useState("");
  const [inviteRows, setInviteRows] = React.useState<Array<{ email: string; role: Role }>>([
    { email: "", role: "editor" },
  ]);
  const [message, setMessage] = React.useState("");
  const [inviteError, setInviteError] = React.useState<string | null>(null);
  const [links, setLinks] = React.useState<Array<{ email: string; url: string }>>([]);
  const [sending, setSending] = React.useState(false);
  const [now] = React.useState(() => Date.now());

  const activeMembers = props.members.filter((member) => member.status === "active");
  const pausedMembers = props.members.filter((member) => member.status === "paused");
  const freeSeats =
    props.seats.limit === null ? null : Math.max(0, props.seats.limit - props.seats.used);
  const roleOptions: Role[] =
    props.role === "owner" ? ["admin", "editor", "viewer"] : ["editor", "viewer"];

  async function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      toast(result.error, "error");
      return false;
    }
    toast(success, "success");
    router.refresh();
    return true;
  }

  async function confirmAction() {
    if (!confirm) return;
    if (confirm.kind === "remove") {
      const done = await run(() => removeMember(confirm.member.userId), "They no longer have access.");
      if (done) setConfirm(null);
      return;
    }
    if (confirm.kind === "leave") {
      const done = await run(() => leaveTeam(), "You left the team.");
      if (done) setConfirm(null);
      return;
    }
    if (confirm.kind === "role") {
      const done = await run(
        () => changeMemberRole(confirm.member.userId, confirm.role),
        "Their role was changed.",
      );
      if (done) setConfirm(null);
    }
  }

  function requestRole(member: TeamMemberItem, role: Role) {
    if (role === member.role) return;
    if (role === "admin" || member.role === "admin") {
      setConfirm({ kind: "role", member, role });
      return;
    }
    void run(() => changeMemberRole(member.userId, role), "Their role was changed.");
  }

  async function submitInvites() {
    setInviteError(null);
    setLinks([]);
    setSending(true);
    const result = await inviteMembers({ items: inviteRows, message });
    setSending(false);
    if (!result.ok) {
      setInviteError(result.error);
      return;
    }
    setInviteRows([{ email: "", role: "editor" }]);
    setMessage("");
    setLinks(result.links);
    if (result.warnings.length > 0) {
      toast(result.warnings[0]!, "info");
    } else {
      toast(result.sent === 1 ? "Invitation sent." : `${result.sent} invitations sent.`, "success");
    }
    router.refresh();
  }

  async function resend(id: string) {
    const done = await run(() => resendInvitation(id), "Invitation sent again.");
    if (done) setLinks([]);
  }

  async function cancelInvite(id: string) {
    await run(() => revokeInvitation(id), "Invitation cancelled.");
  }

  async function transfer() {
    if (!transferTo) {
      toast("Choose who should be the new owner.", "error");
      return;
    }
    const done = await run(
      () => transferOwnership(transferTo, transferEmail),
      "Ownership was transferred. You are now an Admin.",
    );
    if (done) {
      setTransferOpen(false);
      setTransferEmail("");
      setTransferTo("");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-card border border-border bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-text">Seats</p>
          <p className="text-sm font-semibold text-text">
            {props.seats.used} of {props.seats.limit === null ? "unlimited" : props.seats.limit}
          </p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-pill bg-surface-muted">
          <div
            className="h-full rounded-pill bg-primary"
            style={{
              width:
                props.seats.limit === null
                  ? "12%"
                  : `${Math.min(100, Math.round((props.seats.used / Math.max(1, props.seats.limit)) * 100))}%`,
            }}
          />
        </div>
        <p className="mt-2 text-sm text-text-muted">
          {props.seats.members} member{props.seats.members === 1 ? "" : "s"} and{" "}
          {props.seats.invitations} invitation{props.seats.invitations === 1 ? "" : "s"} waiting.
        </p>
        {props.seats.limit === 1 ? (
          <InfoBox variant="info" className="mt-4">
            Your {props.planName} plan includes 1 team member. Upgrade to Pro to work with others.
          </InfoBox>
        ) : null}
        {pausedMembers.length > 0 ? (
          <InfoBox variant="warning" className="mt-4">
            {pausedMembers.length} member{pausedMembers.length === 1 ? " is" : "s are"} paused because
            your plan has fewer seats.
          </InfoBox>
        ) : null}
      </div>

      <section aria-labelledby="members-heading">
        <div className="mb-3 flex items-center gap-2">
          <h2 id="members-heading" className="font-heading text-[17px] font-semibold text-text">
            Members
          </h2>
          <Badge>{activeMembers.length}</Badge>
        </div>
        <div className="divide-y divide-border rounded-card border border-border bg-surface">
          {props.members.map((member) => (
            <div
              key={member.userId}
              className="flex min-h-[72px] flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={member.name} paused={member.status === "paused"} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[15px] font-semibold text-text">{member.name}</p>
                    {member.isYou ? <Badge>You</Badge> : null}
                  </div>
                  {member.email ? (
                    <p className="truncate text-[13px] text-text-muted">{member.email}</p>
                  ) : null}
                  <p className="mt-0.5 text-xs text-text-muted">
                    Joined {new Date(member.joinedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:pl-4">
                <RoleBadge role={member.role} paused={member.status === "paused"} />
                {props.canManageRoles && !member.isYou && member.role !== "owner" && member.status === "active" ? (
                  <select
                    aria-label={`Role for ${member.name}`}
                    className="h-10 rounded-input border-[1.5px] border-border-strong bg-surface px-3 text-sm font-semibold text-text"
                    value={member.role}
                    onChange={(event) => requestRole(member, event.target.value as Role)}
                    disabled={busy}
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABEL[role]}
                      </option>
                    ))}
                  </select>
                ) : null}
                {!member.isYou && props.canRemove ? (
                  <Menu
                    label={`Actions for ${member.name}`}
                    trigger={(triggerProps) => (
                      <button
                        {...triggerProps}
                        type="button"
                        aria-label={`Actions for ${member.name}`}
                        className="flex h-11 w-11 items-center justify-center rounded-input text-text-muted hover:bg-surface-muted hover:text-text"
                      >
                        <MoreHorizontal size={18} aria-hidden />
                      </button>
                    )}
                  >
                    <MenuItem
                      destructive
                      disabled={member.role === "owner" || busy}
                      onClick={() => setConfirm({ kind: "remove", member })}
                    >
                      <Trash2 size={16} aria-hidden />
                      Remove from team
                    </MenuItem>
                  </Menu>
                ) : null}
                {member.isYou && props.canLeave ? (
                  <Button variant="ghost" size="sm" type="button" onClick={() => setConfirm({ kind: "leave" })}>
                    Leave team
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      {props.canInvite && props.invitations.length > 0 ? (
        <section aria-labelledby="invitations-heading">
          <div className="mb-3 flex items-center gap-2">
            <h2 id="invitations-heading" className="font-heading text-[17px] font-semibold text-text">
              Invitations waiting
            </h2>
            <Badge>{props.invitations.length}</Badge>
          </div>
          <div className="divide-y divide-border rounded-card border border-border bg-surface">
            {props.invitations.map((invitation) => {
              const canResend = new Date(invitation.lastSentAt).getTime() <= now - 864e5;
              return (
                <div
                  key={invitation.id}
                  className="flex min-h-[72px] flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-muted text-text-muted">
                      <Mail size={17} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-text">{invitation.email}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-text-muted">
                        <RoleBadge role={invitation.role} />
                        <span>
                          Sent {relativeTime(invitation.createdAt)}, ends{" "}
                          {new Date(invitation.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </span>
                        {invitation.emailState === "suppressed" || invitation.emailState === "failed" ? (
                          <Badge variant="draft">Not delivered</Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      disabled={!canResend || busy}
                      onClick={() => resend(invitation.id)}
                    >
                      Resend
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      className="text-danger-text"
                      onClick={() => cancelInvite(invitation.id)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {props.canInvite && props.seats.limit !== 1 ? (
        <section aria-labelledby="invite-heading">
          <h2 id="invite-heading" className="mb-3 font-heading text-[17px] font-semibold text-text">
            Invite people
          </h2>
          <div className="rounded-card border border-border bg-surface p-5">
            <div className="space-y-3">
              {inviteRows.map((row, index) => (
                <div key={index} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    type="email"
                    autoComplete="off"
                    placeholder="name@example.com"
                    aria-label={`Email address ${index + 1}`}
                    value={row.email}
                    onChange={(event) =>
                      setInviteRows((rows) =>
                        rows.map((item, i) => (i === index ? { ...item, email: event.target.value } : item)),
                      )
                    }
                  />
                  <select
                    aria-label={`Role for email ${index + 1}`}
                    className="h-12 rounded-input border-[1.5px] border-border-strong bg-surface px-3 text-base text-text sm:w-[140px]"
                    value={row.role}
                    onChange={(event) =>
                      setInviteRows((rows) =>
                        rows.map((item, i) => (i === index ? { ...item, role: event.target.value as Role } : item)),
                      )
                    }
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABEL[role]}
                      </option>
                    ))}
                  </select>
                  {inviteRows.length > 1 ? (
                    <button
                      type="button"
                      aria-label="Remove this email"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-input text-text-muted hover:bg-surface-muted hover:text-text"
                      onClick={() => setInviteRows((rows) => rows.filter((_, i) => i !== index))}
                    >
                      <Trash2 size={17} aria-hidden />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              size="md"
              type="button"
              className="mt-2"
              disabled={inviteRows.length >= 5}
              onClick={() => setInviteRows((rows) => [...rows, { email: "", role: "editor" }])}
            >
              <Plus size={16} aria-hidden />
              Add another
            </Button>
            <div className="mt-4">
              <label htmlFor="invite-message" className="text-sm font-semibold text-text">
                Message (optional)
              </label>
              <Textarea
                id="invite-message"
                value={message}
                maxLength={300}
                rows={3}
                className="mt-1.5"
                placeholder="Add a personal note. It goes in the email."
                onChange={(event) => setMessage(event.target.value)}
              />
              <p className="mt-1 text-xs text-text-muted">{message.length} of 300</p>
            </div>
            {inviteError ? (
              <p role="alert" className="mt-3 text-sm text-danger-text">
                {inviteError}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-text-muted">
                {freeSeats === null
                  ? "This uses your available seats."
                  : `This uses ${Math.min(inviteRows.length, freeSeats)} of your ${freeSeats} free seat${freeSeats === 1 ? "" : "s"}.`}
              </p>
              <Button
                type="button"
                size="md"
                loading={sending}
                loadingLabel="Sending..."
                onClick={submitInvites}
              >
                Send invitations
              </Button>
            </div>
            {links.length > 0 ? (
              <div className="mt-4 space-y-2 rounded-info bg-warning-soft p-3">
                <p className="text-sm font-semibold text-warning-text">
                  We could not email these addresses. Copy the invitation link and send it another way.
                </p>
                {links.map((link) => (
                  <div key={link.email} className="flex flex-col gap-1 text-sm">
                    <span className="font-semibold text-text">{link.email}</span>
                    <code className="break-all rounded-input bg-surface p-2 text-xs">{link.url}</code>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {props.canTransfer || props.canManageRoles ? (
        <section aria-labelledby="team-settings-heading">
          <h2 id="team-settings-heading" className="mb-3 font-heading text-[17px] font-semibold text-text">
            Team settings
          </h2>
          <div className="divide-y divide-border rounded-card border border-border bg-surface">
            {props.canTransfer ? (
              <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[15px] font-semibold text-text">Transfer ownership</p>
                  <p className="mt-1 text-sm text-text-muted">
                    Make someone else the owner of this team. You become an Admin.
                  </p>
                </div>
                <Button variant="secondary" size="md" type="button" onClick={() => setTransferOpen(true)}>
                  Transfer ownership
                </Button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <ConfirmDialog
        open={confirm?.kind === "remove" || confirm?.kind === "leave"}
        title={
          confirm?.kind === "remove"
            ? `Remove ${confirm.member.name} from ${props.teamName}?`
            : `Leave ${props.teamName}?`
        }
        description={
          confirm?.kind === "remove"
            ? "They will lose access straight away. Their work stays on your websites."
            : "You will lose access to its websites. You can only come back if someone invites you again."
        }
        confirmLabel={confirm?.kind === "remove" ? "Remove" : "Leave team"}
        destructive
        loading={busy}
        onConfirm={confirmAction}
        onClose={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={confirm?.kind === "role"}
        title={
          confirm?.kind === "role"
            ? confirm.role === "admin"
              ? `Make ${confirm.member.name} an Admin?`
              : `Change ${confirm.member.name}'s role?`
            : "Change role?"
        }
        description={
          confirm?.kind === "role" && confirm.role === "admin"
            ? "Admins can manage people, websites and settings."
            : "They will get the new access straight away."
        }
        confirmLabel="Change role"
        loading={busy}
        onConfirm={confirmAction}
        onClose={() => setConfirm(null)}
      />

      <Dialog
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        title="Transfer ownership"
        width="form"
        footer={
          <>
            <Button variant="secondary" size="md" type="button" onClick={() => setTransferOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="md" type="button" loading={busy} loadingLabel="Transferring..." onClick={transfer}>
              Transfer ownership
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="new-owner" className="text-sm font-semibold text-text">
              New owner
            </label>
            <select
              id="new-owner"
              className="mt-1.5 h-12 w-full rounded-input border-[1.5px] border-border-strong bg-surface px-3 text-base text-text"
              value={transferTo}
              onChange={(event) => setTransferTo(event.target.value)}
            >
              <option value="">Choose a person</option>
              {activeMembers
                .filter((member) => member.userId !== props.currentUserId)
                .map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name} ({ROLE_LABEL[member.role]})
                  </option>
                ))}
            </select>
          </div>
          <p className="text-[15px] text-text-muted">
            They will become the owner. They control billing and can remove anyone.
          </p>
          <div>
            <label htmlFor="confirm-owner-email" className="text-sm font-semibold text-text">
              Type the new owner&apos;s email to confirm
            </label>
            <Input
              id="confirm-owner-email"
              type="email"
              className="mt-1.5"
              value={transferEmail}
              onChange={(event) => setTransferEmail(event.target.value)}
              placeholder={activeMembers.find((member) => member.userId === transferTo)?.email ?? "name@example.com"}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
