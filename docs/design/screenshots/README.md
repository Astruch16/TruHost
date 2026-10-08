Renders of the `.dc.html` boards in `docs/design/`, for use as visual targets.

`Poses.dc.html` and `Onboarding.dc.html` are templates (`{{...}}`, `sc-for`, `sc-if`) and don't render when opened
directly. These PNGs were produced by running each board's own `Component.renderVals()` and expanding its template,
then capturing it with animations paused (reduced motion), so they show each pose at rest. `Onboarding.png` shows the
default guide (Sage).

`EmptyIcons.png` and `KpiCards.png` were made the same way (`KpiCards.dc.html` builds its nights strip in
`renderVals()`).

`Login.png` is `Login.dc.html` rendered the same way: its trees, stars, ripples and fireflies come from `renderVals()`.
