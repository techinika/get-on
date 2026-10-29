import {
  contactAutoreplyEmail,
  contactDigestEmail,
  contactNotificationEmail,
} from "@get-on/email";
import { enqueueEmail, type EnqueueEmailResult } from "@/lib/email/enqueue";
import { parseContactSettings } from "@/lib/contact/settings";
import { primaryAddress, readPublishConfig } from "@/lib/publishing/config";
import type { PlanId } from "@/lib/plans";

import type { SupabaseClient } from "@supabase/supabase-js";

type Admin = SupabaseClient;

export type NotifyMessage = {
  id: string;
  projectId: string;
  projectName: string;
  subdomain: string;
  primaryHost?: string | null;
  teamId: string;
  planId: PlanId;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  pagePath: string | null;
  status: string;
};

function siteName(subdomain: string): string {
  return `${subdomain}.get-on.tech`;
}

async function ownerEmail(admin: Admin, teamId: string): Promise<string | null> {
  const { data: team } = await admin
    .from("teams")
    .select("owner_id")
    .eq("id", teamId)
    .maybeSingle();
  if (!team?.owner_id) return null;
  try {
    const result = await admin.auth.admin.getUserById(String(team.owner_id));
    return result?.data?.user?.email ?? null;
  } catch {
    return null;
  }
}

async function verifiedRecipients(admin: Admin, projectId: string): Promise<string[]> {
  const { data } = await admin
    .from("contact_recipients")
    .select("email")
    .eq("project_id", projectId)
    .not("verified_at", "is", null);
  return (data ?? []).map((row: { email: string }) => row.email);
}

async function suppressed(admin: Admin, emails: string[]): Promise<Set<string>> {
  if (emails.length === 0) return new Set();
  const { data } = await admin
    .from("email_suppressions")
    .select("email")
    .in("email", emails);
  return new Set((data ?? []).map((row: { email: string }) => row.email));
}

async function countKind(
  admin: Admin,
  kind: string,
  since: string,
  projectId?: string,
): Promise<number> {
  let query = admin
    .from("email_log")
    .select("id", { count: "exact", head: true })
    .eq("kind", kind)
    .gte("created_at", since);
  if (projectId) query = query.eq("related_type", "contact_project").eq("related_id", projectId);
  const { count } = await query;
  return count ?? 0;
}

function messagesUrl(projectId: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_ORIGIN || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/dashboard/projects/${projectId}/messages`;
}

async function updateMessage(admin: Admin, id: string, patch: Record<string, unknown>) {
  await admin.from("contact_messages").update(patch).eq("id", id);
}

async function notifyRecipients(
  admin: Admin,
  message: NotifyMessage,
  recipients: string[],
): Promise<EnqueueEmailResult[]> {
  const address = primaryAddress(
    readPublishConfig(),
    message.subdomain,
    message.primaryHost,
  );
  const rendered = contactNotificationEmail({
    site: message.projectName,
    pagePath: message.pagePath ?? "",
    name: message.name,
    email: message.email,
    phone: message.phone,
    message: message.message,
    messagesUrl: messagesUrl(message.projectId),
  });
  const results: EnqueueEmailResult[] = [];
  for (const to of recipients) {
    results.push(
      await enqueueEmail({
        kind: "contact_notification",
        toEmail: to,
        relatedType: "contact_project",
        relatedId: message.projectId,
        dedupeKey: `contact:${message.id}:${to}`,
        payload: {
          subject: rendered.subject,
          text: `${rendered.text}\n\nFrom: ${address}${message.pagePath ?? ""}`,
          html: rendered.html,
          replyTo: message.email,
        },
      }),
    );
  }
  return results;
}

/**
 * Sends the owner notification, or a digest when the hourly cap is reached,
 * and then the optional auto-reply to the visitor.
 */
export async function notifyNewMessage(admin: Admin, message: NotifyMessage): Promise<void> {
  if (message.status === "spam") return;

  const { data: settingsRow } = await admin
    .from("project_settings")
    .select("contact_settings")
    .eq("project_id", message.projectId)
    .maybeSingle();
  const settings = parseContactSettings(settingsRow?.contact_settings);

  const recipients: string[] = [];
  if (settings.notifyOwner) {
    const email = await ownerEmail(admin, message.teamId);
    if (email) recipients.push(email.toLowerCase());
  }
  recipients.push(...(await verifiedRecipients(admin, message.projectId)).map((email) => email.toLowerCase()));

  const unique = [...new Set(recipients)];
  const blocked = await suppressed(admin, unique);
  const allowed = unique.filter((email) => !blocked.has(email));

  if (allowed.length === 0) {
    await updateMessage(admin, message.id, { notify_state: "suppressed" });
  } else {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [hourly, daily] = await Promise.all([
      countKind(admin, "contact_notification", hourAgo, message.projectId),
      countKind(admin, "contact_notification", dayAgo, message.projectId),
    ]);

    if (hourly >= 20 || daily >= 100) {
      await updateMessage(admin, message.id, { notify_state: "digest" });
      const lastDigest = await countKind(admin, "contact_digest", hourAgo, message.projectId);
      if (lastDigest === 0) {
        const { count } = await admin
          .from("contact_messages")
          .select("id", { count: "exact", head: true })
          .eq("project_id", message.projectId)
          .eq("status", "new");
        const digest = contactDigestEmail({
          count: count ?? 1,
          site: message.projectName,
          messagesUrl: messagesUrl(message.projectId),
        });
        for (const to of allowed) {
          await enqueueEmail({
            kind: "contact_digest",
            toEmail: to,
            relatedType: "contact_project",
            relatedId: message.projectId,
            dedupeKey: `digest:${message.projectId}:${to}`,
            payload: {
              subject: digest.subject,
              text: digest.text,
              html: digest.html,
            },
          });
        }
      }
    } else {
      const results = await notifyRecipients(admin, message, allowed);
      const anySent = results.some((result) => result.ok);
      await updateMessage(admin, message.id, {
        notify_state: anySent ? "sent" : "failed",
        notified_at: anySent ? new Date().toISOString() : null,
      });
    }
  }

  await maybeAutoReply(admin, message, settings);
}

async function maybeAutoReply(
  admin: Admin,
  message: NotifyMessage,
  settings: ReturnType<typeof parseContactSettings>,
): Promise<void> {
  if (!settings.autoReply.enabled) return;
  if (message.planId === "free" || message.status === "spam") return;
  if (!message.email) return;

  const blocked = await suppressed(admin, [message.email.toLowerCase()]);
  if (blocked.has(message.email.toLowerCase())) return;

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: perVisitor } = await admin
    .from("email_log")
    .select("id", { count: "exact", head: true })
    .eq("kind", "contact_autoreply")
    .eq("to_email", message.email.toLowerCase())
    .eq("related_type", "contact_project")
    .eq("related_id", message.projectId)
    .gte("created_at", dayAgo);
  if ((perVisitor ?? 0) >= 1) return;

  const total = await countKind(admin, "contact_autoreply", dayAgo, message.projectId);
  if (total >= 100) return;

  const rendered = contactAutoreplyEmail({
    visitorName: message.name,
    businessName: message.projectName,
    subject: settings.autoReply.subject,
    body: settings.autoReply.body,
  });

  const replyTo =
    (await verifiedRecipients(admin, message.projectId))[0] ??
    (await ownerEmail(admin, message.teamId)) ??
    undefined;

  await enqueueEmail({
    kind: "contact_autoreply",
    toEmail: message.email,
    relatedType: "contact_project",
    relatedId: message.projectId,
    dedupeKey: `autoreply:${message.id}`,
    payload: {
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      replyTo,
    },
  });
}

export { siteName };
