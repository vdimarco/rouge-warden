# Text-free title loop

## Why
The owner asked to remove the text from the play page background, because it is cut off. The title loop clips had burned-in captions: yellow boxes ("PARC LA FONTAINE", "TORONTO.", "ONE BIG SCORE.") near the top edge, and a full-screen "NEXT STOP: TORONTO." card for one second. Cover-fit cut the captions at the screen edge, and the card showed as clipped words behind the badge.

## What changes
- Two new loop clips, `title-loop-wide.mp4` and `title-loop-tall.mp4`, are served from the play page itself.
- The "NEXT STOP: TORONTO." card (4.0 to 5.0 s) is cut out. The loop is now 14.5 s.
- The wide clip drops its top 108 px, where the captions sit.
- The tall clip is rebuilt from the clean wide clip: a sharp center crop over a blurred, darkened fill, like the original framing.
- The sound track is kept.

## Out of scope
The full trailer in the Watch trailer dialog and on the arcade landing page keeps its titles. It is a trailer, and it plays uncropped.
