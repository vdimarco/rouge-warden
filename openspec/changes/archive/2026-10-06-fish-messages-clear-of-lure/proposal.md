# Messages clear of the lure

On a phone the owner saw the messages cover the lure. In the tall reel (portrait), the prompt stood 52 px under the gauge, and the cast report stood under the prompt, near the middle of the screen. On a 412 x 915 phone the report reached 45% of the height, and a long cast's lure lands on the far water at about 49 to 54%. In the wide reel (landscape touch play) the report stood in the middle of the screen, on the lure.

## Scope

- Tall reel: the prompt and the "Fish on!" banner go just under the gauge. The cast report goes beside the gauge, in the sky, where the toast goes; a toast waits while the report is up. A long toast (Larger text) moves the prompt down while it shows.
- Wide reel and wide cast: the cast report goes to the top right, opposite the gauge. On a short wide screen the prompt is a little higher and tighter.
- The gauge fades in with no rise, so the prompt under it never touches it.
- `world.lureScreen()` gives the lure's place on the screen, for the checks.
- A browser check, `qa/fish/messages.e2e.mjs`.

## Player-facing change

After a cast, the distance and the verdict show at the top beside the gauge, and the instructions show in the sky above the far shore. Nothing covers the lure on the water.
