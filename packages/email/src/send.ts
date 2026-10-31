import { ConsoleSender, MemorySender, SesSender, SmtpSender, memorySender } from './senders';
import type { EmailMessage, EmailSender } from './types';

export { memorySender };
export * from './types';
export * from './senders';
export * from './templates';
export * from './layout';
export * from './streams';
export * from './catalogue';
export * from './copy';

export type EmailTransport = 'ses' | 'smtp' | 'console' | 'memory';

let cachedTransport: EmailTransport | null = null;
let cachedLastChecked: number = 0;

const senders = new Map<EmailTransport, EmailSender>();

/**
 * Reads the explicit email transport preference from environment variables.
 * Returns null when no override is set, meaning the transport should be chosen
 * per message (SMTP for one-person email, SES for batches).
 */
export function readTransport(): EmailTransport | null {
  const now = Date.now();
  if (cachedTransport !== null && now - cachedLastChecked < 30_000) return cachedTransport;

  const envValue = (process.env.EMAIL_PROVIDER ?? process.env.EMAIL_TRANSPORT ?? '').toLowerCase();
  if (envValue === 'ses') cachedTransport = 'ses';
  else if (envValue === 'smtp') cachedTransport = 'smtp';
  else if (envValue === 'log' || envValue === 'console') cachedTransport = 'console';
  else if (envValue === 'memory' || envValue === 'fake') cachedTransport = 'memory';
  // No explicit override: decide per message below.
  else cachedTransport = null;

  cachedLastChecked = now;
  return cachedTransport;
}

/**
 * Choose the transport for a single message.
 *
 * Batches (marketing campaigns) go through SES; everything else (one-person
 * transactional and billing email) goes through SMTP by default. An explicit
 * EMAIL_PROVIDER/EMAIL_TRANSPORT override wins for every message.
 */
export function transportForMessage(message: EmailMessage): EmailTransport {
  const forced = readTransport();
  if (forced !== null) return forced;
  if (message.stream === 'marketing') return 'ses';
  return 'smtp';
}

function createSender(transport: EmailTransport): EmailSender {
  if (transport === 'ses') return new SesSender();
  if (transport === 'smtp') {
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    if (smtpHost && smtpUser) {
      return new SmtpSender({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE !== 'false',
        auth: { user: smtpUser, pass: process.env.SMTP_PASSWORD ?? '' },
        from: process.env.SMTP_FROM,
        name: process.env.SMTP_NAME,
      });
    }
    return new ConsoleSender();
  }
  if (transport === 'memory') return memorySender;
  return new ConsoleSender();
}

export function getSenderForTransport(transport: EmailTransport): EmailSender {
  const existing = senders.get(transport);
  if (existing) return existing;
  const sender = createSender(transport);
  senders.set(transport, sender);
  return sender;
}

/**
 * Get the sender for a message. When no override transport is given, the
 * transport is chosen per message: SMTP for one-person email, SES for
 * marketing batches.
 */
export function getSender(message?: EmailMessage, overrideTransport?: EmailTransport | null): EmailSender {
  const transport =
    overrideTransport ??
    (message ? transportForMessage(message) : readTransport() ?? 'console');
  return getSenderForTransport(transport);
}

/** Sends one email and throws when the transport rejects it. */
export async function sendEmail(message: EmailMessage): Promise<{ id: string }> {
  return getSender(message).send(message);
}

export const TEAM_EMAIL = process.env.TEAM_EMAIL || 'team@get-on.tech';

export function createMemorySender(): MemorySender {
  return memorySender;
}
