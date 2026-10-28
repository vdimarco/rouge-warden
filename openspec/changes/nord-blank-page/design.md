# Three gates, then a blank page

Mission 8 is the closing chapter in `games/nord-unreal/Design/SaveThePark.md`. No new rendering technique is involved, so none of the usual art references fit. The gates reuse the campaign's comic primitives. The blank page is a cream panel that appears when the pull banks the step.

The design's drive, the page-turn attack and the two clamps need Unreal play. This round is the one-pawn form: three gates in order, then one pull. A crossed gate does not rewind, which is the design's checkpoint rule without the attack.

The gates sit south of the theatre and were checked dry against `LaFontaineWater.h`: gate 1 (-8600, 0), gate 2 (-10400, 0), gate 3 (-6800, 0), cue (-8600, -900). Recover steps west of the first two gates, east of the third, and south of the cue. `Scripts/test_blank_rules.py` checks clearance from the side jobs, the show, the rescue posts and the convoy.

`AQuebecCampaign::BlankStep` replicates and starts at 0. It is not written by `SaveBoundary`. `IsBlankOpen()` requires the picnic, the court, the show, the groups and the convoy to be banked. A boundary-2 reload therefore offers mission 3 again. Race replay does not clear the step, and it refuses to start while the page is open.

The pull does not save and it does not change CompletedMissions. When the step reaches 4 the side-job guide returns. `IsCampaignComplete()` stays `Phase == Complete`.
