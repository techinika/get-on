import { ConsoleSender, MemorySender, SesSender, SmtpSender, memorySender } from './senders';
import type { EmailMessage, EmailSender } from './types';

export { memorySender };
export * from './types';
export * from './senders';
export * from './templates';
export * from './streams';
export * from './catalogue';
export * from './copy';

export type EmailTransport = 'ses' | 'smtp' | 'console' | 'memory';

/**
 * Reads the email transport preference from environment variables.
 * Order of precedence: EMAIL_PROVIDER, EMAIL_TRANSPORT, auto-detect.
 */
let cachedTransport: EmailTransport | null = null;
let cachedLastChecked: number = 0;

export function readTransport(): EmailTransport {
  // Return cached value if checked within last 30 seconds
  const now = Date.now();
  if (cachedTransport && now - cachedLastChecked < 30_000) return cachedTransport;

  const envValue = (process.env.EMAIL_PROVIDER ?? process.env.EMAIL_TRANSPORT ?? '').toLowerCase();
  if (envValue === 'ses') cachedTransport = 'ses';
  else if (envValue === 'smtp') cachedTransport = 'smtp';
  else if (envValue === 'console' || envValue === 'log') cachedTransport = 'console';
  else if (envValue === 'memory' || envValue === 'fake') cachedTransport = 'memory';
  // Auto-detect: SES if AWS creds present, otherwise console
  else if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_REGION) cachedTransport = 'ses';
  else cachedTransport = 'console';

  cachedLastChecked = now;
  return cachedTransport;
}

export function getSender(transport: EmailTransport = readTransport()): EmailSender {
  if (sender && senderTransport === transport) return sender;
  senderTransport = transport;
  if (transport === 'ses') {
    sender = new SesSender();
  } else if (transport === 'smtp') {
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    if (smtpHost && smtpUser) {
      sender = new SmtpSender({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE !== 'false',
        auth: { user: smtpUser, pass: process.env.SMTP_PASSWORD ?? '' },
        from: process.env.SMTP_FROM,
        name: process.env.SMTP_NAME,
      });
    } else {
      sender = new ConsoleSender();
    }
  } else if (transport === 'memory') {
    sender = memorySender;
  } else {
    sender = new ConsoleSender();
  }
  return sender;
}

/** Sends one email and throws when the transport rejects it. */
export async function sendEmail(message: EmailMessage): Promise<{ id: string }> {
  return getSender().send(message);
}

export const TEAM_EMAIL = process.env.TEAM_EMAIL || 'team@get-on.tech';

export function createMemorySender(): MemorySender {
  return new MemorySender();
}