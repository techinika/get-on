import type { EmailStream } from "./streams";

export interface EmailSendResult {
  id: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Overrides the stream reply-to. The sender address itself is fixed. */
  replyTo?: string;
  kind: string;
  /** Chosen by the catalogue. Falls back to the kind prefix. */
  stream?: EmailStream;
  relatedType?: string;
  relatedId?: string;
  headers?: Record<string, string>;
  /** @deprecated The sender comes from the stream, never from the message. */
  from?: string;
  /** @deprecated The name comes from the stream. */
  fromName?: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<EmailSendResult>;
}
