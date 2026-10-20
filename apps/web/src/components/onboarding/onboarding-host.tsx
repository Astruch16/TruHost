import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import type { Me, OnboardingRole, UpdateTour } from '@truhost/shared';
import { useApi } from '../../lib/api-context';
import { guideFromApi } from '../../lib/guides';
import { queries } from '../../lib/queries';
import { offeredTour, tourSteps } from '../../lib/tours';
import { HelpDialog } from './help-dialog';
import { TourOverlay } from './tour-overlay';
import { WelcomeDialog } from './welcome-dialog';

/**
 * Onboarding for the signed-in user (docs/spec.md, Phase 4b): the welcome for the first tour still offered (one per
 * role held), the tour itself, and Help. Progress is saved in the API as the tour moves, so an interrupted tour
 * resumes where it stopped, on any device. Never blocks: the welcome can be put off or skipped, and so can the tour.
 */
export function OnboardingHost({
  me,
  helpOpen,
  onHelpOpenChange,
}: {
  me: Me;
  helpOpen: boolean;
  onHelpOpenChange: (open: boolean) => void;
}) {
  const api = useApi();
  const qc = useQueryClient();
  const onboarding = useQuery(queries.onboarding(api));
  const save = useMutation({
    mutationFn: ({ role, body }: { role: OnboardingRole; body: UpdateTour }) =>
      unwrap(api.POST('/v1/me/onboarding/tours/{role}', { params: { path: { role } }, body })),
    onSuccess: (data) => qc.setQueryData(queries.onboarding(api).queryKey, data),
  });
  const [active, setActive] = useState<{ role: OnboardingRole; index: number; direction: 1 | -1 } | null>(null);
  // Once the welcome is closed, started or skipped, it waits until the next visit.
  const [welcomeDone, setWelcomeDone] = useState(false);
  const offered = offeredTour(onboarding.data);
  const steps = active ? tourSteps(active.role, me) : [];
  const step = active ? steps[active.index] : undefined;

  const record = (role: OnboardingRole, body: UpdateTour) => save.mutate({ role, body });
  const start = (role: OnboardingRole, from = 0) => {
    const count = tourSteps(role, me).length;
    if (count === 0) return;
    const index = Math.min(from, count - 1);
    setWelcomeDone(true);
    setActive({ role, index, direction: 1 });
    record(role, { action: 'START', step: index });
  };
  const go = (direction: 1 | -1) => {
    if (!active) return;
    const index = active.index + direction;
    if (index < 0) return setActive({ ...active, direction: 1 });
    if (index >= steps.length) return finish();
    setActive({ ...active, index, direction });
    record(active.role, { action: 'STEP', step: index });
  };
  const finish = () => {
    if (!active) return;
    record(active.role, { action: 'COMPLETE' });
    setActive(null);
  };
  const skip = () => {
    if (!active) return;
    record(active.role, { action: 'SKIP', step: active.index });
    setActive(null);
  };

  return (
    <>
      {offered && !active && !welcomeDone && (
        <WelcomeDialog
          me={me}
          tour={offered}
          onStart={() => start(offered.role, offered.status === 'IN_PROGRESS' ? (offered.step ?? 0) : 0)}
          onSkip={() => {
            setWelcomeDone(true);
            record(offered.role, { action: 'SKIP' });
          }}
          onClose={() => setWelcomeDone(true)}
        />
      )}
      {active && step && (
        <TourOverlay
          step={step}
          index={active.index}
          count={steps.length}
          guide={guideFromApi(me.guide)}
          onBack={() => go(-1)}
          onNext={() => go(1)}
          onSkip={skip}
          // Passing over the first step backwards would leave nothing to show: go forwards instead.
          onPassOver={() => go(active.index === 0 ? 1 : active.direction)}
        />
      )}
      <HelpDialog
        open={helpOpen}
        onOpenChange={onHelpOpenChange}
        me={me}
        roles={onboarding.data?.tours.map((t) => t.role) ?? []}
        onReplay={(role) => {
          onHelpOpenChange(false);
          start(role);
        }}
      />
    </>
  );
}
