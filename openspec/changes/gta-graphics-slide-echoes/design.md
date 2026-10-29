# Design: echoes of the high note

## Source

No outside sound design was adapted. Counting by repeats is the same idea as a combo meter that ticks once per hit.

## Sound

A single slide still plays 587 Hz then 784 Hz, 0.24 s, and its samples do not change. Each link after the first adds a 0.06 s repeat of 784 Hz at 80 % level, with the same 5 ms attack and a 12 ms fade, so no repeat clicks. Four repeats is the most: x5 through x9 play 0.48 s. No new pitch is added, so the notes stay off the rank pitches and the city tones that round 86 tested.

## Wiring

`AQuebecCar` passes `Slide.Chain` to `AQuebecController::PlaySlide`, and the unreliable client call carries it to the driver. `PlaySlideTone` builds `FramesFor(Chain)` samples into a buffer sized for the longest cue and sets the wave length for that pay.
