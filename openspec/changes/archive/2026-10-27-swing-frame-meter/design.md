# A measured swing

## Decision

The play window is the existing debug frame metrics, driven one callback at a time after the city has compiled. Headless Chromium's own present clock stays out of the sample: on this machine it waited about a second between callbacks while the main thread was idle. The callback interval is the frame's main-thread cost. Input-to-submit is the press until that callback starts. A warmup of driven frames sits in front of the window so a one-time stall there is not the score.

The floors are a regression gate for this renderer. They are wider than the sample this machine recorded, and they are not a console bar.

## Rendering

No new rendering technique. No outside source applies.

## Out of scope

No new mission, no flush change, and no King attack. Hardware display latency stays unmeasured.
