# Tasks

- [x] Implement wheel and horizontal drag using existing input cleanup.
- [x] Test direction changes, deadzone, concurrent pedals and interruption.
- [x] Check browser layouts and build; record device limitations.

Validation: 61 unit tests passed; build passed; Chromium DOM/input/layout checks and screenshots at 320×568, 390×844, 844×390 and 1280×720 passed. Browser plugin skill unavailable; used installed Playwright with system Chromium. Real phone/live driving feel not tested. OpenSpec CLI unavailable; artifacts checked manually.

Follow-up: labels and icons checked within button bounds in driving, walking and swimming modes at all four widths; wheel captions given opaque backgrounds. Menu moved to top left; opening and Escape close verified at all four widths. Build and diff checks passed.

Merge validation: full browser suite passed on the isolated branch. Moved the install reminder clear of the top-left Menu button. Added steering-layout.test.mjs to browser CI to check drag, label bounds in all modes, menu interaction and layout at four sizes.
