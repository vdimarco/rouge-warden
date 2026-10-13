# NORD starts in the standard render

## Why

Commit `a86a508a` ("Make the realistic render the NORD default; comic look stays on F2", matching GTA-NORD PR #11) changed `bComicStyle` to start false: players now start in the realistic render and press F2 for the comic look. The canonical spec and three Unreal test scripts still assumed the comic look by default. On the game PC, the smoke test then waited forever at "client disables comic view without affecting host" (F2 turned the client's comic view on, not off) and stopped at its 120-second limit after 16 checks, so the browser package was not rebuilt.

## What changes

- The `nord-unreal` comic-look requirement now describes the standard render as the default and F2 as the way into the comic look, per player.
- `Scripts/smoke_test.py` checks that both players start in the standard view, that the host's F2 turns on only the host's comic view, and that the client's F2 after leaving the car turns on the client's. Its animation-on-twos check follows each player's own view.
- `Scripts/test_story_slice.py` expects F2 to turn the client's comic view on and then off, with the host's view unchanged.
- `Scripts/capture_park_comic.py` starts its view tracking in the standard view, so shots named `_F2` stay the standard ones.

No game code changes.
