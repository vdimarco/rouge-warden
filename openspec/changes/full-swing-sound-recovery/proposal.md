# In Full Swing: a sound that fails comes back, and the menus say so

## Why

The player hears no sound or music on desktop Chrome, while the menus say SOUND: ON. The sound works on their phone. A
search of the desktop path found one defect that gives exactly this: when the browser's audio engine fails to start (an
audio device or driver error, an extension that patches Web Audio) or the browser closes it later, the game keeps no engine
and stays silent. The menus still say SOUND: ON. No key, click or Sound toggle builds it again; only a return to the title
and a new PLAY does. The error is not logged.

A second gap: a comic scene runs its own frame, which never drove the sound, so the music stopped for the whole opening
scene (about 25 s).

## What changes

- A sound that is on but not playing counts as stalled: no engine (it failed or was closed), a context the browser
  stopped, or a running context whose clock stands still for 3 s (no output device). The next tap or key builds or wakes
  it, as it already did for a stopped context. A start request has 1.5 s before it counts as stalled.
- Turning the sound on builds a new engine when the old one failed or died.
- A failed start logs a warning in the console.
- The title says "SOUND: ON, NOT PLAYING" and the pause menu "Sound: on, not playing" while the sound is stalled. A press
  of that button, or of M, starts the sound again and does not turn it off.
- A comic scene drives the sound: the music and the city go on under it.
- Version 1.9.2 (Quest APK code 11).

## Out of scope

A tab that Chrome has muted, a site set to block sound, and an OS output device problem: Web Audio reports "running" and
the page cannot tell. The player checks those on the machine.
