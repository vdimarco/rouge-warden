# Roll a cart that waits

## Context

Mission 17 is a person who walks their own line. If you stop, you lose them. This cart does not walk. It moves only while a walker is at the handles, and it stays put when they step away.

No new rendering technique. The handles, the cart, and the stop are flat non-blocking cubes in the existing comic materials. None of the usual art references for grass, water, outlines, or a painted look fit, because this change does not add a rendering technique.

## Goals / Non-Goals

**Goals:**

- A walker starts the beat at the handles. A car does not.
- Holding walk rolls the cart. Holding sprint tips it back to the start. Stopping leaves it.
- One purse at the stop. The seven banks do not gain a link.
- Version 11 stores the step. Version 10 loads and starts this beat over. How far it has rolled is not stored.

**Non-Goals:**

- Retuning the follow, the escort, the chase, the finale, the lap ghost, or the police road chase.
- Saving the roll clock, spawning another car, or adding a phone button.

## Decisions

1. The line is the open north lawn at X = 16800, from Y = 21000 to Y = 15000, west of the follow. The handles are 160 cm north of the cart. Recover during the roll is the handles, which does not rewind the cart. Recover before the roll is 700 cm further north.
2. Anything faster than 625 cm/s at the handles is a sprint. That is above a walk and below a sprint. A partner sprinting in the handles tips it even when another walker is pushing.
3. The purse is 360, once, through the same flat grant the later beats use. Link -1.

## Risks / Trade-offs

- A reload during the roll puts the cart back at the start while the step stays open. The player walks back to the handles.

## Migration Plan

Version 10 slots reject a cart step and load with it cleared. Version 11 writes the step. Unsupported slots stay byte-identical.

## Open Questions

None. The host still has to roll the cart.
