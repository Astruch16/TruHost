# TruHost icons (v3, monoline)

50 SVG files that replace the previous TruHost icon set one-for-one, with the same folders and file names: 41 UI icons and 9 empty-state illustrations. `icons.json` lists every file with its label, what it shows and where it's used. `preview.png` shows the whole set in navy on white and in white on navy.

## Style

- **UI icons:** drawn on a 24×24 grid with a 2px stroke, round caps and joins, rounded corners, and no fills (apart from a few tiny dots). They look best at 20–24px; 16px and 32px also work.
- **Empty states:** drawn on a 64×64 grid with the same lines and a faint dashed ring. They look best at 96–128px.
- **Colour:** every icon draws in `currentColor`. The default is navy `#0D3A5C`, set with `color` on the root `<svg>`.

## Using them

- **Inline SVG or an icon component (recommended):** the icon follows the CSS `color` of its parent. Remove the `color` attribute (or set `color` in CSS) to make icons match the surrounding text, the sky blue `#7CC8FF`, or white on dark backgrounds.
- **`<img src>`:** icons render in the default navy, and CSS can't recolour them. Use inline SVG where colour needs to change.
- **Supply alerts:** `supply-alert-low.svg` (gauge a quarter full) and `supply-alert-out.svg` (empty gauge). Choose between them in code based on the supply level. Colour the out version with the danger colour if you want more urgency.

## Changes from the previous set

- The viewBox changed from `0 0 40 40` to `0 0 24 24` for UI icons and from `0 0 96 96` to `0 0 64 64` for empty states. Size icons with width/height in CSS; don't rely on the old pixel sizes.
- There are no tints, gold accents or built-in backgrounds any more. Colour comes from the app's theme.
- A few icons show a different object, to read more clearly in a single line: Management fee is a % sign, Adjustments is a pair of sliders, Subscriptions is circular arrows, Other room is a floor plan, and Revenue (empty state) is a bar chart.
