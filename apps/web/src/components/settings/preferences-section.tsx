import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@truhost/api-client';
import type { Me, UpdateMe } from '@truhost/shared';
import { GuidePicker } from '../guide/guide-picker';
import { ChoiceCards } from './choice-cards';
import { MotionPreview, WeekPreview } from './preference-previews';
import { ErrorAlert, LoadError } from '../ui/alert';
import { Card } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { useApi } from '../../lib/api-context';
import { guideFromApi, guideToApi, type GuideCharacter } from '../../lib/guides';
import { queries } from '../../lib/queries';

/** Saves one preference straight away; it shows at once (the profile is updated optimistically) and rolls back on failure. */
function useSavePreference() {
  const api = useApi();
  const qc = useQueryClient();
  const key = queries.me(api).queryKey;
  return useMutation({
    mutationFn: (body: UpdateMe) => unwrap(api.PATCH('/v1/me', { body })),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: key });
      const before = qc.getQueryData(key);
      if (before) qc.setQueryData(key, { ...before, ...body } as Me);
      return { before };
    },
    onError: (_e, _body, context) => qc.setQueryData(key, context?.before),
    onSuccess: (data) => qc.setQueryData(key, data),
  });
}

export function PreferenceSettings() {
  const me = useQuery(queries.me(useApi()));
  const save = useSavePreference();
  if (me.error) return <LoadError what="your preferences" onRetry={() => void me.refetch()} retrying={me.isFetching} />;
  if (!me.data) return <Skeleton className="h-80 rounded-card" />;
  const { weekStartsOn, motion } = me.data;

  return (
    <>
      <GuideCard firstName={me.data.firstName} saved={guideFromApi(me.data.guide)} />
      <Card title="Calendars" description="The first day of the week in every calendar and date picker.">
        <ChoiceCards
          label="Week starts on"
          value={weekStartsOn}
          onChange={(v) => save.mutate({ weekStartsOn: v })}
          options={[
            {
              value: 0,
              title: 'Sunday',
              description: 'Common in Canada and the US.',
              preview: <WeekPreview weekStartsOn={0} />,
            },
            {
              value: 1,
              title: 'Monday',
              description: 'Weekends together at the end.',
              preview: <WeekPreview weekStartsOn={1} />,
            },
          ]}
        />
      </Card>
      <Card title="Motion" description="Animations in TruHost: menus, loading shimmer and your guide.">
        <ChoiceCards
          label="Motion"
          value={motion}
          onChange={(v) => save.mutate({ motion: v })}
          options={[
            {
              value: 'SYSTEM',
              title: 'Match my device',
              description: 'Full motion, unless your device asks for less.',
              preview: <MotionPreview reduced={false} />,
            },
            {
              value: 'REDUCED',
              title: 'Reduce motion',
              description: 'Things appear without sliding, fading or bouncing.',
              preview: <MotionPreview reduced />,
            },
          ]}
        />
      </Card>
      <ErrorAlert error={save.error} />
    </>
  );
}

/** Picking a guide saves it straight away; the choice shows at once and rolls back if the save fails. */
function GuideCard({ firstName, saved }: { firstName: string; saved: GuideCharacter }) {
  const api = useApi();
  const qc = useQueryClient();
  const [picked, setPicked] = useState<GuideCharacter | null>(null);
  const save = useMutation({
    mutationFn: (guide: GuideCharacter) => unwrap(api.PATCH('/v1/me', { body: { guide: guideToApi(guide) } })),
    onSuccess: (data) => qc.setQueryData(queries.me(api).queryKey, data),
    onSettled: () => setPicked(null),
  });
  const pick = (guide: GuideCharacter) => {
    setPicked(guide);
    save.mutate(guide);
  };

  return (
    <Card title="Your guide" description="Keeps you company on empty pages and cheers when something goes well.">
      <div className="flex flex-col gap-4">
        <GuidePicker value={picked ?? saved} onChange={pick} firstName={firstName} disabled={save.isPending} />
        <ErrorAlert error={save.error} />
      </div>
    </Card>
  );
}
