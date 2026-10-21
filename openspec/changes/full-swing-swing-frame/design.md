# Lead room on a fast rope

## Source

Mark Haigh-Hutchinson, Real-Time Cameras (2009). The subject sits off the centre so the space ahead of the motion stays in frame. The standing chase already slides to the hero's right. This adds the vertical part of that lead, and only while a rope is moving fast.

## Decisions

- The rise is a camera slide after the arm is placed. `FLATCAM.arm` stays 4.5 m and `FLATCAM.pitch0` stays −20°. The reported pitch and distance are the arm, measured before the slide.
- It adds up to 1.15 m, faded in from 8 to 14 m/s, and only off the ground with a rope. It uses the same height fade as the standing lift, so looking up, when the camera is already down by the head, adds none of it. The ceiling check still stops it.
- A stand, a run on the street, and first person do not take it.
