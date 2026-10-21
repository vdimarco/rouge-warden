# One slot, a later tail

No new rendering technique is involved, so none of the usual art references fit.

The production slot name stays `NordCampaign_v1`. Renaming it would hide the race boundaries players already have. The version field inside the file is the schema.

Version 1 still means completed missions 0–2 and no story tail. Missing tail fields load as zero, so an old file starts the pond again. Version 2 stays rejected. The story slice plants that version on disk and requires the bytes to survive an attempted write. This build never writes version 2.

Version 3 is the story tail: the same mission count, plus pond, court, show, rescue, convoy, blank page, tour, and home. Each value has to sit inside that beat's banked index. A later beat above zero is accepted only when every beat before it is banked. Any story step above zero also requires completed missions to be 2, because those beats open only after the race. A file that breaks those rules is left on disk and the session does not save over it.

The writer runs when a race boundary is banked and when a story step actually changes. A race replay does not clear the steps and does not write the slot. Hold clocks, court misses, the chain, and cash are not fields. A reload resumes the step and starts the hold, the combo, and the wallet over. Side errands stay session-only.

`IsCampaignComplete()` stays `Phase == Complete`. No phase is inserted before Complete.
