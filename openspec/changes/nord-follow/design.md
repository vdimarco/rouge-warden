# Keep a gap behind a walker

## Context

Mission 11 walks Grey Coat behind the player. Mission 15 has a car seek the player to a hide. The finale repeats those verbs inside one day. This beat is the other way around: they do not follow, and they do not chase. They walk a fixed line at the same speed as a walk.

No new rendering technique. The meet, the walker, and the stop are flat non-blocking cubes in the existing comic materials. None of the usual art references for grass, water, outlines, or a painted look fit, because this change does not add a rendering technique.

## Goals / Non-Goals

**Goals:**

- A walker starts the beat by standing behind them. A car does not.
- Holding walk keeps the gap. Holding sprint closes it. Standing still loses it.
- A fail returns them to the corner and does not rewind the day.
- One purse at the stop. The seven banks do not gain a link.
- Version 10 stores the step. Version 9 loads and starts this beat over. Their place on the path is not stored.

**Non-Goals:**

- Retuning the escort, the chase, the finale, the lap ghost, or the police road chase.
- Saving the along-path clock, spawning another car, or adding a phone button.

## Decisions

1. The line is the open north lawn at X = 20000, from Y = 22000 to Y = 15600. The meet is 1200 cm north of the corner. Recover during the walk is 1200 cm north of wherever they are, which stays inside the band and does not rewind them.
2. The band is exclusive: closer than 600 cm crowds them, and 2800 cm or farther loses them. Their speed is the walk, 450 cm/s. A long frame spends at most a quarter of a second.
3. Any walker inside the close radius crowds them, including a partner, even when the watched player is in the band. A walker already in the band is preferred over a closer walker who is outside it.
4. The purse is 400, once, through the same flat grant the later beats use. Link -1. A second pass pays nothing.

## Risks / Trade-offs

- A reload during the walk puts them back at the corner while the step stays open. The player walks back into the band. That matches the other session clocks.
- Recover places the player in the band and does not rewind the line. Recovering far from them on the next tick still loses them if the player is no longer in the band.

## Migration Plan

Version 9 slots reject a follow step and load with it cleared. Version 10 writes the step. Unsupported slots stay byte-identical.

## Open Questions

None. The host still has to walk the gap.
