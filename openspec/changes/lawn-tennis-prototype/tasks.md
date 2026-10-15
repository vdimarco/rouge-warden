# Tasks

- [x] Write the canvas prototype in `public/tennis/` with the spec numbers, the scripted first point, and the test hook.
- [x] Add `qa/tennis/rally.test.mjs` and run it (9 passed, 0 failed).
- [x] Capture phone and desktop screenshots for the pull request. Chromium at 390x844, 360x640, 320x568, and 1280x800. A real phone was not used.
- [x] OpenSpec CLI is not installed here, so the change was not validated with `openspec validate`.
- [x] Add the Lawn Tennis cabinet to the Cottage group, after In Full Swing, with a matching switcher entry and `data-game="tennis"` on the game page.
- [x] Add tilt, flick, the garden gate, synthesized sound, and the phone bug fixes. `qa/tennis/tilt.test.mjs` 9 passed. Gate screenshots at 390, 360, and 320 in Chromium. No real phone.
- [x] Keep Arcade and Switch in a bar above the court at 390 by 844 and 568 by 320, with no empty side pad. Chromium touch screenshots. No real phone.
- [x] Use the approved casual and pro Neighbour tables, with casual as the default, and the 1.0 m reach rule.
- [x] Draw the 1.0 m gold marker, and the reach-miss swing, whoosh, and grass puff.
- [x] Report casual versus average and pro versus skilled Neighbour point-win rates, and keep pro versus skilled inside 30 to 40 percent. `qa/tennis/ai-balance.test.mjs`: casual vs average 22.1 percent, pro vs skilled 33.3 percent, 2,000 points each.
- [x] `openspec validate` could not run. The CLI is not installed.
