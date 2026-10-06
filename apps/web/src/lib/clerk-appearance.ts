/** Styles Clerk's sign-in/up components with our tokens so they sit naturally in the auth frame. */
export const clerkAppearance = {
  variables: {
    colorPrimary: '#173f3a',
    colorText: '#1a1d21',
    colorTextSecondary: '#5b6068',
    colorBackground: '#ffffff',
    colorInputBackground: '#ffffff',
    colorDanger: '#8a2c24',
    fontFamily: "'Hanken Grotesk Variable', ui-sans-serif, system-ui, sans-serif",
    borderRadius: '12px',
  },
  elements: {
    card: { boxShadow: 'none', border: '1px solid #eeeeeb', borderRadius: '18px' },
    formButtonPrimary: { fontWeight: 600, textTransform: 'none' },
  },
} as const;
