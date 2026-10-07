# In Full Swing: two-thumb phone play

## Why

The player asked: "let's make it play better on mobile. simpler controls and I want to be able to multiply tap so that I can send
out multiple plungers to swing from, perhaps single tap on the left and right also works, and movement should be fluid".

Phone play used one rope (the right hand) and a big SWING button. A second finger was ignored while the first was down.

## What changes

- **Each half of the city throws its own plunger.** A tap on the left half throws the left plunger; a tap on the right half
  throws the right one. Each finger is its own tap, so two thumbs throw both plungers at once. A tap on a side whose plunger is
  out moves it to the new building, as before.
- **Simpler screen.** The SWING button goes. The whole city is the control. Two small badges (L and R) at the sides light while
  their plunger holds. They take no taps.
- **Fluid hand-off.** When a new plunger catches, the other one lets go 0.12 s later with no fling, so taps on alternate sides
  chain from building to building. Two plungers thrown within 0.3 s of each other hold together (a double swing). Each plunger
  lets go by itself past the bottom of its arc, as one rope did before.
- The phone words, the touch note and How to play say "tap left or right" and "use both thumbs". The training rows show L and R.
- Version 1.12.0 (APK code 18).

## Out of scope

The mouse, the game pad and the headset do not change. Motion aim stays as it is.

## Earlier specs this replaces

`swing-controls/specs/swing-phone-controls` is updated here (a tap, the hint panel and the badges in place of SWING). Older active
changes still name the SWING button in their history: `full-swing-phone-and-climbing`, `full-swing-phone-chain`,
`full-swing-view-and-motion`, `swing-hero-comic` and `swing-controls` (`swing-phone-aim`, `swing-auto-target`). Where they say
"SWING", read "a tap at the marked target on the right half". This change wins over them for the phone.
