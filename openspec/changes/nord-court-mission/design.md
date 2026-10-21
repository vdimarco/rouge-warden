# Exhibition court after the picnic

Mission 4 is the sports-court chapter in `games/nord-unreal/Design/SaveThePark.md`. No new rendering technique is involved, so none of the usual art references fit. The posts reuse the campaign's comic cubes, cylinders and spheres (`AddPart` with the existing ink, gold, cream, lime and berry materials). The ball is a function of server time, not a physics sim. The ink sweep is a bar that shows only while it is dangerous or telegraphing.

`QuebecCourtRules` holds the steps, the mapped court ring, the timing windows and the part visibility with no Unreal types. `Scripts/test_court_rules.py` checks them. The ring is OSM way 236077376, the first tennis court in `Data/EnvironmentRefresh/layout.json`. Spots sit inside that ring, at least 15 m from the side-job anchors and the pond spots, and each pair the player can stand on in one step is more than twice the 200 cm reach apart.

`AQuebecCampaign::CourtStep` replicates and starts at 0. It is not written by `SaveBoundary`. `IsCampaignComplete()` stays "phase is Complete". `IsCourtOpen()` is that phase, with the picnic banked and the court not yet banked. A boundary-2 reload therefore offers mission 3 again. Race replay does not clear `CourtStep` or `PondStep`, and it refuses to start while either beat is open.

The gold panel is the trap: scoring it once, while the ball is on it, opens the return gate and is the checkpoint. Scoring it again stays on that step and plays the existing dialogue cue. The bank shot counts only when the ball is on the middle panel and the ink sweep is not in its danger window. The rules sample both a clear window and a dangerous window inside one 48 second span, so the shot is possible and not automatic. Pulling the clamp plays the existing complete cue, leaves CompletedMissions at 2, and does not save.

R teleports 700 cm north of the current step, outside the 200 cm reach, and leaves the step index alone.
