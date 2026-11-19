import type { ReactNode } from 'react';
import type { Me } from '@truhost/shared';
import { PageHeader } from '../ui/page-header';
import { Skeleton } from '../ui/skeleton';
import { AvatarCard } from './avatar-card';
import { SettingsNav } from './settings-nav';

/**
 * The Settings page around its open section: the profile banner (photo, name, role, email, and their guide) across
 * the top of every section, then the section nav in a card beside the section (above it on phones).
 */
export function SettingsShell({
  me,
  preview,
  children,
}: {
  /** Undefined while it loads: the banner's outline shows. */
  me: Me | undefined;
  /** Dev preview only (SettingsNav). */
  preview?: { active: string; onPick: (to: string) => void };
  children: ReactNode;
}) {
  return (
    <>
      <PageHeader title="Settings" description="Your profile, how you sign in, and how TruHost works for you." />
      <div className="flex flex-col gap-6">
        {me ? <AvatarCard me={me} /> : <Skeleton className="h-44 rounded-card" />}
        <div className="grid grid-cols-1 gap-6 @4xl/content:grid-cols-[16rem_minmax(0,1fr)] @4xl/content:gap-8">
          <div className="min-w-0 @4xl/content:sticky @4xl/content:top-6 @4xl/content:self-start">
            <SettingsNav preview={preview} />
          </div>
          <div className="flex max-w-4xl min-w-0 flex-col gap-6">{children}</div>
        </div>
      </div>
    </>
  );
}
