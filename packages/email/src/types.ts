export interface EmailSendResult {
  id: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  fromName?: string;
  kind: string;
  /** Optional sender address. Defaults to TEAM_EMAIL. */
  from?: string;
  relatedType?: string;
  relatedId?: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<EmailSendResult>;
}
