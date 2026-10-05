# In Full Swing: painted pictures for the comic scenes

## Why

The player asked for an opening cutscene "that we generate", and for scenes "throughout the game, with each mission". The
first scenes (change full-swing-story-and-training) used shots of the live city, because no image service was available.
Higgsfield credits are now available, so the scenes can show painted panels.

## What changes

- Seven painted panels in `public/vr/art/cutscene/` (1.6 MB in all), made with Higgsfield from the game's own screenshots
  as references: the five opening panels (the city and the Needle, the King asleep, the clogs, the hero, the swing behind
  the Mission 1 card), the King waking, and the finale. Credits in `art/cutscene/CREDITS.md`.
- A panel with a picture shows it in the inked frame, cropped around a focus point and pushed in slowly. Its balloon points
  at the speaker's face in the picture. Where a head is at the top of the picture the caption moves to the foot of the frame.
  The strips round the frame are inked, so no live city shows past a picture.
- A panel whose picture is not ready when it starts shows the live shot, as before. The district briefings keep the live
  shot of their clog.
- Flat play loads the pictures when it starts (not with `?nocut`). The offline cache holds them.
- Version 1.9.0 (Quest APK code 9).

## Out of scope

Animated video panels. Street life (change full-swing-street-life).
