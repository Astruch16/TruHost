import condoUrl from '../../../assets/scenes/condo.svg?url';

/**
 * The city at dusk: a lit glass condo tower on a tree-lined corner, the downtown around it and a crescent moon
 * (src/assets/scenes/condo.svg, artwork supplied as a file). Drawn into the scene's 320×180 frame, anchored at the
 * bottom centre and cropped at the sides like the other scenes, so the tower stays in view in any box.
 */
export function CityScene() {
  return <image href={condoUrl} x="0" y="0" width="320" height="180" preserveAspectRatio="xMidYMax slice" />;
}
