import { useId } from 'react';
import { CityScene } from './scenes/city';
import { CoastScene } from './scenes/coast';
import { ForestScene } from './scenes/forest';
import { LakeScene } from './scenes/lake';
import { MountainScene } from './scenes/mountain';

/** The scenes, in the order properties get them: mountains, coast, city, lake country, snowy woods. */
const SCENES = [MountainScene, CoastScene, CityScene, LakeScene, ForestScene] as const;

/**
 * A property's stand-in when it has no photo: a drawn scene, lit from the top left like the rest of the
 * illustrations. `index` (the property's place in the list) picks the scene, so up to five properties each get their
 * own. Decorative; it fills its box, cropping the sides rather than stretching, and keeps the ground in view.
 */
export function PropertyScene({ index = 0, className }: { index?: number; className?: string }) {
  const uid = 'ps' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const Scene = SCENES[index % SCENES.length]!;
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMax slice" aria-hidden className={className}>
      <Scene uid={uid} />
    </svg>
  );
}
