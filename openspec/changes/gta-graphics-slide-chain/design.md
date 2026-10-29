# Design: a slide chain

## Source

No outside design was adapted. The count is the familiar combo meter of driving games, kept to the banner the slide already has.

## Rule

`QuebecSlide::FState` keeps `Chain`. On a pay, the chain grows by one when an earlier slide paid no more than 5 s ago. Otherwise it is 1. It stops at 9, so the title keeps one digit. `QuebecSlide::Title` writes SLIDE for 1 and SLIDE x2 through SLIDE x9 for a chain. The banner detail stays "Through the corner".

## Why 5 s

The scripted drive takes 4.2 s from one pay to the next: 3 s of gas back up to speed, then the handbrake turn. A driver who goes straight back to the gas chains. A 2 s coast between slides makes a 6.2 s gap and starts over. The window asks for one thing: keep the car moving between corners.

## Session

The test drives the same 60 Hz car step as round 85. Three quick slides pay at 3.57, 7.77, and 11.97 s and read SLIDE, x2, x3. After a 2 s coast, the fourth pays at 18.17 s and reads SLIDE.
