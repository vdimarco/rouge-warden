# Design: a slide chain on the graded banner

## Source

No outside design was adapted. The count is the familiar combo meter of driving games, kept to the banner the slide already has.

## Rule

`QuebecSlide::FState` keeps `Chain`. When a slide pays, the chain grows by one if an earlier slide paid no more than 5 s ago. Otherwise it is 1. It stops at 9, so the title keeps one digit. `QuebecSlide::ChainTitle` writes the grade for 1, and the grade with x2 through x9 for a chain. The longest title is HUGE SLIDE x9. The detail line stays "Held for … s".

## Why 5 s

Each slide pays when it ends. In the test drive, the next slide pays 4.2 s later: 3 s of gas back up to speed, then the handbrake turn. A driver who goes straight back to the gas chains. A 2 s coast makes a 6.2 s gap and starts over.

## Session

The test drives the shared car in `Scripts/slide_car.h`. Three full turns pay at 3.65, 7.85, and 12.05 s and read BIG SLIDE, BIG SLIDE x2, BIG SLIDE x3. After a 2 s coast, the fourth pays at 18.25 s and reads BIG SLIDE.
