# Design: graded slide banner

## Source

No outside model fit. The grade lines come from drives of the round-85 test car, at three gas times, three steering amounts and four brake lengths. Every slide that held past 0.35 s lasted 0.4 to 0.8 s, so time alone does not separate them. Peak sideways speed does: about 370 cm/s for a half turn, 600 cm/s for a full turn after 3 s of gas, and 730 to 820 cm/s for a full turn at speed.

## Rule

The live line is the same as before: handbrake held, 450 cm/s or faster, 180 cm/s or more sideways. `QuebecSlide::FState` keeps the time held and the peak sideways speed while the slide is live. When the slide ends, it pays if it held for at least 0.35 s and the last pay was at least 1.5 s ago. A slide that is still live at 2.5 s pays then, and only once.

- Peak under 550 cm/s: SLIDE
- 550 cm/s to under 700 cm/s: BIG SLIDE
- 700 cm/s or more: HUGE SLIDE

The detail line is "Held for 0.4 s", with one decimal. A failsafe stop ends the slide with no banner, and a car with no driver forgets its slide. Before, the car passed `bHandbrake && !bFailsafe`. That would now make the end of a slide pay, so the failsafe is its own flag.

## Timing

The banner is later than before. In the round-85 drive, it moves from 3.57 s to 3.65 s, while the car still moves. The scream from round 86 covers the time before it.
