# Tasks

- [x] Add the six-scene how to play stage and wire autoplay to the existing motion switch
- [x] Keep the rules text, the 44px close control, and the 390px sheet
- [x] Check the browser QA, including a still frame under `fast=1` and motion when it is allowed

Browser QA passed: 186 checks, 0 failed. First load was 509,664 bytes, under 500 KB. At 390 by 844 the stage is 314 by 188, the scene dots are 47 by 44, and Close is 44px tall and stays on screen. `fast=1` leaves the scene still and a dot still opens the race. Without `fast=1` the year token runs `help-hop` and the stage advances on its own. A 390px recording shows the heat line, cards, mercury, path shade, race bars, and the pathway dot, including the stall at Pilot. OpenSpec CLI was not installed, so spec validation did not run. A physical phone was not used.
