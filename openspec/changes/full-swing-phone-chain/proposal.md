# In Full Swing: one tap after another on a phone

## Why

The player said: "the mobile version plays pretty badly, fix it, how do you shoot twice? Make it seamless."

On a phone the second press of SWING was LET GO, so a player who kept tapping let go of every other rope. A tap on the city
moved the rope, but each new rope stopped the speed that flew away from its anchor, and a long rope from a low point swung
the hero along the street. A bot that pressed SWING at a steady beat (0.5, 0.8 or 1.2 s) for 12 s from the start averaged
11 to 16 m/s and spent 6 to 7 s with its feet under 8 m. Once on the street, the picker took the low shop fronts, and the
hero could not get back up.

## What changes

- SWING never lets go. With a rope out, a press swings on to the next building ahead, the same as a tap on the city. The
  rope still lets go by itself past the bottom of the arc. A press while the cup still flies does nothing, so the cup lands.
- A phone rope that catches keeps the speed: the part that flies away from the anchor turns into swing, toward where the
  player looks.
- A phone rope is short enough that the lowest point of its arc stays 6 m over the street. It shortens at 30 m/s, so a
  catch from low down pulls the hero up.
- The phone marker prefers a building point at least 22 m up and 8 m over the chest. A lower point is used only when no
  high one is in reach.
- The phone help and the SWING button say "Again: the next building".

## Out of scope

Desktop and pad play (no change). Headset play (no change).
