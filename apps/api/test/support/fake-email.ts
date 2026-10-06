import type { EmailMessage, EmailSender } from '../../src/email/email-sender.js';

/** Captures emails instead of sending them. Set `fail` to simulate a provider outage. */
export class FakeEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];
  fail = false;
  private seq = 0;

  send(message: EmailMessage): Promise<{ id: string }> {
    if (this.fail) return Promise.reject(new Error('provider down'));
    this.sent.push(message);
    return Promise.resolve({ id: `email_${++this.seq}` });
  }

  reset(): void {
    this.sent.length = 0;
    this.fail = false;
    this.seq = 0;
  }
}
