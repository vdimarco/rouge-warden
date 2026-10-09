# Shore camera zoom review

Implemented wheel and two-finger pinch zoom, bounded to 1–2.4 times normal camera distance. The camera recalibrates its footprint, scale and ground picking; atmospheric fog follows zoom so maximum distance stays legible. Rift Jump remains visible at the top center with its existing eligibility and cooldown, and guidance stays clear of the top HUD.

## Verification

- All 34 Shore Node suites passed, including camera zoom bounds/wheel modes and pinch cancellation, capture loss, survivor suppression and independent control touches.
- Real Three camera projection, footprint and scale round trips passed. Sky mood checks verified fog scaling and restoration in both realms.
- Chromium wheel, native CDP two-finger touch, movement suppression, picking, pause, resize/recenter retention, keyboard movement, spellbook access and native pointer Rift activation passed at 1440x900, 390x844, 844x390 and 320x568. Rift rectangles are centered, at least 44px high and clear of score, lineup, clocks, objectives, minimap and guidance.
- Camera jobs passed in run 37887077468 on implementation/test commit 4b57221adac831a4fdc291240cd3890cffd5715a. Desktop, portrait, landscape and small-phone PNGs were visually reviewed from run 37886596373, whose camera assertions passed except a portrait Playwright stability wait. That fixture wait was replaced with native pointer input and passed in 37887077468.
- Terrain rendering, relief/shaders and controls passed in run 37886596373 on the same game code. The later changes only correct QA input and archive documentation.

## Limits

OpenSpec CLI is unavailable; Markdown structure, requirement/scenario headings and WHEN/THEN pairs were checked directly. The separate Shared creatures browser QA has the existing 30-second hero-menu screenshot timeout at qa/creatures/browser.mjs:42; its simulation checks pass. No physical phone test was available; multi-touch was exercised in Chromium.
