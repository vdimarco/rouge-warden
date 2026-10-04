# Decisions

The simulation stays deterministic and browser independent. It records facts: a kill feed with streak and multi-kill counts, team pings, and skirmish timers on heroes. Presentation modules read these facts. `team-chat.js` writes bot chat, `announcer.js` maps events to sound and banners, and the renderer draws minimap markers.

`createMatch(kind, seed, lineup)` accepts a lineup of ally and enemy kits. Without a lineup the old picks stay, so seeded tests keep their matches. `assignIdentities` accepts an ordered list of identities so the draft names match the battle.

Draft picks are a pure function of the player's hero and a seed. Bots fill missing roles first (front line, mage, support, carry), avoid a kit already on their team, and never take an identity already picked. The board is skippable with Enter or a tap.

Assist: a healthy bot with no target in sight moves toward an allied hero who fought an enemy hero in the last three seconds, within 1900 units. A team rally point holds for 12 seconds and draws healthy bots within 3200 units. This uses the existing `combatDecision` order: danger and retreat still win.

Multi-kills use a 12 second window per killer. Streaks count kills without a death. Ending a streak of three or more is a shutdown. A tower alarm fires when an enemy damages a ward, at most once per ward per 14 seconds.

Sound uses Web Audio only: a master compressor, a generated reverb, noise and oscillator voices. Sounds from world positions pan by screen offset from the camera and fade with distance. The announcer voice uses the device speech engine when it has an English voice. Each call also has a musical stinger, so the cue works when speech is off or missing. The player can turn the voice off in settings. Recorded clips from free packs carry the main calls and impacts: TripleSnail's announcer kill calls (CC BY 3.0) and Kenney's fighter voice, impact, RPG and interface sounds (CC0). They are trimmed, mono, loudness-normalized MP3s, 528 KB in total, loaded on the first tap. Multi-kill and streak names follow the recorded lines. Credits are in `audio/CREDITS.md` and the help sheet. Each clip falls back to synthesis or device speech until it loads. No new dependencies are added.

No fal key is present in this environment, so the existing skill atlases are kept for every hero.

## Desktop camera, menu, sound and large screens

The player asked for the view to keep following the hero while the mouse pushes it left or right, said full screen lagged on an ultra-wide monitor, heard no sound, wanted Esc for the menu and a clearer menu button, and said the pause on mouse leave fought the camera.

- Camera: `Renderer.setLook(n)` takes the pointer's horizontal position from -1 to 1. Past a 12% dead zone the push grows with the square of the distance, to 34% of the screen width at the edge, and eases at a 0.2 s time constant. It adds to the follow target, so the camera never detaches. The last pointer position holds when the mouse leaves the window. Edge scrolling is gone; minimap look and Space stay.
- Pause: the mouseout and mouseenter handlers no longer pause or resume. Blur and hidden tabs still pause; focus or a click resumes.
- Esc: the keydown handler opened the menu dialog, and the browser then treated the same Esc as the dialog's close request, so the menu closed at once. `preventDefault()` on Esc fixes this. After full screen starts, `navigator.keyboard.lock(['Escape'])` sends Esc to the game in Chrome and Edge (a long press leaves full screen). In other browsers Esc leaves full screen; `fullscreenchange` then opens the menu, and closing it or the next click in the match asks for full screen again, since a key press cannot.
- Menu button: the faint 44 px pause circle becomes a pill with a menu icon, "Menu" and an Esc key cap, beside a speaker button. Phones hide the key cap and, under 520 px, the word.
- Sound: in local Chromium the match measured 0.06 to 0.11 RMS at the output after both a mouse start and a keyboard start, so no single cause of silence was found. The game now makes the state visible and recoverable: the speaker button shows and toggles the saved setting, a match that starts muted says so, and any click or key resumes a context that is not running (before, only the first click started audio).
- Large screens: a CPU profile at 1920x1080 showed the main thread 98% idle; frame time doubled from 1280x720 to 1920x1080, so the cost is pixel fill. `resize()` now limits the backing store to 2560x1440 pixels (3440x1440 draws at a pixel ratio of 0.86). `adapt(ms)` smooths the frame interval; when it stays over 1.5 times the refresh interval (and over 20 ms), quality drops by 20% to a floor of 35% of the budget. It rises 15% when frames return to the refresh rate, after a hold that doubles with each drop, up to 60 s.
