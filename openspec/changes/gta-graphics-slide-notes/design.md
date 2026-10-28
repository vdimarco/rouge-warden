# Design: two rising notes on the slide pay

## Source

No outside sound design was adapted. The cue is a synthesized wave in the same form as the lock chirp, the dent thud, and the loss sting: a header with no Unreal types, a `SampleAt` function, and a procedural wave on its own audio component.

## Sound

Two notes of 0.12 s each, 587 Hz then 784 Hz, a fourth up. A rise reads as a win, and the loss sting falls. Each note has a 5 ms attack, an exponential decay, and a 12 ms fade at its end, so the switch and the end do not click. A third harmonic at 20 % gives the notes an edge over the engine hum. Peak 0.30 and volume 0.6 keep the cue under the dent thud.

The test compares the wave to the rank pitches (160, 392, 523, 659, 880 Hz), the pond tick (740 Hz), the court whistle (980 and 1470 Hz), the court rasp (210 Hz), the theatre page (90 and 1400 Hz), the lock chirp, the dent thud, and the loss sting. Each wave differs from the cue by more than 0.05 at some sample. Goertzel power at each note's pitch is at least 20 times the power at any listed pitch.

## Wiring

`AQuebecCar` already calls `QuebecSlide::FState::Tick` on the server. On the pay frame it shows the banner and calls `AQuebecController::PlaySlide`, which sends an unreliable client call to the driver. Only the driver hears it, the same as the dent thud.
