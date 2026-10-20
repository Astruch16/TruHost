import { Link } from '@tanstack/react-router';
import type { Me, OnboardingRole } from '@truhost/shared';
import { ChevronDown, Play } from 'lucide-react';
import { GUIDES, guideFromApi } from '../../lib/guides';
import { HELP_ANSWERS } from '../../lib/help';
import { tourName } from '../../lib/tours';
import { Guide } from '../guide/guide';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';

/**
 * Help, from the profile menu and the sidebar: replay a welcome tour (one per role held), change the guide, and short
 * "How do I…" answers for each role.
 */
export function HelpDialog({
  open,
  onOpenChange,
  me,
  roles,
  onReplay,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  me: Me;
  roles: OnboardingRole[];
  onReplay: (role: OnboardingRole) => void;
}) {
  const character = guideFromApi(me.guide);
  const g = GUIDES[character];
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Help"
      description="Replay the welcome tour, change your guide, or find a quick answer."
    >
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-2.5" aria-label="Welcome tour">
          {roles.map((role) => (
            <div key={role} className="flex items-center gap-3.5 rounded-inner border border-line bg-surface p-3.5">
              <span
                className="grid size-12 shrink-0 place-items-center rounded-full"
                style={{ backgroundColor: g.tint }}
              >
                <Guide character={character} size={44} ground={false} decorative />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">Need a hand?</p>
                <p className="text-sm text-muted">
                  {g.name} can show you around again: replay {tourName(role)}.
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => onReplay(role)}>
                <Play aria-hidden className="size-3.5" /> Replay
              </Button>
            </div>
          ))}
          <p className="text-sm text-muted">
            {g.name} is your guide.{' '}
            <Link
              to="/account/preferences"
              onClick={() => onOpenChange(false)}
              className="font-semibold text-primary hover:underline"
            >
              Change your guide
            </Link>
          </p>
        </section>

        {roles.map((role) => (
          <section key={role} aria-label={`How do I… (${tourName(role).replace('the ', '').replace(' tour', '')})`}>
            <h3 className="text-sm font-semibold text-ink">
              How do I…
              {roles.length > 1 ? ` (${role === 'ADMIN' ? 'admin' : role === 'OWNER' ? 'owner' : 'cleaner'})` : ''}
            </h3>
            <div className="mt-2 divide-y divide-line-soft rounded-inner border border-line">
              {HELP_ANSWERS[role].map(({ q, a }) => (
                <details key={q} className="group px-4">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3 font-medium text-ink [&::-webkit-details-marker]:hidden">
                    {q}
                    <ChevronDown
                      aria-hidden
                      className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <p className="pb-4 text-sm leading-relaxed text-muted">{a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
