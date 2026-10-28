# Design

## Source
None of the existing CDN clips came without text, so the clean clips are cut from the current ones with ffmpeg. No outside technique applies.

## Steps
1. Find the title card: frames 120 to 149 at 30 fps are flat yellow in both clips.
2. Cut 4.0 to 5.0 s from video and audio, and join the two parts.
3. Wide: crop 960×540 to 960×432 at y = 108. The captions sit at about y 20 to 88.
4. Tall: scale the clean wide clip to 960 px high, crop 540 wide, blur it (boxblur 30) and darken it 18% for the fill. Over that, center a 540×520 sharp crop of the same clip.
5. H.264 High, yuv420p, CRF 23, AAC 128 kbit/s, faststart. Sizes: 4.1 MB wide, 3.0 MB tall.

## Hosting
The clips ship in `dist/` from `build.mjs`. They change rarely, and the player's own origin removes the outside CDN dependency for the title screen.
