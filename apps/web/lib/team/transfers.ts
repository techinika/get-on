import { createHmac, randomBytes } from "node:crypto";
import { teamNoticeEmail } from "@get-on/email";
import { sendEmail } from "@/lib/email/send";
import env from "@/lib/env";

export const TRANSFER_DAYS = 7;

export function transferPepper(): string {
  return (
    process.env.TRANSFER_TOKEN_PEPPER ??
    process.env.INVITE_TOKEN_PEPPER ??
    "dev-invite-pepper-change-me"
  );
}

export function newTransferToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashTransferToken(token) };
}

export function hashTransferToken(token: string): string {
  return createHmac("sha256", transferPepper()).update(token).digest("hex");
}

export function transferLink(token: string): string {
  const base = env.siteUrl || env.appOrigin || "https://get-on.tech";
  return `${base.replace(/\/$/, "")}/transfer/${token}`;
}

export function normalizeTransferEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function friendlyTransferError(code: string): string {
  switch (code) {
    case "TRANSFER_NOT_FOUND":
      return "This transfer link is not valid. Ask the sender for a new one.";
    case "TRANSFER_NOT_PENDING":
      return "This transfer has already been answered.";
    case "TRANSFER_EXPIRED":
      return "This transfer has ended. Ask the sender to send it again.";
    case "TRANSFER_EMAIL_MISMATCH":
      return "This transfer was sent to a different email address. Sign in with that address to accept it.";
    case "TRANSFER_STALE":
      return "This website has changed teams since the transfer was sent. Ask the sender to send it again.";
    case "TRANSFER_DELETED":
      return "This website was deleted, so it cannot be transferred.";
    case "TRANSFER_SAME_TEAM":
      return "The website is already in that team.";
    case "TRANSFER_FORBIDDEN":
      return "You can only accept a website into a team you own or manage.";
    case "TRANSFER_SITE_LIMIT":
      return "That team has no room for another website. Delete one or upgrade the plan.";
    case "TRANSFER_PAGE_LIMIT":
      return "That team's plan does not allow this many pages. Upgrade the plan or remove some pages first.";
    case "PROJECT_BUSY":
      return "This website is busy right now. Please try again in a few minutes.";
    case "NOT_ALLOWED":
      return "Please sign in again.";
    default:
      return "That did not work. Please try again.";
  }
}

export async function sendTransferEmail(input: {
  to: string;
  transferId: string;
  projectName: string;
  fromTeamName: string;
  fromName: string;
  token: string;
  expiresAt: string;
}): Promise<"sent" | "queued" | "failed" | "suppressed"> {
  const template = teamNoticeEmail({
    title: `${input.fromName} wants to send you a website`,
    intro: `${input.fromName} wants to move ${input.projectName} from ${input.fromTeamName} to your team on Get-On. You choose whether to accept.`,
    details: [
      { label: "Website", value: input.projectName },
      { label: "From", value: input.fromTeamName },
    ],
    actionUrl: transferLink(input.token),
    actionLabel: "Review the website",
    footer: `This link works until ${new Date(input.expiresAt).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}. If you do not want it, ignore this email.`,
  });
  const result = await sendEmail({
    to: input.to,
    subject: template.subject,
    text: template.text,
    html: template.html,
    kind: "website_transfer",
    relatedType: "ownership_transfer",
    relatedId: input.transferId,
  });
  return result.status;
}
