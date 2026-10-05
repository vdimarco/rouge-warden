# Frame the trophy photo on time

A trophy, a legend or a fish that opens a place gets a photo beat. The fish shows alone, the camera pushes in, the flash comes at 1.2 s, and the card comes up at 1.5 s. The game times the flash and the card by the wall clock. The lake times the push-in and the camera's move to the fish by its own clock, and that clock moves at most 50 ms a frame. When frames take longer, the lake falls behind. The flash then comes while the camera is still moving down from the lake, and the photo shows the fish low in the view, behind the place where the card comes up. A jump just before the landing makes the camera's move longer, because the jump's zoom looks up at the leap.

The bug showed in the store screenshots, which render in software. On a phone at 30 to 60 fps, the camera is within a degree or two of its place at the flash. The bug shows on slow phones, and after a long frame when the catch first loads.

## Scope

- Run the photo beat's push-in, its hold and its sparks on the wall clock, the clock that the flash and the card use.
- Move the camera to the photo's pose on the push-in's own curve, so it arrives when the push-in ends, from any pose.
- Take the game's flash and card times from the world's photo numbers, so the two cannot drift apart.
- Add a browser check, and remove the zoom wait from the screenshot script.
- Render the Android trophy screenshot again.

## Player-facing change

The trophy photo always shows the fish in the middle of the part of the view that the card leaves free, also right after a jump and on a slow phone. On a fast phone the beat looks the same as before.
