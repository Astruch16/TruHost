import type { EmailMessage } from './email-sender.js';

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Invitation to create a TruHost account. `url` is the Clerk sign-up ticket link. */
export function inviteEmail(to: { email: string; firstName: string }, url: string): EmailMessage {
  const name = to.firstName.trim() || 'there';
  const text = [
    `Hi ${name},`,
    '',
    'You’ve been invited to TruHost, our property management portal.',
    'Create your account here:',
    url,
    '',
    'If you weren’t expecting this, you can ignore this email.',
    '— TruHost',
  ].join('\n');
  const html = `<!doctype html><html><body style="margin:0;background:#f6f6f3;font-family:Arial,Helvetica,sans-serif;color:#1a1d21">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border:1px solid #eeeeeb;border-radius:18px">
<tr><td style="background:#173f3a;border-radius:18px 18px 0 0;padding:20px 28px;color:#eef3f1;font-size:22px;font-weight:bold">TruHost</td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 12px;font-size:16px">Hi ${escape(name)},</p>
<p style="margin:0 0 24px;font-size:16px;line-height:1.5">You’ve been invited to TruHost, our property management portal.</p>
<p style="margin:0 0 24px"><a href="${escape(url)}" style="display:inline-block;background:#173f3a;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:12px">Create your account</a></p>
<p style="margin:0;font-size:13px;color:#5b6068;line-height:1.5">If the button doesn’t work, copy this link into your browser:<br>${escape(url)}</p>
<p style="margin:24px 0 0;font-size:13px;color:#5b6068">If you weren’t expecting this, you can ignore this email.</p>
</td></tr></table></td></tr></table></body></html>`;
  return { to: to.email, subject: 'You’re invited to TruHost', text, html };
}

/**
 * A supply at one of the recipient's properties reached its restock point, or ran out. `url` opens the property in
 * TruHost.
 */
export function supplyAlertEmail(
  to: { email: string; firstName: string },
  alert: { out: boolean; item: string; property: string; levelPct: number; thresholdPct: number; url: string },
): EmailMessage {
  const name = to.firstName.trim() || 'there';
  const headline = alert.out ? `${alert.item} has run out` : `${alert.item} is running low`;
  const detail = alert.out
    ? `${alert.item} at ${alert.property} was just marked empty.`
    : `${alert.item} at ${alert.property} is down to ${alert.levelPct}% (it’s restocked at ${alert.thresholdPct}%).`;
  const text = [
    `Hi ${name},`,
    '',
    detail,
    'It needs restocking before the next guests.',
    '',
    alert.url,
    '',
    '— TruHost',
  ].join('\n');
  const html = `<!doctype html><html><body style="margin:0;background:#f6f6f3;font-family:Arial,Helvetica,sans-serif;color:#1a1d21">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border:1px solid #eeeeeb;border-radius:18px">
<tr><td style="background:#173f3a;border-radius:18px 18px 0 0;padding:20px 28px;color:#eef3f1;font-size:22px;font-weight:bold">TruHost</td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 12px;font-size:16px">Hi ${escape(name)},</p>
<p style="margin:0 0 8px;font-size:20px;font-weight:bold">${escape(headline)}</p>
<p style="margin:0 0 20px;font-size:16px;line-height:1.5">${escape(detail)} It needs restocking before the next guests.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px"><tr><td style="background:#eeeeeb;border-radius:999px;height:10px">
<div style="width:${Math.max(alert.levelPct, 2)}%;height:10px;border-radius:999px;background:${alert.out ? '#8a2c24' : '#c99a2e'}"></div>
</td></tr></table>
<p style="margin:0 0 8px"><a href="${escape(alert.url)}" style="display:inline-block;background:#173f3a;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:12px">Open ${escape(alert.property)}</a></p>
<p style="margin:24px 0 0;font-size:13px;color:#5b6068">You get these because supply alerts are on in your TruHost settings.</p>
</td></tr></table></td></tr></table></body></html>`;
  return { to: to.email, subject: headline + ` · ${alert.property}`, text, html };
}

/** Damage was reported at one of the recipient's properties. `url` opens the property in TruHost. */
export function damageReportEmail(
  to: { email: string; firstName: string },
  report: {
    title: string;
    property: string;
    severity: string;
    reporter: string;
    discoveredOn: string;
    photoCount: number;
    url: string;
  },
): EmailMessage {
  const name = to.firstName.trim() || 'there';
  const headline = `Damage reported at ${report.property}`;
  const photos = `${report.photoCount} photo${report.photoCount === 1 ? '' : 's'}`;
  const detail = `${report.reporter} reported “${report.title}” (${report.severity.toLowerCase()}), found on ${report.discoveredOn}, with ${photos}.`;
  const text = [
    `Hi ${name},`,
    '',
    detail,
    'Open it to see the photos and the stay it’s linked to.',
    '',
    report.url,
    '',
    '— TruHost',
  ].join('\n');
  const html = `<!doctype html><html><body style="margin:0;background:#f6f6f3;font-family:Arial,Helvetica,sans-serif;color:#1a1d21">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border:1px solid #eeeeeb;border-radius:18px">
<tr><td style="background:#173f3a;border-radius:18px 18px 0 0;padding:20px 28px;color:#eef3f1;font-size:22px;font-weight:bold">TruHost</td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 12px;font-size:16px">Hi ${escape(name)},</p>
<p style="margin:0 0 8px;font-size:20px;font-weight:bold">${escape(headline)}</p>
<p style="margin:0 0 20px;font-size:16px;line-height:1.5">${escape(detail)} Open it to see the photos and the stay it’s linked to.</p>
<p style="margin:0 0 8px"><a href="${escape(report.url)}" style="display:inline-block;background:#173f3a;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:12px">Open ${escape(report.property)}</a></p>
<p style="margin:24px 0 0;font-size:13px;color:#5b6068">You get these because damage report alerts are on in your TruHost settings.</p>
</td></tr></table></td></tr></table></body></html>`;
  return { to: to.email, subject: `${headline}: ${report.title}`, text, html };
}
