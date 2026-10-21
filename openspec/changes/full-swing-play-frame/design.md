# Play framing

## Source

Mark Haigh-Hutchinson, Real-Time Cameras (Morgan Kaufmann, 2009). The chase view gives the subject lead room and keeps the subject off the centre line. This takes only that framing: a shoulder slide and a small lift. It does not port a camera solver.

## Decisions

- The arm stays 4.5 m and the default pitch stays 20 degrees down. `flatcam.dist` and `flatcam.pitch` are measured before the slide, so the phone settle check still sees the chase.
- The slide is 0.95 m to the camera's right and 0.22 m up, scaled by the first-person blend, so the eyes are unshifted. The lift fades out once the camera is already within about 0.7 m of the eyes, which is the look-up pose. A taller lift there pushes the head off the bottom of the frame.
- A ray along the slide, a ray upward, and a small sphere at the camera stop the slide short of a wall or a ceiling.
- The look direction is unchanged. The centre ray moves with the camera, by about a metre, which is inside a street.
