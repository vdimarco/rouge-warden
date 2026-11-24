# Riftwalk: a private Home world behind a locked door

## Why
The user gave a Google Photos album of their house and asked for a Gaussian splat of it. Four rooms were made as
PINOC (Viggle) scenes from the photos, then joined into one floor plan with doorways, stairs and a basement. The user
then asked to put the house in Riftwalk as a world, and to make it password protected.

## What changes
- A seventh door on the alley, **Home**, on the plain east wall of the north street. It is not a collection of games:
  it has no zone button, no games and no picture in its door. Its card says "Locked · a private world".
- Going through the door (a click, Enter, R, the Go in button or a walk at it) shows a password card. A wrong password
  is refused. The right one opens the house.
- The house's files are sealed with AES-GCM; the key comes from the password through PBKDF2. Only the sealed files are in
  the repository. The page checks the password against a short sealed text before it downloads anything.
- A world can have floors: boxes to walk on, with slopes for stairs. The house uses them for its rooms, doorways, stairs
  and basement. A visitor goes up and down the stairs and cannot walk through a wall or drop through a floor.
- `qa/lab/riftwalk-seal.mjs` seals a world with a password from the environment, so the password can be changed.

## Scope
The street address, the photos and the unsealed splat files stay out of the repository. The password is never written
to the repository, a commit or a pull request. The six zones, their doors and the homepage rows are unchanged.
