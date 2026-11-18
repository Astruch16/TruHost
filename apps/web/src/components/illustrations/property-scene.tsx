import { useId } from 'react';
import { CityScene } from './scenes/city';
import { CoastScene } from './scenes/coast';
import { ForestScene } from './scenes/forest';
import { LakeScene } from './scenes/lake';
import { MountainScene } from './scenes/mountain';
import { Grain } from './scenes/parts';

/** The scenes, in the order properties get them: mountains, coast, city, lake country, snowy woods. */
const SCENES = [MountainScene, CoastScene, CityScene, LakeScene, ForestScene] as const;

/**
 * A property's stand-in when it has no photo: an illustrated scene, each at its own time of day (mountains at golden
 * hour, the coast at sunset, the city at dusk (a lit condo tower, supplied artwork), lake country in late-afternoon warmth, the snowy woods at blue hour),
 * with a fine paper grain over it. `index` (the property's place in the list) picks the scene, so up to five
 * properties each get their own. Decorative; it fills its box, cropping the sides rather than stretching, and keeps
 * the home near the middle and the ground in view.
 */
export function PropertyScene({ index = 0, className }: { index?: number; className?: string }) {
  const uid = 'ps' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const Scene = SCENES[index % SCENES.length]!;
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMax slice" aria-hidden className={className}>
      <Scene uid={uid} />
      <Grain uid={uid} />
    </svg>
  );
}
