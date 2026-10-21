export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

export type EmailProvider = {
  name: string;
  send: (message: EmailMessage) => Promise<void>;
};

function resendProvider(apiKey: string): EmailProvider {
  return {
    name: "resend",
    async send(message) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM ?? "Get-On <hello@get-on.tech>",
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
          reply_to: message.replyTo,
        }),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Email provider returned ${response.status}: ${body.slice(0, 300)}`);
      }
    },
  };
}

function consoleProvider(): EmailProvider {
  return {
    name: "console",
    async send(message) {
      console.info(
        `[email] to=${message.to} subject=${JSON.stringify(message.subject)}\n${message.text}`,
      );
    },
  };
}

/** The provider used for every email. Resend when a key exists, console otherwise. */
export function getEmailProvider(): EmailProvider {
  const apiKey = process.env.RESEND_API_KEY;
  return apiKey ? resendProvider(apiKey) : consoleProvider();
}

/**
 * Sends an email and never throws. Email problems must not lose a demo
 * request that is already stored in the database.
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  try {
    const provider = getEmailProvider();
    await provider.send(message);
    return true;
  } catch (error) {
    console.error("[email] could not send message", error);
    return false;
  }
}

/** Escapes text for safe use inside an HTML email. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
