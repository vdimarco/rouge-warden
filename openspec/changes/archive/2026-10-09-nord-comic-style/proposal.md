# NORD comic-book look

The user asked for Parc La Fontaine to look like the animated film *Spider-Man: Into the Spider-Verse*. The look is the target. The film's characters, suits, logos and sound words are not used. The city stays the OpenStreetMap district.

## What changes

- A post-process material `/Game/Art/Comic/M_ComicInk`, made by `Scripts/apply_comic_style.py`. It draws ink outlines where depth or surface direction jumps. It reduces lighting to flat bands with stronger colour and puts Ben-Day halftone dots in shadows and the sky. It hatches the darkest shadows. It shifts the red and blue print plates apart, more so with distance, in place of depth of field.
- The walking character animates on twos (12 poses a second) while it moves smoothly.
- The HUD becomes comic caption boxes: yellow panels, black ink borders, offset shadows. Short sound-word bursts appear for jumps, hard acceleration and the handbrake.
- F2 switches the comic look on and off for the local player.
- `-NordCapture` takes reference screenshots at spawn and quits, so the look can be checked without a person at the keyboard.

## Out of scope

No Google imagery or Street View likeness, no new gameplay, no web swinging, no film characters or logos. Building geometry and materials do not change.
