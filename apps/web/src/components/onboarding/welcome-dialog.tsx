import { useState } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import type { Me, OnboardingTour } from '@truhost/shared';
import { useApi } from '../../lib/api-context';
import { guideFromApi, guideToApi, type GuideCharacter } from '../../lib/guides';
import { queries } from '../../lib/queries';
import { TOURS } from '../../lib/tours';
import { GuidePicker } from '../guide/guide-picker';
import { ErrorAlert } from '../ui/alert';
import { Button } from '../ui/button';

/**
 * The welcome (docs/design/Onboarding.dc.html): the guide waves and introduces themselves, the user can pick another
 * guide (saved straight away, as in Settings), sees what the tour covers, and starts it or skips it. Closing it (Escape)
 * only puts it off until next time; "Skip for now" records the skip, and Help can replay the tour.
 */
export function WelcomeDialog({
  me,
  tour,
  onStart,
  onSkip,
  onClose,
}: {
  me: Me;
  tour: OnboardingTour;
  onStart: () => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  const api = useApi();
  const qc = useQueryClient();
  const [picked, setPicked] = useState<GuideCharacter | null>(null);
  const save = useMutation({
    mutationFn: (guide: GuideCharacter) => unwrap(api.PATCH('/v1/me', { body: { guide: guideToApi(guide) } })),
    onSuccess: (data) => qc.setQueryData(queries.me(api).queryKey, data),
    onSettled: () => setPicked(null),
  });
  const def = TOURS[tour.role];
  const resume = tour.status === 'IN_PROGRESS' && (tour.step ?? 0) > 0;

  return (
    <RadixDialog.Root open onOpenChange={(open) => !open && onClose()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-ink/40 animate-fade-in" />
        <RadixDialog.Content
          aria-describedby={undefined}
          className="@container/content fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[38rem] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-card border border-line-soft bg-surface p-6 pb-0 shadow-xl animate-pop-in focus:outline-none @md/content:p-8 @md/content:pb-0"
        >
          <RadixDialog.Title className="sr-only">Welcome to TruHost</RadixDialog.Title>
          <GuidePicker
            value={picked ?? guideFromApi(me.guide)}
            onChange={(g) => {
              setPicked(g);
              save.mutate(g);
            }}
            firstName={me.firstName}
            disabled={save.isPending}
            message={
              resume
                ? 'Welcome back. Let’s pick up the tour where we left off.'
                : `I’ll show you around ${def.portal}. It takes a few minutes, and you can stop any time.`
            }
          />
          {save.error && (
            <div className="mt-3">
              <ErrorAlert error={save.error} />
            </div>
          )}
          <div className="mt-6">
            <p className="text-[13px] font-semibold text-ink">What we’ll cover</p>
            <ol className="mt-1 divide-y divide-line-soft">
              {def.chapters.map((c, i) => (
                <li key={c.title} className="flex items-center gap-3.5 py-3">
                  <span
                    aria-hidden
                    className="figure grid size-7 shrink-0 place-items-center rounded-full border-2 border-line text-xs font-bold text-muted"
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">{c.title}</span>
                    <span className="block text-[13px] text-muted">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          {/* Kept in reach at the bottom while the rest scrolls (phones). */}
          <div className="sticky bottom-0 -mx-6 mt-4 border-t border-line-soft bg-surface px-6 pt-4 pb-6 @md/content:-mx-8 @md/content:px-8 @md/content:pb-8">
            <div className="flex flex-col gap-2 @md/content:flex-row @md/content:items-center">
              <Button onClick={onStart} className="min-h-12 @md/content:flex-1">
                {resume ? 'Continue the tour' : 'Start the tour'}
              </Button>
              <Button variant="quiet" onClick={onSkip} className="min-h-12 @md/content:px-6">
                Skip for now
              </Button>
            </div>
            <p className="mt-3 text-center text-xs text-muted">
              You can replay it any time from Help, in your profile menu.
            </p>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
