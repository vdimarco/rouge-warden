# Trajectory design

## Source of truth

Every figure comes from `model.js`. History is the opening stock plus each logged turn. The forward line is hold-steady: the same world step, current holdings, no new card, no future news. The band is the min and max warming of seven quiet policies (hold, cut, grow, restore, power, trust, alphabetical) over the remaining deck, paying real costs and firing real synergies. Ending bars count those seven finals with `judge`. The tip is `PARAMS.prosHeatAt` (2.0°), where heat starts to drag prosperity.

## Motion

No motion-design skill is in the repo. Practice used here:

- Hierarchy: heat and the path read first, meter fills stagger by 40ms, the map follows.
- Easing: meter fills and overlays use a settle curve, `cubic-bezier(0.22, 1, 0.36, 1)`. Numbers use ease-out cubic over 480ms.
- The forecast chart snaps to the new series so the path stays readable. A 4px settle is the only chart motion.
- Map: sea level follows the warming stock, smog drifts on a cached world, a pulse marks news.
- `?fast=1` and `prefers-reduced-motion` skip tweens, drift, and transitions.
- Canvas and CSS transforms only. No libraries.

## Layout

Portrait keeps the path in the hud and the other indicators in the scrolling sheet so a card can still clear 80px on a 320x568 screen. Landscape keeps the sheet in the right column.
