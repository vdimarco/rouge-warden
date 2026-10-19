# Host steps for this change

The cloud container has no Unreal Engine and no GPU. These steps run on the owner's PC with UE 5.8.3. Run them in order from `games/nord-unreal/`, with the project's editor closed. Run PIE suites one at a time; they share port 17777.

```bash
ue_root=/home/von/.local/share/Epic/UE_5.8.3
cmd="$ue_root/Engine/Binaries/Linux/UnrealEditor-Cmd"
uproject="$(pwd)/Quebec.uproject"
```

## 1. Build
```bash
"$ue_root/Engine/Build/BatchFiles/Linux/Build.sh" QuebecEditor Linux Development "$uproject" -WaitMutex -NoUBA -NoHotReloadFromIDE
"$ue_root/Engine/Build/BatchFiles/Linux/Build.sh" Quebec Linux Development "$uproject" -WaitMutex -NoUBA
```
The cloud stub check compiled and linked every file in both configurations, but it cannot see engine API details. Fix what the real build finds. The module has one new class for the map, `AQuebecReplicaInstances`, so build before step 4.

## 2. Native tests
```bash
"$cmd" "$uproject" /Game/Maps/LaFontaine -NullRHI -unattended -nop4 -nosound -NordCampaignQA \
  '-ExecCmds=Automation RunTests Quebec;SoftQuit' -ReportExportPath="$(pwd)/Saved/Tests/GTA/Automation"
```
This change adds 36 tests under `Quebec.Combat`, `Quebec.Driving`, `Quebec.Jobs`, `Quebec.People`, `Quebec.Police` and `Quebec.Traffic`. Every existing `Quebec.*` test must still pass with its pinned numbers.

## 3. Python suites
Each line is `"$cmd" "$uproject" /Game/Maps/LaFontaine <flags> -ExecutePythonScript="$(pwd)/Scripts/<script>"`.

| Script | Flags | What changed for it |
| --- | --- | --- |
| `smoke_test.py` | `-NullRHI -RenderOffscreen -unattended -NordNoCampaign -nosound` | The hand-prop count skips parts tagged `NordCompanion`. |
| `car_collision_test.py` | same as smoke | Nothing. The replica curb is 18 cm. |
| `population_test.py` | `-NullRHI -unattended -nosound` | Residents with `Stride != 0` skip the pace check. Curb stops start after 120 s. |
| `test_resident_feedback.py` | `-NullRHI -unattended -NordResidentFeedbackQA -NordCampaignQA -NordNoCampaignSave -NordNoPolice` | Accepts the freeze or the dive, and checks that nobody is knocked down. |
| `test_story_slice.py` | `-NullRHI -unattended -NordCampaignQA`, then again with `-NordLag` | Nothing. Job markers and pickups stay off the radar near every fixture. |
| `test_race_drive.py` | `-NullRHI -unattended -NordCampaignQA` | Its analog steering now gets the road assist, and it does not brake for traffic that stops at ARRÊT signs, for people or at the curb. Compare with older runs only after you update it. |

Then the HUD captures: `test_compact_hud.py` and the story render checks at `-NordCaptureWidth=1280` and `1920`. The radar should match the accepted captures. Review them and accept again if the job markers or pickups show.

## 4. Map import
Regenerate the git-ignored geometry, back up the map, then import. Build Plex and Props before the replica test, because its apply-plan check needs every layer's OBJ files:
```bash
python3 Scripts/plateau_plex.py && python3 Scripts/test_plateau_plex.py
<blender-python> Scripts/blender/plateau_props.py && python3 Scripts/test_plateau_props.py
python3 Scripts/plateau_replica.py && python3 Scripts/test_plateau_replica.py
python3 Scripts/apply_plateau_replica.py --dry-run
backup="$(pwd)/Saved/Recovery/replica-$(date -u +%Y%m%dT%H%M%SZ)"
"$cmd" "$uproject" /Game/Maps/LaFontaine -NullRHI -Unattended -NoP4 -NoSound \
  -ExecutePythonScript="$(pwd)/Scripts/apply_plateau_replica.py" -NordPlateauReplicaBackup="$backup"
"$cmd" "$uproject" /Game/Maps/LaFontaine -NullRHI -Unattended -NoP4 -NoSound \
  -ExecutePythonScript="$(pwd)/Scripts/apply_plateau_replica.py" -NordPlateauReplicaBackup="$backup" -NordPlateauReplicaVerify
```
The script is additive and refuses to run twice. The only change to an existing actor is that the `OSM Marking` dashes are hidden. Then rerun `car_collision_test.py`, `population_test.py` and `Scripts/verify_lafontaine.py` on the saved map. Capture the six reference views and run `python3 Scripts/profile_package.py` after packaging: each p95 must stay under 16.67 ms. Compare the captures with `Preview/Replica/`.

## 5. Phone play over the stream
Play on a real phone at 667×375 and 800×360 landscape:
- Small wheel drags give gentle turns; the car settles on the road after a late correction.
- FIRE and WEAPON work; the aim lock holds a target through stream delay.
- The status column does not cover the radar, the captions or the touch buttons.
- A car aimed at a walker hits them; a walker beside the path dives.
- One star from a witnessed crime brings one police car without a hitch; the garage clears the stars when no unit sees you.

## 6. Package
Use the `BuildCookRun` command in `Browser/HOSTING.md`. Install with the checked installer so saves stay, then check the public stream.

## Known limits to confirm on the host
- Replaying one procedural sound wave on a pooled audio component (`notes-combat.md`).
- `WasRecentlyRendered(0.25)` as the pickup spin gate.
- The officer-distance stand-in for "being arrested" when R is pressed (`notes-jobs.md`).
- The remote-driver chase-camera view test for police spawns (`notes-police.md`).
- The world is still mirrored (`notes-mirror.md`).
