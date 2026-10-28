# Three pulls, any order

Mission 6 is the gathering-point chapter in `games/nord-unreal/Design/SaveThePark.md`. No new rendering technique is involved, so none of the usual art references fit. The posts reuse the campaign's comic primitives. They stay visible once the show is banked, including after the last group is out.

The design's escorts, the worklight fixture, the ink-free lane and the missing-person walk need Unreal play and NPC routing. This round is the one-pawn form: three authored pulls. Losing the checkpoint does not clear a bit that is already set, which is the design's "groups already rescued stay rescued" rule without followers.

The posts were checked dry against `LaFontaineWater.h`. Terrace (10200, 5200) recovers east to (10900, 5200), because south (10200, 4500) and west (9500, 5200) are water. Pond (-1800, 10000) recovers south to (-1800, 9300). Court (18000, 28000) recovers south to (18000, 27300). `Scripts/test_rescue_rules.py` checks clearance from the side jobs and from the pond, court and show spots.

`AQuebecCampaign::RescueMask` replicates and starts at 0. It is a bitfield, not a linear step, so freeing one group cannot rewind another. It is not written by `SaveBoundary`. `IsRescueOpen()` requires the picnic, the court and the show to be banked, and a mask in `[0, 7)`. A boundary-2 reload therefore offers mission 3 again. Race replay does not clear the mask, and it refuses to start while any group is still open.

The gold diamond marks the first unfinished group in terrace, pond, court order. Any unfinished post still accepts E. The pull does not save and does not change CompletedMissions. When the mask reaches 7 the side-job guide returns. `IsCampaignComplete()` stays `Phase == Complete`.
