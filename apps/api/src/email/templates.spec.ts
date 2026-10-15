import { inviteEmail, statementReleasedEmail } from './templates.js';

describe('inviteEmail', () => {
  it('includes the sign-up link in both text and HTML', () => {
    const m = inviteEmail(
      { email: 'a@example.test', firstName: 'Ann' },
      'https://app.example/sign-up?__clerk_ticket=abc',
    );
    expect(m.to).toBe('a@example.test');
    expect(m.text).toContain('https://app.example/sign-up?__clerk_ticket=abc');
    expect(m.html).toContain('href="https://app.example/sign-up?__clerk_ticket=abc"');
  });

  it('escapes names and links in HTML', () => {
    const m = inviteEmail({ email: 'a@example.test', firstName: '<b>Ann</b>' }, 'https://x.example/?a=1&b="2"');
    expect(m.html).toContain('&lt;b&gt;Ann&lt;/b&gt;');
    expect(m.html).not.toContain('<b>Ann</b>');
    expect(m.html).toContain('a=1&amp;b=&quot;2&quot;');
  });
});

describe('statementReleasedEmail', () => {
  it('gives the net, the payment date and the link, escaped in HTML', () => {
    const m = statementReleasedEmail(
      { email: 'o@example.test', firstName: 'Olive' },
      {
        property: 'Cedar <Cabin>',
        month: 'September 2026',
        net: '$2,762.15',
        releasedOn: 'Oct 5, 2026',
        url: 'https://app.example/s/1',
      },
    );
    expect(m.subject).toBe('Your September 2026 statement for Cedar <Cabin>');
    expect(m.text).toContain('We sent you $2,762.15 on Oct 5, 2026.');
    expect(m.text).toContain('https://app.example/s/1');
    expect(m.html).toContain('Cedar &lt;Cabin&gt;');
    expect(m.html).toContain('href="https://app.example/s/1"');
  });
});
