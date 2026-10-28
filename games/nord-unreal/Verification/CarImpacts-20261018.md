# Car impact host verification — 18 October 2026

PR #404 (`88091eda`, merged into `8c25382b`) adds the impact state field `YawRate`, which makes UE 5.8.3's Linux compiler reject an existing steering-local variable of the same name under `-Werror,-Wshadow`. The follow-up renames only that local and its two uses to `SteeringYawRate`.

## Host checks

- Exact PR source plus this rename was built in an isolated temporary project on the owner's Linux PC. The active dirty checkout and its unrelated edits were preserved.
- QuebecEditor and Quebec Linux Development builds both exit 0.
- All five `Quebec.Driving` tests succeed: momentum, fitted hull/curb/wall contact, frame-rate consistency, steering/handbrake/recovery, and throttle/brake validation. The normal `Automation SoftQuit` runner exits 0. The contact fixture emits five existing no-world-context teardown warnings; there are no test errors. An earlier forced `TestExit` attempt exits 1 and is retained separately.
- `Scripts/car_collision_test.py` passes all 13 checks in authoritative PIE on LaFontaine and exits 0: saved-map markings, 2 cm strip, 18 cm curb forward/reverse, and blocking tall wall. The first isolated attempt lacked the read-only Data link; the rerun with the actual source data passes.
- Fresh BuildCookRun cooks LaFontaine and CollegeBathurst, stages and archives successfully (exit 0), with no cook warnings/errors.
- The fresh package is installed at `Builds/Browser/Linux`; the prior package is retained at `Builds/Browser/Linux-BeforeImpacts-20261018`. Every runtime Saved tree was preserved by the checked installer. Original campaign saves retain their hashes.

## Public live stream

The actual public player at https://nord-montreal.vercel.app/ displayed the new game during these tests. A temporary local CSV/console fixture applied the existing native enter/throttle/handbrake/exit callbacks and sampled actual authority car transforms and speeds; no test hooks were added to game source. The driver alone was positioned behind moving traffic to arrange the two rear-end cases; target cars remained on their real routes.

- The player pushed two actual curb-parked cars 487.40 cm and 157.59 cm. Both later settled at zero speed.
- Moving traffic car `QuebecCar_2147482175` started at 604.80 cm/s and reached 1351.04 cm/s from the ram, with recorded yaw/side displacement. It subsequently resumed normal traffic speed (537.29 cm/s).
- Moving traffic car `QuebecCar_2147482164` started at 578.63 cm/s and reached 1388.83 cm/s from the ram. It subsequently resumed normal traffic speed (644.75 cm/s).
- The primary agent inspected the live stream and saved unedited parked/traffic screenshots. The player exited the car after testing. The temporary macro and fixture launcher were removed, and the original guarded Tripo demo launcher was restored. Public/Funnel/TURN services retained their identities.

Raw build/test/package logs, automation JSON, installer inventories, native motion samples and stream screenshots are local under `Saved/Tests/PR404-20261018/`. `Restored.json` records the installed binary hash, package identity and save preservation. The temporary build and isolated Git follow-up worktree are under `/tmp/nord-pr404-qa` and `/tmp/nord-pr404-fix`.

## Limits

This is automated native driving viewed through the public URL on the host PC. It does not establish physical-phone/off-LAN behavior, audible playback, subjective handling, prolonged driving performance or a full campaign playthrough. No frontend runtime change or deployment was needed. OpenSpec CLI is unavailable; the archived delta and canonical requirement were checked directly.
