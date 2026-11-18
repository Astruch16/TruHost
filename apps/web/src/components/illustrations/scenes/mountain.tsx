import cabinUrl from '../../../assets/scenes/cabin.svg?url';

/**
 * Mountains at golden hour: a log cabin among pines by a river, peaks behind (src/assets/scenes/cabin.svg,
 * artwork supplied as a file). Drawn into the scene's 320×180 frame, anchored at the bottom centre and cropped at the
 * sides like the other scenes, so the cabin stays in view in any box.
 */
export function MountainScene() {
  return <image href={cabinUrl} x="0" y="0" width="320" height="180" preserveAspectRatio="xMidYMax slice" />;
}
