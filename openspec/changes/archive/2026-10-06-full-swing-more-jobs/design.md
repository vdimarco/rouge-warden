# Design

## Taxi

The offer sits on a street like the pizza shop. `jobs.update` checks each marker: a taxi marker starts only when
`h.driving` (the hero is in a car and the game is in play). On foot it emits a `say` line at most every 6 s. The drop is
`streetNear` of a point 260 to 560 m away. The clock is distance / 13 m/s + 20 s. Arriving in a car within 9 m of the drop
pays 35 plus up to 20 tip, scaled by the time left. More than 4 s out of the car fails the job ("walked").

Before this change `jobs.offersOn` was off while driving, which also hid the map pins. Now it stays on, and the marker
loop skips non-taxi markers while busy, so nothing else starts from a car.

## Thief

The thief is a combat runner (the Sludge Run's runner code) with 1 hit point and a path from `streetRun`: from the
crossing nearest the offer, 4 to 6 hops to neighbouring crossings, never straight back, each hop sampled for buildings and
water. The clock is the run's length / 6.3 m/s + 4 s; reaching the end or the clock running out fails ("away"). Knocking
him down (punch, kick, dive, rope yank, a car) ends the job well.

Taxi, thief and the Sludge Run are excluded from the 700 m "left the job behind" rule, since all three travel.
