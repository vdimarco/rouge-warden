# Design

## Action card

Keep the existing guide drawings and input/state selection, but give the gesture and directional arrow more of the card. Widen the card only as far as the phone layouts permit (at most 176 px), then add a compact footer with a short action verb and, where useful, a brief qualifier for pace, direction, or timing. These are labels rather than the full instructional sentence. Keep the full prompt words in the DOM for assistive technology and in the optional guide. A static Calm or reduced-motion frame must keep its arrow and labels.

Check narrow portrait, standard portrait, landscape, and left-reel motion layouts against the gauge, HUD, pull meter, report, and rod cue. Keep urgent states recognizable by shape and a warning mark as well as color.

## Spoken hints

The game will speak only two time-sensitive moments: a nibble ("Nibble. Hold steady.") and a strike that asks for a hook set ("Set the hook!"). Use the browser's speech synthesis where available, without downloading voice files. Avoid a backlog: a hook-set cue interrupts a nibble cue, repeated nibbles are throttled, and no hint is queued when speech is unavailable. The existing sound effects and on-screen/assistive cues remain primary when speech is delayed or unsupported.

Voice hints are on by default, have their own persisted switch, and obey the main Sound switch. Pause, leaving the page, and turning off either switch cancel speech. Do not speak ordinary changing reel prompts; they occur too frequently. Keep the full `#say` screen-reader announcement independent of the spoken hint feature.
