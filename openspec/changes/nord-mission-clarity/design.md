# Mission card guide

The campaign HUD already draws a gold diamond on the radar rim and a distance under the mission card whenever it has an objective. This change fills that objective after the story instead of adding a second marker language.

No new rendering or art technique is involved. Nothing from talks, papers or engine art docs was adapted.

`QuebecJobRules::FreeRoamGuide` chooses the job with no Unreal types, so `Scripts/test_job_rules.py` can check it. The story card wins until `EQuebecCampaignPhase::Complete`. A running job then wins over a nearer marker. Otherwise the nearest unfinished marker wins, and a fully finished set falls back to the nearest replay. Equal distances keep the earlier index.

`AQuebecSideJobs::GuideMarker` reads the ground-traced marker points and the replicated completion mask. The HUD in `QuebecGameplay.cpp` uses that index for the title, the objective line, the status line and the existing diamond. Touch copy names Menu · Recover and Menu · Race replay, matching `games/nord-unreal/Browser/index.html`. Keyboard copy keeps E, R and T.
