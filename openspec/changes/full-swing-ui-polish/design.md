# The chase score row is one printed instrument

## Source

The pause menu in `public/vr/js/ui.js` already prints a magenta dot field with a radial gradient (`dialog.fs-menu::before`). That field is the one used here. The print it copies is Benjamin Day's mechanical tint (1879). No city shader was added.

## Decisions

- The plate is a `::before` on `.fs-top`, drawn a few pixels outside the row and behind the stickers. It does not change the row's border box, so the spoken line and the lock arrow keep the gap they already take from that box.
- Dots, the coin face, the clog face, and the compass dial are CSS only. The markup, the `data-k` nodes, and the pill count stay as they are.
- A headset still draws the scene. This is the flat DOM HUD.
