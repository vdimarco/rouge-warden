# Blink tick

The decoy beams already share a 2.4 s blink in `QuebecPondRules::BeamLit`. `BlinkEdge` is true when a later sample sees the other half of that blink. The campaign tick and the local player tick are both much faster than 1.2 s, so one edge is one tick.

The sound is `QuebecPondTone`: an original 740 Hz decay, 80 ms, peak 0.22. No cooked asset, and no reference recording was adapted. The local controller queues it on a second audio component only while mission 3 is on the tag step. A wrong tag uses the existing dialogue cue.

The neighborhood and race loops are unchanged.
