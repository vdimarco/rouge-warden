# Design: two rising notes and their repeats

## Source

No outside sound design was adapted. The cue is a synthesized wave in the same form as the lock chirp, the dent thud, and the loss sting: a header with no Unreal types, a `SampleAt` function, and a procedural wave on its own audio component. Counting by repeats is the same idea as a combo meter that ticks once per hit.

## Sound

`QuebecSlidePay.h` plays 587 Hz, then 784 Hz, 0.12 s each, a fourth up. A rise reads as a win, and the loss sting falls. Each note has a 5 ms attack, an exponential decay, and a 12 ms fade at its end, so the switch and the end do not click. A third harmonic at 20 % gives the notes an edge over the engine hum. Peak 0.30 and volume 0.6 keep the cue under the dent thud.

Each link after the first adds a 0.06 s repeat of 784 Hz at 80 % level. Four repeats is the most, so x5 through x9 play 0.48 s.

The test compares the cue to the rank pitches, the pond tick, the court whistle and rasp, the theatre page, the lock chirp, the dent thud, and the loss sting. Goertzel power at each note's pitch is at least 20 times the power at any of those pitches, and at the scream's lowest and highest pitch, 1050 and 1570 Hz.

## Wiring

On the frame the slide pays, `AQuebecCar` shows the graded banner and calls `AQuebecController::PlaySlidePay` with `Slide.Chain`. That function makes an unreliable call to the driver's client, so only the driver hears the notes, the same as the dent thud. `PlaySlidePayTone` fills a buffer sized for the longest cue and sets the wave length for that pay. A voided slide pays nothing, so it plays nothing.
