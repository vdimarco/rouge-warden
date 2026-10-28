# Rehearsal before the page

Mission 5 is the theatre chapter in `games/nord-unreal/Design/SaveThePark.md`. No new rendering technique is involved, so none of the usual art references fit. The posts reuse the campaign's comic primitives. The page turn is those posts becoming visible, not a new effect.

The mapped Théâtre de Verdure sign sits on the pond island. The play spots are on dry ground south of the west pond, checked against `LaFontaineWater.h`: loading (-8600, 1800), followspot (-9800, 2200), backdrop (-7400, 2200), stage mark (-8600, 2600). Recover steps 700 cm south, because north of the stage is water. `Scripts/test_show_rules.py` checks clearance from the side jobs, the pond scene and the court.

`AQuebecCampaign::ShowStep` replicates and starts at 0. It is not written by `SaveBoundary`. `IsShowOpen()` requires the picnic and the court to be banked. A boundary-2 reload therefore offers mission 3 again. Race replay does not clear the step, and it refuses to start while the show is open.

The first two stations can be used in either order. Using the same station twice does not skip the other. The curtain accepts E only at the loading edge, and only after both stations are set. That is the one-pawn form of the design's server gate: the cue is not on the stage. Pulling it plays the existing complete cue, leaves CompletedMissions at 2, and does not save.

The local page sound is `QuebecShowTone`: a 90 Hz thump plus a 1400 Hz flutter, about 200 ms. It plays once when the replicated step changes from the cue to banked. It is not one of the cooked feedback assets, and it does not change which music loop is selected.
