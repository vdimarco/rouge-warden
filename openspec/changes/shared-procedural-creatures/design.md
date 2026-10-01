# Design

Pin upstream source and retain MIT/third-party notices. Compile its engine-independent C# core with .NET 8 in a read-only GitHub build, then check the original sprite sheets, genome presets and provenance into the repository. Generate two seeds per family, four motion states and eight directions at six frames per second. Browser games need no C# runtime.

Keep selection and neutral intent independent of simulation and rendering. The canvas player uses source metadata for timing and ground pivots, with lazy image loading and an eight-creature inactive-cache budget. Visible creatures remain resident; fallback art keeps gameplay visible if loading fails. Asset failures appear in the QA snapshot.

Assign reproducible species to lane waves, siege units, bosses and neutral camps without consuming the combat RNG. Expand from two to four camps with bounded spawn jitter. Neutral camps require manual selection or a damaging skill, retaliate against the attacker, and return home outside a 390-unit leash or after six seconds without a hit. Returning camps heal and ignore damage. Existing camp rewards and 32-second respawn remain. Recruited bosses retain their creature identity.

Check metadata and all page bounds, loading deduplication, deterministic gameplay, neutral engagement/return/rewards, existing combat and twelve complete matches. Check visual loading, controls and asset/page errors at 390×844, 844×390 and 1440×900 in Chromium. Review browser screenshots separately. Actual phones remain a manual check.
