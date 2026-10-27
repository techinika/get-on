"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  Mail,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { AppCard } from "@/components/app/card";
import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";
import { InfoBox } from "@/components/app/info-box";
import { SettingsSection } from "@/components/app/settings-section";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { friendlyError } from "@/lib/errors";
import type { ContactSettings } from "@/lib/contact/settings";
import { cn } from "@/lib/utils";
import {
  addRecipient,
  deleteAllMessages,
  removeRecipient,
  resendRecipient,
  saveContactSettings,
  sendTestAutoreply,
} from "@/app/dashboard/(shell)/projects/[projectId]/plugins/actions";

export type RecipientRow = {
  id: string;
  email: string;
  verified: boolean;
};

export type FormPage = {
  pageId: string;
  pageTitle: string;
  path: string;
  blockId: string;
};

function nowMs(): number {
  return Date.now();
}

export function ContactSettings({
  projectId,
  projectName,
  teamName,
  ownerEmail,
  initialSettings,
  recipients,
  formPages,
  active,
  planId,
}: {
  projectId: string;
  projectName: string;
  teamName: string;
  ownerEmail: string;
  initialSettings: ContactSettings;
  recipients: RecipientRow[];
  formPages: FormPage[];
  active: boolean;
  planId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [settings, setSettings] = React.useState(initialSettings);
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteWord, setDeleteWord] = React.useState("");
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const deleteWordRef = React.useRef<HTMLInputElement>(null);
  const [resendAt, setResendAt] = React.useState<Record<string, number>>({});
  const [now, setNow] = React.useState(() => Date.now());
  const free = planId === "free";

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  function update(patch: Partial<ContactSettings>) {
    setSettings((current) => ({ ...current, ...patch }));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    const result = await saveContactSettings(projectId, settings);
    setSaving(false);
    if (!result.ok) {
      toast(friendlyError(result.error), "error");
      return;
    }
    setDirty(false);
    toast("Settings saved.", "success");
    router.refresh();
  }

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("email") as HTMLInputElement | null;
    const email = input?.value.trim() ?? "";
    if (!email) return;
    const result = await addRecipient(projectId, email);
    if (!result.ok) {
      toast(friendlyError(result.error), "error");
      return;
    }
    if (input) input.value = "";
    toast("We sent a link to confirm it.", "success");
    router.refresh();
  }

  async function resend(recipient: RecipientRow) {
    const next = nowMs() + 60_000;
    setResendAt((current) => ({ ...current, [recipient.id]: next }));
    const result = await resendRecipient(projectId, recipient.id);
    if (!result.ok) {
      toast(friendlyError(result.error), "error");
      return;
    }
    toast("Link sent again.", "success");
  }

  async function remove(recipient: RecipientRow) {
    const result = await removeRecipient(projectId, recipient.id);
    if (!result.ok) {
      toast(friendlyError(result.error), "error");
      return;
    }
    toast("Email address removed.", "success");
    router.refresh();
  }

  async function sendTest() {
    const result = await sendTestAutoreply(projectId);
    if (!result.ok) {
      toast(friendlyError(result.error), "error");
      return;
    }
    toast("Test email sent to you.", "success");
  }

  async function removeAll() {
    setDeleting(true);
    const result = await deleteAllMessages(projectId, deleteWord);
    setDeleting(false);
    if (!result.ok) {
      toast(friendlyError(result.error), "error");
      return;
    }
    setDeleteOpen(false);
    setDeleteWord("");
    toast("All messages deleted.", "success");
    router.refresh();
  }

  const title = settings.thanksTitle || "Thank you!";
  const message =
    settings.thanksText || "Your message has been sent. We will get back to you soon.";

  return (
    <AppPage>
      <PageHeader
        breadcrumbs={[
          { label: teamName, href: "/dashboard" },
          { label: projectName, href: `/dashboard/projects/${projectId}` },
          { label: "Plugins", href: `/dashboard/projects/${projectId}/plugins` },
          { label: "Contact form" },
        ]}
        title="Contact form"
        description="Choose who gets your messages and what visitors see after sending."
        actions={
          active ? (
            <Link
              href={`/dashboard/projects/${projectId}/messages`}
              className={buttonVariants({ variant: "secondary", size: "md" })}
            >
              <Mail size={20} strokeWidth={1.75} aria-hidden />
              Open messages
            </Link>
          ) : null
        }
      />

      {!active ? (
        <InfoBox variant="info">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>The Contact form is off.</span>
            <Link
              href={`/dashboard/projects/${projectId}/plugins?enable=contact`}
              className={buttonVariants({ variant: "primary", size: "sm" })}
            >
              Turn on
            </Link>
          </div>
        </InfoBox>
      ) : (
        <>
          <AppCard className="p-6">
            <SettingsSection
              title="Where messages go"
              description="Choose who gets an email when someone writes to you."
            >
              <Switch
                checked={settings.notifyOwner}
                onCheckedChange={(checked) => update({ notifyOwner: checked })}
                label="Email me when someone writes"
              />

              <ul className="mt-4 flex flex-col gap-2">
                <li className="flex min-h-[52px] items-center gap-2 rounded-input bg-surface-muted px-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-text">
                      {ownerEmail || "Your account email"}
                    </span>
                    <span className="block text-[13px] text-text-muted">From your account</span>
                  </span>
                  <Badge variant="neutral">You</Badge>
                </li>
                {recipients.map((recipient) => {
                  const left = Math.max(0, Math.ceil(((resendAt[recipient.id] ?? 0) - now) / 1000));
                  return (
                    <li
                      key={recipient.id}
                      className="flex min-h-[52px] flex-wrap items-center gap-2 rounded-input border border-border px-3"
                    >
                      <span className="min-w-0 flex-1 break-all text-[15px] text-text">
                        {recipient.email}
                      </span>
                      <Badge variant={recipient.verified ? "live" : "draft"}>
                        {recipient.verified ? "Confirmed" : "Waiting for confirmation"}
                      </Badge>
                      {!recipient.verified ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void resend(recipient)}
                          disabled={left > 0}
                        >
                          {left > 0 ? `Send again (${left}s)` : "Send again"}
                        </Button>
                      ) : null}
                      <button
                        type="button"
                        aria-label={`Remove ${recipient.email}`}
                        onClick={() => void remove(recipient)}
                        className="flex h-11 w-11 items-center justify-center rounded-input text-text-muted hover:bg-danger-soft hover:text-danger-text"
                      >
                        <X size={18} strokeWidth={1.75} aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>

              <form onSubmit={add} className="mt-3 flex flex-wrap items-end gap-2">
                <div className="min-w-[200px] flex-1">
                  <Label htmlFor="new-recipient">Add another email address</Label>
                  <Input
                    id="new-recipient"
                    name="email"
                    type="email"
                    placeholder="name@example.com"
                    autoComplete="email"
                    className="mt-1.5"
                  />
                </div>
                <Button type="submit" variant="secondary" size="md">
                  <Plus size={18} strokeWidth={1.75} aria-hidden />
                  Add
                </Button>
              </form>
              <p className="mt-2 text-[13px] text-text-muted">
                We will send a link to confirm it. Up to 3 extra addresses.
              </p>
            </SettingsSection>

            <SettingsSection
              title="Thank-you message"
              description="This appears after someone sends a message."
            >
              <Label htmlFor="thank-title">Title</Label>
              <Input
                id="thank-title"
                className="mt-1.5"
                maxLength={60}
                value={settings.thanksTitle}
                onChange={(event) =>
                  update({ thanksTitle: event.target.value })
                }
              />
              <Label htmlFor="thank-message" className="mt-4">
                Message
              </Label>
              <Textarea
                id="thank-message"
                className="mt-1.5 min-h-[100px]"
                maxLength={300}
                value={settings.thanksText}
                onChange={(event) =>
                  update({ thanksText: event.target.value })
                }
              />
              <p className="mt-1 text-right text-[13px] text-text-muted">
                {settings.thanksText.length} of 300
              </p>
              <div className="mt-4 rounded-app-card bg-surface-muted p-5 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success-text">
                  <CheckCircle2 size={28} strokeWidth={1.75} aria-hidden />
                </span>
                <p className="mt-3 text-lg font-semibold text-text">{title}</p>
                <p className="mt-1 text-sm text-text-muted">{message}</p>
              </div>
            </SettingsSection>

            <SettingsSection
              title="Reply to visitors automatically"
              description="Send a friendly note straight away, so people know you got their message."
            >
              <div className="flex flex-wrap items-center gap-3">
                <Switch
                  checked={settings.autoReply.enabled && !free}
                  onCheckedChange={(checked) =>
                    update({ autoReply: { ...settings.autoReply, enabled: checked } })
                  }
                  label="Send an automatic reply"
                  disabled={free}
                />
                {free ? (
                  <>
                    <Badge variant="accent">Basic plan and above</Badge>
                    <Link href="/dashboard/plan" className="text-sm font-semibold text-primary hover:underline">
                      See plans
                    </Link>
                  </>
                ) : null}
              </div>

              {settings.autoReply.enabled && !free ? (
                <div className="mt-4">
                  <Label htmlFor="auto-subject">Subject</Label>
                  <Input
                    id="auto-subject"
                    className="mt-1.5"
                    maxLength={120}
                    value={settings.autoReply.subject}
                    onChange={(event) =>
                      update({
                        autoReply: { ...settings.autoReply, subject: event.target.value },
                      })
                    }
                  />
                  <Label htmlFor="auto-body" className="mt-4">
                    Message
                  </Label>
                  <Textarea
                    id="auto-body"
                    className="mt-1.5 min-h-[120px]"
                    maxLength={500}
                    value={settings.autoReply.body}
                    onChange={(event) =>
                      update({ autoReply: { ...settings.autoReply, body: event.target.value } })
                    }
                  />
                  <p className="mt-1 text-[13px] text-text-muted">
                    You can use {"{name}"} and {"{business}"}. We send it from team@get-on.tech,
                    and replies go to you.
                  </p>
                  <Button variant="secondary" size="sm" className="mt-3" onClick={() => void sendTest()}>
                    <Send size={16} strokeWidth={1.75} aria-hidden />
                    Send me a test
                  </Button>
                </div>
              ) : null}
            </SettingsSection>

            <SettingsSection
              title="Where your forms are"
              description="Pages on your website that have a contact form."
            >
              {formPages.length === 0 ? (
                <div className="rounded-app-card border border-dashed border-border-strong p-6 text-center">
                  <p className="text-base text-text-muted">You have not added a form yet.</p>
                  <Link
                    href={`/dashboard/projects/${projectId}/pages`}
                    className={cn(buttonVariants({ variant: "primary", size: "md" }), "mt-4")}
                  >
                    Go to pages
                  </Link>
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {formPages.map((page) => (
                    <li
                      key={`${page.pageId}-${page.blockId}`}
                      className="flex flex-wrap items-center gap-2 rounded-input border border-border px-3 py-2.5"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold text-text">
                          {page.pageTitle}
                        </span>
                        <span className="block truncate text-[13px] text-text-muted">{page.path}</span>
                      </span>
                      <Link
                        href={`/dashboard/projects/${projectId}/pages/${page.pageId}?block=${page.blockId}`}
                        className={buttonVariants({ variant: "secondary", size: "sm" })}
                      >
                        Edit
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </SettingsSection>

            <SettingsSection
              title="Delete messages"
              description="This removes every message, including archived and spam. It cannot be undone."
            >
              <Button variant="danger-outline" size="md" onClick={() => setDeleteOpen(true)}>
                <Trash2 size={18} strokeWidth={1.75} aria-hidden />
                Delete all messages
              </Button>
            </SettingsSection>
          </AppCard>

          <div className="sticky bottom-0 z-20 mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-border bg-app-bg/95 py-3 backdrop-blur">
            {dirty ? <p className="mr-auto text-sm text-text-muted">You have unsaved changes.</p> : null}
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setSettings(initialSettings);
                setDirty(false);
              }}
              disabled={!dirty}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => void save()}
              loading={saving}
              loadingLabel="Saving..."
              disabled={!dirty}
            >
              <Check size={18} strokeWidth={1.75} aria-hidden />
              Save changes
            </Button>
          </div>
        </>
      )}

      <Dialog
        open={deleteOpen}
        onClose={() => (deleting ? undefined : setDeleteOpen(false))}
        title="Delete all messages?"
        initialFocusRef={deleteWordRef}
        icon={
          <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-danger-soft text-danger-text">
            <Trash2 size={24} strokeWidth={1.75} aria-hidden />
          </span>
        }
        dismissible={!deleting}
        footer={
          <>
            <Button variant="secondary" size="md" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              loading={deleting}
              loadingLabel="Deleting..."
              disabled={deleteWord.toLowerCase() !== "delete"}
              onClick={() => void removeAll()}
            >
              Delete all messages
            </Button>
          </>
        }
      >
        <p className="text-base text-text">
          Every message will be removed, including archived and spam. This cannot be undone.
        </p>
        <Label htmlFor="delete-word" className="mt-4">
          Type delete to confirm
        </Label>
        <Input
          id="delete-word"
          ref={deleteWordRef}
          className="mt-1.5"
          value={deleteWord}
          onChange={(event) => setDeleteWord(event.target.value)}
          autoComplete="off"
        />
      </Dialog>
    </AppPage>
  );
}
