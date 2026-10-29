import { emailLayout, escapeHtml } from "@get-on/email";

function simpleEmail(input: {
  title: string;
  preheader: string;
  paragraphs: string[];
  reason: string;
  action?: { label: string; url: string };
}) {
  const body = [
    ...input.paragraphs.map((text) => `<p style="margin:0 0 16px;font-size:15px;">${escapeHtml(text)}</p>`),
    input.action
      ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(input.action.url)}" style="display:inline-block;background:#1F5E4B;color:#FFFFFF;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;font-size:15px;">${escapeHtml(input.action.label)}</a></p>`
      : "",
  ].join("");
  return {
    subject: input.title,
    html: emailLayout({ title: input.title, preheader: input.preheader, body, reason: input.reason }),
    text: [
      input.title,
      "",
      ...input.paragraphs,
      "",
      input.action ? `${input.action.label}: ${input.action.url}` : "",
      "",
      input.reason,
      "",
      "Get-On, team@get-on.tech",
    ]
      .filter((line) => line !== null)
      .join("\n"),
  };
}

export function welcomeEmail(name?: string | null) {
  const greeting = name ? `Hello ${name},` : "Hello,";
  return simpleEmail({
    title: "Your Get-On account is ready",
    preheader: "Two-step sign-in is on. You will get a code each time you sign in.",
    paragraphs: [
      greeting,
      "Your email is confirmed and your account is ready.",
      "Each time you sign in we email you a 6-digit code. Keep that code to yourself. Get-On will never ask for it by email, phone or chat.",
    ],
    reason: "You receive this email because you created a Get-On account.",
  });
}

export function newDeviceEmail(input: { device: string; when: string; country?: string | null }) {
  return simpleEmail({
    title: "New sign-in to your Get-On account",
    preheader: "A new device signed in to your account.",
    paragraphs: [
      "Your account was used to sign in from a device we have not seen before.",
      `Device: ${input.device}`,
      `Time: ${input.when}`,
      ...(input.country ? [`Country: ${input.country}`] : []),
      "If this was you, you can ignore this email. If it was not you, change your password now.",
    ],
    reason: "You receive this email because a new device signed in to your Get-On account.",
  });
}
