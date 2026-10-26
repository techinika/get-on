import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import type { EmailMessage, EmailSender, EmailSendResult } from './types';

/** Removes anything that could start a new header. */
export function safeHeader(value: string, max = 998): string {
  return String(value)
    .replace(/[\r\n]+/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, max);
}

export function safeFromName(value: string | undefined): string {
  const clean = safeHeader(value || 'Get-On', 60).replace(/[<>"]/g, '');
  return clean || 'Get-On';
}

export class SesSender implements EmailSender {
  private client: SESv2Client;
  private configurationSetName?: string;
  private teamEmail: string;

  constructor(
    opts: { region?: string; configurationSetName?: string; teamEmail?: string } = {},
  ) {
    this.client = new SESv2Client({
      region: opts.region || process.env.AWS_REGION || 'eu-west-1',
    });
    this.configurationSetName =
      opts.configurationSetName || process.env.SES_CONFIGURATION_SET;
    this.teamEmail = opts.teamEmail || process.env.TEAM_EMAIL || 'team@get-on.tech';
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const fromAddress = safeHeader(message.from || this.teamEmail, 254);
    const command = new SendEmailCommand({
      FromEmailAddress: `"${safeFromName(message.fromName)}" <${fromAddress}>`,
      Destination: { ToAddresses: [safeHeader(message.to, 254)] },
      ReplyToAddresses: message.replyTo ? [safeHeader(message.replyTo, 254)] : undefined,
      Content: {
        Simple: {
          Subject: { Data: safeHeader(message.subject, 180), Charset: 'UTF-8' },
          Body: {
            Text: { Data: message.text, Charset: 'UTF-8' },
            Html: { Data: message.html, Charset: 'UTF-8' },
          },
        },
      },
      ConfigurationSetName: this.configurationSetName,
      EmailTags: [{ Name: 'kind', Value: safeHeader(message.kind, 60) || 'platform' }],
    });

    const res = await this.client.send(command);
    return { id: res.MessageId || '' };
  }
}

export class ConsoleSender implements EmailSender {
  async send(message: EmailMessage): Promise<EmailSendResult> {
    console.info(
      `[email:console] kind=${message.kind} to=${message.to} subject=${JSON.stringify(message.subject)}\n${message.text}`,
    );
    return { id: `console-${Date.now()}` };
  }
}

export class MemorySender implements EmailSender {
  public messages: Array<EmailMessage & { id: string; sentAt: string }> = [];

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const id = `mem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.messages.push({ ...message, id, sentAt: new Date().toISOString() });
    return { id };
  }

  clear() {
    this.messages = [];
  }
}

export const memorySender = new MemorySender();
