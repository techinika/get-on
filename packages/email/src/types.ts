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
  relatedType?: string;
  relatedId?: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<EmailSendResult>;
}
