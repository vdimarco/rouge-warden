# Design: stride-locked footfalls

## Source

The body rock already plants twice a cycle: the bob is sin(2·phase), so one plant is half a cycle. At a walk that half-cycle is π / 7.2 seconds, about 0.436 s, and the walk pace is 450 cm/s, so the stride is about 196 cm. The rock's rate stops rising once the walk lean is full, so a sprint keeps that stride and the plants come sooner.

The tap is a short damped strike, the shape in Perry R. Cook, Real Sound Synthesis for Interactive Applications (2002). It is the same family as the impact thud and quieter. No Foley recording fitted.

## Choice

`QuebecStep.h` has no Unreal types. `Consume` adds speed × dt and emits a plant each stride, at most four plants in one tick, and drops the rest so a hitch does not burst on the next frame. Below the sway move speed (5 cm/s) it stays silent. The two shoes are different strikes.

`AQuebecCharacter::Tick` calls `UpdateFootsteps` after the sway. It returns while the player is in a car, knocked down, falling, or swimming, and only the local controller plays the tap. The controller queues the same kind of procedural wave as the impact thud, at a lower volume. The sway numbers, the opening look, and the 22:00 clock stay.
