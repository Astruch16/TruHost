import { useMemo, useState } from 'react';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NOTIFICATION_CATALOGUE, type Me, type NotificationSetting } from '@truhost/shared';
import { NotificationSettings } from '../../components/settings/notifications-section';
import { PreferenceSettings } from '../../components/settings/preferences-section';
import { ProfileSettings } from '../../components/settings/profile-section';
import { SecuritySettings } from '../../components/settings/security-section';
import { SettingsNav } from '../../components/settings/settings-nav';
import { AppShell } from '../../components/shell/app-shell';
import { PageHeader } from '../../components/ui/page-header';
import { navItems } from '../../lib/nav';
import { PreferencesContext } from '../../lib/preferences';
import { SecurityUserContext, type SecurityUser } from '../../lib/security-user';

type Role = 'admin' | 'owner' | 'cleaner';
interface Search {
  section?: string;
  role?: Role;
  photo?: boolean;
  twoStep?: boolean;
}

/** Dev only: the Settings sections with sample data (no API or sign-in), for review screenshots. */
export const Route = createFileRoute('/dev/settings')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  validateSearch: (s: Record<string, unknown>): Search => ({
    section: typeof s.section === 'string' ? s.section : undefined,
    role: s.role === 'owner' || s.role === 'cleaner' ? s.role : s.role === 'admin' ? 'admin' : undefined,
    photo: s.photo === true || s.photo === 'true' ? true : undefined,
    twoStep: s.twoStep === true || s.twoStep === 'true' ? true : undefined,
  }),
  component: SettingsPreview,
});

const PORTRAIT = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c9dccf"/><stop offset="1" stop-color="#9fbcd8"/></linearGradient></defs><rect width="256" height="256" fill="url(#g)"/><circle cx="128" cy="104" r="46" fill="#e9c3a0"/><path d="M82 96c0-30 20-50 46-50s46 20 46 48c-10-14-26-20-46-20s-34 8-46 22z" fill="#5a3a2a"/><path d="M40 256c6-52 44-80 88-80s82 28 88 80z" fill="#23442f"/></svg>`,
)}`;

const PEOPLE: Record<Role, Me> = {
  admin: {
    id: '0192f000-0000-7000-8000-000000000001',
    email: 'adam@truhost.ca',
    firstName: 'Adam',
    lastName: 'Struch',
    phone: '(604) 555-0144',
    staffRole: 'ADMIN',
    status: 'ACTIVE',
    guide: 'SAGE',
    avatar: null,
    weekStartsOn: 0,
    motion: 'SYSTEM',
    memberships: [{ id: 'm1', role: 'OWNER', property: { id: 'p1', name: 'Cedar Suite' } }],
  },
  owner: {
    id: '0192f000-0000-7000-8000-000000000002',
    email: 'priya.shah@example.com',
    firstName: 'Priya',
    lastName: 'Shah',
    phone: null,
    staffRole: null,
    status: 'ACTIVE',
    guide: 'JUNIPER',
    avatar: null,
    weekStartsOn: 1,
    motion: 'SYSTEM',
    memberships: [
      { id: 'm2', role: 'OWNER', property: { id: 'p1', name: 'Cedar Suite' } },
      { id: 'm3', role: 'OWNER', property: { id: 'p2', name: 'Harbour View Loft' } },
    ],
  },
  cleaner: {
    id: '0192f000-0000-7000-8000-000000000003',
    email: 'marco@example.com',
    firstName: 'Marco',
    lastName: 'Diaz',
    phone: '(778) 555-0102',
    staffRole: null,
    status: 'ACTIVE',
    guide: 'PIP',
    avatar: null,
    weekStartsOn: 0,
    motion: 'REDUCED',
    memberships: [{ id: 'm4', role: 'CLEANER', property: { id: 'p1', name: 'Cedar Suite' } }],
  },
};

function notificationDefaults(me: Me): NotificationSetting[] {
  const roles = new Set<string>([...(me.staffRole ? ['ADMIN'] : []), ...me.memberships.map((m) => m.role)]);
  return NOTIFICATION_CATALOGUE.filter((c) => c.roles.some((r) => roles.has(r))).map((c, i) => ({
    category: c.category,
    email: c.channels.includes('email') && (i === 1 ? false : c.defaults.email),
    inApp: c.channels.includes('inApp') && c.defaults.inApp,
  }));
}

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

function sampleUser(twoStep: boolean, email: string): SecurityUser {
  const never = () => new Promise<never>(() => undefined);
  const sessions = [
    {
      id: 'this',
      status: 'active',
      lastActiveAt: minutesAgo(0),
      latestActivity: {
        id: 'a1',
        browserName: 'Chrome',
        deviceType: 'Windows',
        city: 'Vancouver',
        country: 'CA',
        isMobile: false,
      },
    },
    {
      id: 's2',
      status: 'active',
      lastActiveAt: minutesAgo(140),
      latestActivity: {
        id: 'a2',
        browserName: 'Safari',
        deviceType: 'iPhone',
        city: 'Vancouver',
        country: 'CA',
        isMobile: true,
      },
    },
    {
      id: 's3',
      status: 'active',
      lastActiveAt: minutesAgo(60 * 24 * 4),
      latestActivity: {
        id: 'a3',
        browserName: 'Firefox',
        deviceType: 'Macintosh',
        city: 'Kelowna',
        country: 'CA',
        isMobile: false,
      },
    },
  ];
  return {
    passwordEnabled: true,
    externalAccounts: [{ provider: 'google', emailAddress: email }],
    totpEnabled: twoStep,
    backupCodeEnabled: twoStep,
    primaryEmailAddress: { emailAddress: email },
    updatePassword: never,
    createTOTP: () =>
      Promise.resolve({
        secret: 'JBSWY3DPEHPK3PXPJBSWY3DP',
        uri: `otpauth://totp/TruHost:${email}?secret=JBSWY3DPEHPK3PXPJBSWY3DP&issuer=TruHost`,
      }),
    verifyTOTP: () =>
      Promise.resolve({
        backupCodes: [
          'k7m2-qp4x',
          'b9fr-2wde',
          'h3ns-8vxa',
          'p5tq-6jcm',
          'w2zl-4ryk',
          'c8gu-1mbe',
          'v6dh-9sto',
          'e4ya-3knf',
          'r1xp-7lwq',
          'm3ce-5uhz',
        ],
      }),
    disableTOTP: never,
    createBackupCode: never,
    getSessions: () => Promise.resolve(sessions),
    reload: () => Promise.resolve(),
  } as unknown as SecurityUser;
}

function SettingsPreview() {
  const { section = '/account', role = 'admin', photo, twoStep } = Route.useSearch();
  const navigate = Route.useNavigate();
  const me = useMemo(
    () => ({ ...PEOPLE[role], avatar: photo ? { url: PORTRAIT, expiresAt: '2099-01-01T00:00:00.000Z' } : null }),
    [role, photo],
  );
  const [client] = useState(() => {
    const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    qc.setQueryData(['me'], me);
    qc.setQueryData(['me', 'notification-settings'], { items: notificationDefaults(me) });
    return qc;
  });
  const security = useMemo(
    () => ({ user: sampleUser(Boolean(twoStep), me.email), sessionId: 'this' }),
    [twoStep, me.email],
  );
  const body = {
    '/account': <ProfileSettings />,
    '/account/security': <SecuritySettings />,
    '/account/notifications': <NotificationSettings />,
    '/account/preferences': <PreferenceSettings />,
  }[section] ?? <ProfileSettings />;

  return (
    <QueryClientProvider client={client}>
      <SecurityUserContext.Provider value={security}>
        <PreferencesContext.Provider value={{ weekStartsOn: me.weekStartsOn, motion: me.motion }}>
          <AppShell
            nav={navItems(me)}
            user={{
              name: `${me.firstName} ${me.lastName}`,
              initials: `${me.firstName[0]}${me.lastName[0]}`,
              role: role === 'admin' ? 'Admin' : role === 'owner' ? 'Owner' : 'Cleaner',
              email: me.email,
              avatarUrl: me.avatar?.url ?? null,
            }}
            properties={[]}
            selectedPropertyId={null}
            onSelectProperty={() => undefined}
            onSignOut={() => undefined}
          >
            <PageHeader title="Settings" description="Your profile, how you sign in, and how TruHost works for you." />
            <div className="grid grid-cols-1 gap-6 @4xl/content:grid-cols-[15rem_minmax(0,1fr)] @4xl/content:gap-10">
              <div className="min-w-0 @4xl/content:sticky @4xl/content:top-6 @4xl/content:self-start">
                <SettingsNav
                  preview={{
                    active: section,
                    onPick: (to) => void navigate({ search: (s) => ({ ...s, section: to }) }),
                  }}
                />
              </div>
              <div className="flex max-w-3xl min-w-0 flex-col gap-6">{body}</div>
            </div>
          </AppShell>
        </PreferencesContext.Provider>
      </SecurityUserContext.Provider>
    </QueryClientProvider>
  );
}
