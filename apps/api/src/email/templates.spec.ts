import { inviteEmail } from './templates.js';

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
