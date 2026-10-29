import { emailLayout, escapeHtml } from "@get-on/email";

export type SecurityCodePurpose =
  | "signup_verify"
  | "login"
  | "step_up"
  | "email_change_old"
  | "email_change_new"
  | "recovery";

export type SecurityCodeEmailInput = {
  purpose: SecurityCodePurpose;
  code: string;
  minutes: number;
  when: Date;
  browser: string;
  country?: string | null;
  notMeUrl?: string | null;
};

export const SECURITY_CODE_SUBJECTS: Record<SecurityCodePurpose, string> = {
  signup_verify: "Your Get-On verification code",
  login: "Your Get-On sign-in code",
  step_up: "Confirm it is you",
  email_change_old: "Confirm your email change",
  email_change_new: "Confirm your email change",
  recovery: "Your Get-On recovery code",
};

const TITLES: Record<SecurityCodePurpose, string> = {
  signup_verify: "Your verification code",
  login: "Your sign-in code",
  step_up: "Confirm it is you",
  email_change_old: "Confirm your email change",
  email_change_new: "Confirm your email change",
  recovery: "Your recovery code",
};

const SENTENCES: Record<SecurityCodePurpose, string> = {
  signup_verify: "Enter this code to finish creating your account.",
  login: "Enter this code to finish signing in.",
  step_up: "Enter this code to continue.",
  email_change_old: "Enter this code to confirm the change to your account email.",
  email_change_new: "Enter this code to confirm this as your new email address.",
  recovery: "Enter this code to continue recovering your account.",
};

function utcTime(date: Date): string {
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

export function securityCodeEmail(input: SecurityCodeEmailInput): { subject: string; html: string; text: string } {
  const title = TITLES[input.purpose];
  const sentence = SENTENCES[input.purpose];
  const subject = SECURITY_CODE_SUBJECTS[input.purpose];
  const reason = "You receive this email because someone tried to use your Get-On account.";

  const rows: Array<[string, string]> = [
    ["Time", utcTime(input.when)],
    ["Browser and system", input.browser],
  ];
  if (input.country) rows.push(["Country", input.country]);

  const table = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 16px 4px 0;color:#5C5750;font-size:14px;">${escapeHtml(label)}</td><td style="padding:4px 0;font-size:14px;">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  const notMe = input.notMeUrl
    ? `<p style="margin:24px 0 0;font-size:15px;">If this was not you, someone may know your password. Change your password now.</p>
<p style="margin:12px 0 0;"><a href="${escapeHtml(input.notMeUrl)}" style="display:inline-block;background:#1F5E4B;color:#FFFFFF;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;font-size:15px;">Secure my account</a></p>`
    : "";

  const body = `<p style="margin:0 0 8px;font-size:15px;">${escapeHtml(sentence)} It expires in ${input.minutes} minutes.</p>
<div style="margin:20px 0;padding:16px 24px;background:#F6F0E6;border-radius:12px;text-align:center;font-family:'SFMono-Regular',Consolas,monospace;font-size:32px;line-height:40px;letter-spacing:8px;font-weight:600;">${escapeHtml(input.code)}</div>
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 0;">${table}</table>
${notMe}`;

  const html = emailLayout({ title, preheader: `${title}: ${input.code}`, body, reason });

  const text = [
    title,
    "",
    `${sentence} It expires in ${input.minutes} minutes.`,
    "",
    `    ${input.code}`,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    input.notMeUrl
      ? `If this was not you, someone may know your password. Secure your account: ${input.notMeUrl}`
      : "",
    "",
    reason,
    "",
    "Get-On, team@get-on.tech",
  ]
    .filter((line) => line !== null)
    .join("\n");

  return { subject, html, text };
}
