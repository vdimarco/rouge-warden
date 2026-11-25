# Design

## The house splat
Four PINOC scenes (salon, kitchen, main bedroom, basement family room) were made from 2 to 4 listing photos each. Each
scene is SPZ version 4: a 32-byte header, a table of stream sizes, and five zstd streams (positions, opacity, colour,
scale, rotation). The rotation is the "smallest three" quaternion of the SPZ format (Niantic's `spz` reference,
`load-spz.cc`); a check on floor splats confirmed the x, y, z, w order (their thin axis is vertical).

Each room is scaled to metres from the floor under the capture point (PINOC puts it 1.5 m under the eye), turned so its
walls are square to the axes (the angle at which the wall splats make the sharpest lines on the floor plan), cut at its
walls, and placed: salon at the front, bedroom then kitchen behind it on the left, with a doorway in each shared wall,
in a line like a plex hallway. A stair shaft behind the salon leads down to the basement. The stairs and the shaft walls
are flat splats made by the script, because no photo shows them. Doorway cuts also remove splats whose own size reaches
into the opening, so large wall splats do not smear across it.

Source adapted: none for the joining; it is translation, a turn about y and uniform scale of the splats, with the
quaternions turned to match. Spark (sparkjs.dev) draws the result, as it draws the other worlds.

## Sealing
AES-GCM with a 256-bit key from PBKDF2-SHA256, 600,000 iterations and a 16-byte random salt (the OWASP Password Storage
Cheat Sheet figure for PBKDF2-HMAC-SHA256). Each file is a 12-byte IV followed by the ciphertext and tag. The world's
`screens.json` holds the salt, the count and a sealed check text. The browser uses the Web Crypto API
(`SubtleCrypto.deriveKey` and `decrypt`). The key lives in memory for the visit only. This protects the content of the
files as well as the password is strong; a static site cannot stop anyone from downloading the sealed files.

## Walking on floors
`walkFloors` in `hall.js`: a step ends in the nearest box whose floor is within 0.45 m of the visitor's floor, among
the boxes the visitor stands in and the boxes that overlap them. Two rooms connect only through a box that overlaps
both (a doorway), so a step cannot pass through a wall. A box with a pair of heights is a slope along z: the stairs.
The frame of the camera takes the floor height, so the eye stays 1.5 m above the floor on the stairs.

## How to check
- `node qa/lab/riftwalk.test.mjs`: the door's place, the sealed files, a wrong password refused, and walks through the
  doorways, down and up the stairs, into a wall, and under the stairs. With `RIFTWALK_PASSWORD` set, the right password
  opens the check text.
- `node qa/lab/riftwalk.e2e.mjs` with the server: the locked door, the card, a wrong password, Esc and Cancel, and no
  world request before the password; with `RIFTWALK_PASSWORD`, the open house, the doorways and the stairs.
- Spark renders of the house from inside (salon, bedroom doorway, top of the stairs, basement).
