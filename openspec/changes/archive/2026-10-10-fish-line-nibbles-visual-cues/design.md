# Design

## Cast and retrieve

The flight can pay out more line at its farthest airborne point than the final splash needs, particularly on a high lob. At water landing, settle `Flight.lineOut` to the final rod-tip-to-lure span with the existing small sag allowance. Pass that amount to `LakeSim` and its LINE OUT display. Every crank winds that amount toward home; only a fish actively taking line or another explicit outward movement may increase it. Preserve the existing fast finish for an empty cast, but never use it to create extra line or show a longer retrieve than the splash suggests. Keep the fight's separate spool and drag behavior, where a fish can pull out more than the original cast.

## Nibbles

Use the existing `nibble` simulation event and `Haptics.nibble()` routing in place of the generic bump. Give Android/web vibration two short taps separated by about 70 ms, scaled by nibble strength; give the native iPhone app two LIGHT impacts about 80 ms apart. Respect the Buzz and taps setting, platform support, and the existing priority and rate rules so a nibble cannot mask a strike or urgent line warning. Keep the visual and sound cues for players without vibration.

## Haptics across the game

The game already has a tactile language for the bail, rod load, sweet release, water landing, reel ticks, drag, tension, strike, fight moves, snap, catch, photo, new place, and derby finish. Main gaps are ordinary release, an empty lure returning home, a dry landing, missed or refused fish, and menu and mode selections. Add a short tug for ordinary release, a rising settling cue when an empty lure comes home, a descending failure cue for a dry landing or lost bite, and one quiet selection tick for an accepted menu action. Pause stops continuous haptics before its tap. A drag button at its minimum or maximum gives no extra tick when the value does not change. Give routine controls a quieter tap than gameplay success or danger. Use the same native-iPhone and Android/web routing, existing priority and rate caps, and the Buzz and taps setting. Avoid a continuous menu buzz or duplicate haptics for one action.

## Corner cue

Keep the existing corner-placement and prompt-state logic. Replace the card's visible headline and subline with a larger illustrated gesture that demonstrates the active input: cast hold/load/flick, reel or mouse wheel, pause for a nibble, hook set, pump, lower, steer, let a run go, and land. The scene should change with the active input method and fish state; pace and urgency change its movement and shape or contrast as well as color. Keep the current cue words as hidden accessible text and in the optional written guide and rod cue. With Calm effects or reduced motion, show a still drawing that retains the arrow or other direction and action markers.

Check portrait and landscape phone layouts, including a left-hand motion reel. The cue must stay clear of the gauge, HUD, pull meter, cast report, and lure, as the existing card does.
