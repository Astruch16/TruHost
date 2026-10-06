export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Sends transactional email. Resend in deployed environments; logged locally; faked in tests. */
export interface EmailSender {
  /** Returns the provider's message id, or null when the message was only logged. Throws on delivery failure. */
  send(message: EmailMessage): Promise<{ id: string | null }>;
}

export const EMAIL_SENDER = Symbol('EMAIL_SENDER');
