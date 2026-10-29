# Design: the slide scream

## Source

No outside model fit. The scream reuses the pattern the drive loop already has for its tire hiss: a tone plus a little noise, made per sample at 24 kHz. It adds two partials, a 7.5 Hz wobble and a gain that eases per sample, so it does not click.

## Rule

`QuebecSlideTone::Target` is 0 unless the handbrake is held, speed is at least 450 cm/s and the sideways speed is at least 180 cm/s. Those are the `QuebecSlide` constants, so the scream and the banner share one line. Above it, the target goes from 0.45 to 1 as the shove goes from 180 to 520 cm/s. The gain moves toward the target at 18 per second up and 14 per second down.

The pitch is 1,050 Hz plus 520 Hz times the gain. The peak is 0.12. That is louder than the 0.045 hiss and the engine, and under the 0.34 lock chirp.

## Where it plays

`AQuebecCar::UpdateDriveAudio` adds the scream to the drive loop. That loop runs only on the driver's own client, so a passenger or a watcher does not hear it. When the driver leaves, the gain resets to 0. The loop fills up to 3,600 samples ahead (0.15 s), so the scream can start up to 0.15 s after the shove. The hiss has the same delay.

## Session

The test drives the round-85 car at 60 Hz, now in `Scripts/slide_car.h` for both tests. Gas for 3 s, then the handbrake and a full turn, then 1 s off the pedals. The scream starts at 3.23 s, is loud at 3.30 s, and is loud when the banner fires at 3.57 s. The car drops under 450 cm/s at 3.65 s, and the scream is quiet at 3.92 s. A straight run, a gripped turn and a straight handbrake stop make no scream.
