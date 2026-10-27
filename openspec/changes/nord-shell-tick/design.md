# Shell tick

## Decision

The poll interval is a named tenth of a second. Five of those fit inside a puff's life. Two of the old half-second gaps do not. The test fails if the half-second poll returns.

Phone steering and the video stream are not this poll.

## Rendering

None of the usual art references fit. This is a publish interval, not a new picture.
