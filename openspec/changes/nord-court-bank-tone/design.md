# Whistle for the bank, rasp for the ink

No new rendering technique is involved, so none of the usual art references fit. The sounds are procedural samples in `QuebecCourtTone`, the same approach as the pond tick and the theatre page, because this container cannot cook a new `USoundWave`.

The whistle is 980 Hz plus 1470 Hz, about 100 ms. The rasp is 210 Hz plus a short crackle, about 50 ms. `Scripts/test_court_rules.py` checks that neither matches the pond tick or the page, and that both end quietly.

`CourtMisses` replicates and starts at 0. `SaveBoundary` does not write it. A spoiled bank is the redirect step refusing `EAct::Bank`, which the rules already defined. The campaign increments the count there and nowhere else, so scoring the gold trap still uses the dialogue cue instead of the rasp.

The local controller plays the whistle only on the edge from the redirect step to the pull step, and the rasp only when the miss count changes after it has been seen once. Joining a session that is already on the clamp does not replay the whistle.
