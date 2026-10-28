# Pond scene on the finished race

Mission 3 is the pond chapter in `games/nord-unreal/Design/SaveThePark.md`. No new rendering technique is involved, so none of the usual art references fit. The posts are the campaign's existing comic cylinders and cubes, shown and hidden. The blink is visibility, so the steady beam never needs its own material.

`QuebecPondRules` holds the steps, the spots, the blink, and the sprint crossing with no Unreal types. `Scripts/test_pond_rules.py` checks them. The spots sit north of the surveyed ponds (west pond y max 10911.6, east pond y max about 8919), and at least 15 m from the QA anchors and the side-job points.

`AQuebecCampaign::PondStep` replicates and starts at 0. It is not written by `SaveBoundary`. `IsCampaignComplete()` stays "phase is Complete", so a finished race still reports complete. `IsPondOpen()` is that phase with the picnic not yet banked. Race finish does not clear the step. Race replay does not clear it either, and it refuses to start while the pond is open.

The campaign tick is 50 ms. A sprint covers about 40 cm in one tick, so the dash cannot require a single sample to jump a 450 cm gap. The rule latches "was far" and then counts the tick that enters the 280 cm ring while moving at least 650 cm/s. Walking across the ring does not count. Standing on the finish and sprinting in place does not count.

R teleports north of the current step, outside the ring and on land, and leaves the step index alone. Pulling the clamp plays the existing complete cue, leaves CompletedMissions at 2, and does not save.
