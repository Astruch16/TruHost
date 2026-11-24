# TruHost icon set

50 custom SVG files that replace the current TruHost icons one-for-one: 41 UI icons and 9 empty-state illustrations. `icons.json` maps every file to its label, its tint and where it's used in the app.

## Folders

| Folder                | Count | Contents                                                                                                                                                                                            |
| --------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `money/`              | 6     | Gross revenue, management fee, own property, expenses, owner-stay cleaning, adjustments                                                                                                             |
| `expense-categories/` | 9     | Supplies, repairs & maintenance, subscriptions, utilities, internet, furnishings, licensing & permits, insurance, strata                                                                            |
| `rooms/`              | 13    | Bedroom, bathroom, half bath, kitchen, living room, dining room, laundry, entry, office, patio/deck, hot tub, garage, other room. Bathroom, kitchen and laundry are also the supply-category icons. |
| `notices/`            | 8     | Monthly statement, invitation, compass, cleans done, time off, this week, free from, ready by                                                                                                       |
| `checklist/`          | 5     | Before photos, after photos, damage alert, supply alert (low), supply alert (out)                                                                                                                   |
| `empty-states/`       | 9     | All clear, no bookings, no clean photos, nothing coming up, damage, no expenses, no receipts, revenue, no supplies                                                                                  |

The supply alert is two files: `supply-alert-low.svg` (amber, gauge a third full) and `supply-alert-out.svg` (rose, empty gauge with a warning mark). Choose between them in code based on the supply level.

## Style rules (keep these if you add icons)

- **Grid:** UI icons are drawn on `0 0 40 40` and look best displayed at 28–40px. Empty states are drawn on `0 0 96 96` and look best displayed at 96–160px.
- **Outline:** ink `#2E3532`, 1.75px on UI icons and 2.25px on empty states, with round caps and round joins. The stroke is set once on the root `<svg>`.
- **Colour:** each icon uses one tint, plus cream `#FFFDF8` for paper or white parts and gold `#DDB443` for accents. The only exception is the tick on "Cleans done", which uses deep sky `#2B8BD0`.
- **Backgrounds:** UI icons are transparent and have no circle or tile behind them, so place them straight on the card. Empty states include their own soft tinted circle.
- **No orange:** every colour was checked. Gold sits at hue 44° and amber at 44–46°, with nothing between 10° and 40°. If the app's orange check still flags gold, replace `#DDB443` everywhere with `#D9BC4C`.

## Palette

| Tint          | Base      | Shade     | Light (empty-state backdrop) |
| ------------- | --------- | --------- | ---------------------------- |
| sky           | `#A8D9FB` | `#7CC8FF` | `#E2F2FE`                    |
| lavender      | `#CAC4E8` | `#ACA4D6` | `#EDEBF8`                    |
| amber         | `#F4DE9C` | `#E6C76E` | `#FBF3D8`                    |
| blue          | `#B9D3EC` | `#94BAE0` | `#E5EEF8`                    |
| rose          | `#EFC2C7` | `#E0A0A8` | `#FAE8EA`                    |
| grey          | `#D3D7D4` | `#B3BAB5` | `#EEEFEE`                    |
| lavender-grey | `#CFCDDD` | `#B2AFC8` | `#EEEDF4`                    |

Each hex code appears only in its own role, so to match the app's exact theme colours, run a find-and-replace on these values across the folder.

## Integration notes (for Claude Code)

1. Copy the folders into `public/icons/` (or wherever the current icons live), keeping the folder structure.
2. Map the existing icon keys to the new files using `icons.json`. Each entry's `used_for` matches the usage list from the old set.
3. Remove any coloured circle or tile background the current components draw behind icons. The new set is designed to sit on the card directly.
4. Render UI icons at 28–40px. Use `<img src=... width={32} height={32} alt="">` for decorative icons, or import them as React components with SVGR if the project already uses it.
5. Use the supply-alert low or out file depending on the supply level.
6. `preview.png` shows the whole set for a visual check.
