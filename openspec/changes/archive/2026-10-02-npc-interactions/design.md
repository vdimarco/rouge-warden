# Design

Reuse combat down events and existing prop/interact/ammo APIs for pistol drops. Reuse vehicle door pivots, seat nodes and cast animation poses for a timed carjacking phase before normal entry. Traffic gets a temporary visible civilian driver when taken; police and scripted drivers use their own cast identities. Keep controls locked through the pull/throw and clean up temporary actors on exit. Add working front door pivots to every drivable kind. Generate four textured 8k-triangle humanoids through fal Meshy with rigging enabled and verify compatibility before enabling BODY_URL entries.


The four generated meshes contain 8,305–8,335 triangles and retain their 24 Meshy joints and original skin weights. Embedded diffuse maps are reduced to 1024px JPEG quality 88, totaling 4,661,992 bytes. Sources, exact prompts, requests, hashes and local paths are in `public/crimson/assets/npc-fal.json`.

The existing coarse mesh index visibly breaks textured silhouettes. These already reduced NPC meshes stay intact; coarse geometry now applies only above 10k triangles, while the existing 8k low-tier outline cutoff remains. Animation throttling and visibility culling still apply. No new runtime dependencies.

The new bodies have distinct anatomy, rather than the old generated bodies' donor proportions. The original 13 bodies retain their strict source-height comparison. New NPCs instead check all clips for finite tracks, walk height against their own bind pose, live walk/fight/sit/fall matrices, and desktop/phone visuals. Missing model requests explicitly exercise the procedural fallback.

Civilian drivers remain on the ground for 20 seconds before cleanup; scripted drivers and police recover after four seconds. Police resume combat and can subsequently drop their pistol. Gun drops expire after 120 simulation seconds and reset on session exit.
