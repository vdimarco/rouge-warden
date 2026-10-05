# Design

## The pictures

- Higgsfield, model GPT Image 2.5, quality high, 2K, 16:9, about 2.75 credits each (8 made, one redone so the far tower is
  the Needle). References: three clean screenshots of the game (overlay hidden): the city wide shot, the King panel and the
  hero panel. The prompts share one style line (bold comic, ink outlines, halftone, the sunset colours) and forbid words.
- Each 2688 x 1520 PNG is scaled to 1280 px and saved as WebP 0.78 in a Chromium canvas (no image library in the build):
  186 to 273 KB each.

## The panel (cutscene.js)

- `art: { src, focus, face, low }` on a panel. `preload()` makes an `Image` per picture; `show()` uses the picture only if it
  has loaded, so a panel never switches from the live shot to the picture half way.
- The picture is a `background-size: cover` box inside the frame, `background-position` at the focus. The push scales it
  from 1 to 1.06 about the focus point (none with reduced motion). The balloon point is the face fraction mapped through the
  same crop and scale. A picture's balloon sits 28 px beside the face (the live King's needs 8 % of the width).
- `low` puts the caption at the foot of the frame; on a screen held upright it sits above the SKIP button.
- `#cutscene.art` fills the strips round the frame with the letterbox bars' ink.

## How to check

`qa/vr/cutscene.e2e.mjs`: all seven pictures load in flat play; each opening panel shows its picture inside the frame; on
the King and the hero the caption is low and no balloon covers it; the King waking shows its picture; on a phone the
pictures fit and a picture that fails to load (the test blocks one) leaves its panel on the live shot. Screenshots of every
panel, on desktop and on a phone, were looked at.
