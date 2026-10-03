- [x] Compensate movement and walking intensity for camera projection.
- [x] Verify direction, speed, analog strength, upgrades, and layouts; build the game.
- [x] Check deployed controls, update the canonical spec, and archive the change.

Verification: all 15 tests passed. Timed engine checks covered both views, all eight directions, two joystick strengths, Hermes levels 0 and 4, and 390×844, 844×390 and 540×900 canvases. Game build and git diff checks passed. Deployed preview exercised keyboard movement, diagonal pointer drags, pause, view switching, and resume; no game errors were observed. Native phone touch was not tested. OpenSpec CLI was unavailable; requirement and WHEN/THEN scenario structure were checked directly.
