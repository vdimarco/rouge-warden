# Independent neutral-face visual review: styles 3–6

Re-reviewed the final production matrices after the LimeJacket v2 update: `Verification/PlayerQuality/PlayerQuality1280.json` (written 2026-10-10 05:39:02 UTC) and `Verification/PlayerQuality/PlayerQuality1920.json` (written 2026-10-10 05:42:49 UTC). Both automated reports record `passed: true` for all eight bodies and 56 views each, totaling 112 final captures. Source is `Data/CharactersNeutral`, assets are `/Game/ParkComic/Crew`, with no PIE mesh/clip overrides. Independent visual inspection is scoped to the eight current `Face`/`FaceThreeQuarter` PNGs for styles 3–6 at each resolution (16 face views), plus four `Idle` views and four movement snapshots at 720p. All inspected face PNG dimensions match their stated resolution.

| Style | Resting face and retained identity cues | Visible limits |
| --- | --- | --- |
| 3 | Relaxed closed lips, readable aligned eyes, coherent nose/jaw in both angles. Green backward cap, moustache/goatee, navy jersey with red/white trim and 51 remain recognizable. | Painted skin/beard detail; coarse, irregular collar trim. |
| 4 | Relaxed closed mouth and cheeks; eyes remain visible behind round tinted glasses. Navy cap and red Memphis 33 jersey preserved. | Tinted glasses reduce eye readability; coarse neck/jersey edge. |
| 5 | Closed, slightly pursed/subtly smiling lips; coherent eyes, nose and jaw. Dark cap, rectangular glasses, beard and black outfit preserved. | Thick generated glasses and painterly beard/skin. |
| 6 | Closed lips with a mild smile; coherent eyes, nose and jaw. Backward white cap, rectangular glasses, full beard and black outfit preserved. | Chunky, protruding far-side glasses rim in the quarter view; small pale painted streaks above the frames; irregular collar edge. |

No eye/mouth geometry blocker, broad tooth bar, gaping grin, or previous purple triangular atlas corruption was visible in the final inspected face views at either resolution. The inspected faces have readable eyes and closed lip lines; style 5 retains a fuller, slightly pursed lip shape rather than a broad smile. The expressions read quietly rather than exaggeratedly. The style 6 eyewear/paint limitations are more visible close up, but do not obscure the mouth or erase the eyes.

Movement spot checks: `Resident3_Run`, `Resident4_Airborne`, `Resident5_Landing`, and `Resident6_Run` retain coherent body silhouettes and faces without obvious mesh explosion or severe limb distortion. Still images cannot establish temporal smoothness; the automated pose/movement checks provide separate evidence.

These are stylized, generated **resting expressions**. This review does not claim photoreal likeness, blinking, lip sync, or an animated facial rig. Final-run visual scope is 16 face views across both resolutions, four idle views and four movement snapshots at 720p. Idle head motion varies the effective viewing angle; this is not a matched frozen-pose turntable.

Temporary inspection budgets: final 720p uses a 1024 MB texture streaming pool and 2048 virtual-shadow-map physical pages; final 1080p inspection uses 512 MB/1024 pages to fit the shared GPU. These are inspection overrides, not production quality changes.
