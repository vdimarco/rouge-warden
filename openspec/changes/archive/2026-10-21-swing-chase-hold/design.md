# Hold the chase for the first swing

The behaviour is adapted from Marvel's Spider-Man 2 (Insomniac, 2023): the opening chase teaches the swing, and the target waits through that beat instead of burning a fail timer. No render paper applies. The card uses the mission pill that is already there. The words are original.

`jobs.holdChase` sets the runner's speed to 0 and skips the clock. `runPath` stands a runner whose speed is 0, so he does not creep. `startSludge` holds only when `progress.tutorial` is 0, which is the gold-ring row and the spoken tutorial's first line. The next play frame releases the hold when either rope is attached, or when that lesson is no longer step 0 (the row ticked, or Skip). A test that calls `G.test.job("sludge")` does not hold, so a chase check still sees a running runner.
