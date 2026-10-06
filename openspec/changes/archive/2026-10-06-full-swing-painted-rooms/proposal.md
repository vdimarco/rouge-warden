# Painted rooms behind the windows

## Why

The player said the windows still look too basic. The procedural rooms (boxes, a sofa shape, a stick person) read as
diagrams, not as rooms in the comic city of the key art.

## What changes

- A new atlas, `public/vr/art/rooms.webp`: 32 painted room interiors in the key art's inked comic style (living rooms,
  kitchens, a party, a plumber's workshop, a bar, a ballet studio, a pizza oven, a cat on an armchair and more).
  Generated with Higgsfield (GPT Image 2.5); sources in `art/rooms-sources.json`.
- Each window of the procedural families shows one of the 32 rooms, picked by the window's hash and sometimes mirrored,
  on a plane 1.6 m behind the glass, so it shifts against the frame as the view moves.
- The frames, glazing bars, curtains, shades, glass tint and sky reflections stay on top. Dark rooms show the painting
  dimmed under the glass; lit rooms keep the painting's own light, warmed or cooled a little by the room's lamp colour.
- Without the atlas (it fails to load, or has not arrived yet), the procedural rooms draw as before.
- The service worker caches the new file.

## Impact

`public/vr/js/cityview.js` (facade shader), `public/vr/js/comic.js` (art loading), `public/vr/sw.js`, the new art and
its sources file.
