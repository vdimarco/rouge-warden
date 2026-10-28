# A gap in the beam

Mission 7 is the convoy chapter in `games/nord-unreal/Design/SaveThePark.md`. No new rendering technique is involved, so none of the usual art references fit. The posts reuse the campaign's comic primitives. The beam is a bar that shows while it paints and during the short warning before the next paint.

The design's moving wagons, the drive, and the co-op split need Unreal play. This round is the one-pawn form: three stops on the surveyed street ring. A disruption that already landed does not rewind, which is the design's "completed disruptions remain banked" rule without a chasing wagon.

The stops sit on the sidewalk side of the race loop, clear of the gates by at least 15 m: feeder (30609, -24632), projector (35249, -24633), escape (32789, -21585). Their Y is south of both pond polygons in `LaFontaineWater.h`, so they are dry. Recover steps 700 cm further off the carriageway: feeder (30035, -24232), projector (35942, -24728), escape (32227, -21167). `Scripts/test_convoy_rules.py` checks that clearance, and that a pull is refused only while the beam is painting.

`AQuebecCampaign::ConvoyStep` replicates and starts at 0. It is not written by `SaveBoundary`. `IsConvoyOpen()` requires the picnic, the court, the show and the three groups to be banked. A boundary-2 reload therefore offers mission 3 again. Race replay does not clear the step, and it refuses to start while the convoy is open.

The beam period is 3.2 seconds. The first second paints. The last 0.6 seconds warn. The pull lands in the gap and during the warning. It does not save and it does not change CompletedMissions. When the step reaches 4 the side-job guide returns. `IsCampaignComplete()` stays `Phase == Complete`.
