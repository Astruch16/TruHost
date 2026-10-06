import { Logger } from '@nestjs/common';
import type { EmailMessage, EmailSender } from './email-sender.js';

/** Resend over its REST API (no SDK needed for one endpoint). */
export class ResendEmailSender implements EmailSender {
  private readonly logger = new Logger(ResendEmailSender.name);

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<{ id: string }> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, ...message }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      // Log the provider's reason (never the message body) and fail the caller.
      this.logger.error(`Resend rejected email (${res.status}): ${await res.text()}`);
      throw new Error(`Email delivery failed (${res.status})`);
    }
    const { id } = (await res.json()) as { id: string };
    return { id };
  }
}

/** Local development without a Resend key: print the email (including links) to the API log. */
export class LogEmailSender implements EmailSender {
  private readonly logger = new Logger('Email');

  send(message: EmailMessage): Promise<{ id: null }> {
    this.logger.log(`[not sent: RESEND_API_KEY unset] To: ${message.to} | ${message.subject}\n${message.text}`);
    return Promise.resolve({ id: null });
  }
}
