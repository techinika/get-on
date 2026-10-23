import { ConsoleSender, MemorySender, SesSender, memorySender } from './senders';
import type { EmailMessage, EmailSender } from './types';

export { memorySender };
export * from './types';
export * from './senders';
export * from './templates';
export * from './layout';

export type EmailTransport = 'ses' | 'console' | 'memory';

let sender: EmailSender | null = null;
let senderTransport: EmailTransport | null = null;

export function readTransport(): EmailTransport {
  const value = (process.env.EMAIL_TRANSPORT ?? '').toLowerCase();
  if (value === 'ses' || value === 'console' || value === 'memory') return value;
  return process.env.AWS_ACCESS_KEY_ID ? 'ses' : 'console';
}

export function getSender(transport: EmailTransport = readTransport()): EmailSender {
  if (sender && senderTransport === transport) return sender;
  senderTransport = transport;
  if (transport === 'ses') {
    sender = new SesSender({ teamEmail: process.env.TEAM_EMAIL || 'team@get-on.tech' });
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
