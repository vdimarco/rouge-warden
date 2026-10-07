# In Full Swing: clear trial rings, full screen, a readable map and desktop sound

## Why

The player asked for:
- "The rings are not clear. When I go through them, nothing really seems to happen. Make it clear where to start, which ring to go through first, and make something happen when you go through it."
- "Make it go full screen by default."
- "Map isn't showing properly."
- "The sound is not working" (on desktop).

A trial started only after the player stood on its pad for a second. Its rings showed only after that, nothing pointed to the next ring, and a pass gave only a small flash and a chime. On a monitor or a phone the flat map was a small table model at a grazing angle, half covered by the spoken line. A workflow traced the desktop silence (three independent investigations, then adversarial verification). The only cause of total silence was the arcade-wide mute, which the game inherits with no sign on its title.

The hero and the chase camera the player also asked for came in with `swing-hero-comic` (#181). This change builds on that work and leaves it as it is.

## What changes

- Each trial's first ring is a green, breathing START ring with the trial's label over it. Flying through it starts the trial, and the pad still works. The compass points to the next ring, and the HUD shows "ring/total · time". Each pass gives a WHOOSH, a green glow at the screen edges and a "Ring n of total" line. The finish gives a gold glow and a cheer with the time. Every run is timed from its first ring.
- PLAY asks for full screen, and the click or key that resumes after Esc asks again. Leaving to the title leaves full screen.
- In flat play the map is a full-screen plan of the city, in the comic look: buildings by height, the lake, every clog, the King, each trial and you. A click on a pin travels there, a list hover names its pin, and a tap on a phone shows a pin's name. The headset keeps the table model.
- Sound:
  - A SOUND: ON/OFF button on the title. M toggles the sound in flat play, by the letter on the key, so it works on AZERTY.
  - PLAY with the sound off says how to turn it on. The PLAY click is heard, and the desktop opening is louder.
  - The toggle confirms itself, and a context the browser stopped comes back on the next tap or key.
  - Oscillators stay under half the sample rate.
  - iOS asks for the playback audio session while the sound is on.
- In the air, a wall holds the player only when hit slowly or fairly head-on (a fall still counts). A brushed wall no longer stops a fast swing. Tap-only phone play goes from 18.9 to 20.9 m/s.
- Version 1.6.0.

## Out of scope

The hero, the chase camera and the comic restyle (swing-hero-comic). Missions, enemies and street life follow as their own change (full-swing-street-life).
