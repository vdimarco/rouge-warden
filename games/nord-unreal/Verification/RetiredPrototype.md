# Older prototype retired — 2026-10-14

At the user's request, the older three-objective prototype was removed from the active workspace path. The current game remains `/home/von/Work/rouge-warden-codex-nord-unreal/games/nord-unreal/Quebec.uproject`.

The full previous project is retained at `/home/von/Documents/ChatGPT/Archive/NORD-prototype-20261014`: 78,043 files, approximately 25.89 GiB, including its Git repository, ignored packages/caches/recovery files and all three untracked `Preview/HeistGang*.jpg` sheets. Every moved file's inode and byte size was checked against its original inventory; the untracked sheets additionally passed SHA-256 comparison. `RETIREMENT.json` in the archive records the result.

`Quebec.uproject`, `Scripts/launch.sh` and `Builds/Linux/Quebec.sh` have `.disabled` suffixes in the archive. The previous source directory contains a README, an agent-routing instruction and a launcher that exits with status 2 and identifies the current game. Its engine project and packages are no longer at their former paths. No symlink routes the old location into the archive.

The process scan found no game, Unreal Editor or signalling server using the old source or package. Agent/tooling processes retained that directory as their working directory; it was preserved as a retirement notice so those sessions keep a valid working directory. The live native/signalling commands and service working directory point to the integrated game. No desktop/autostart/systemd launcher referencing the old game was found in the inspected user locations. The local Unreal workflow reference was updated to identify the archive and direct all new work to the integrated game.

This is a recoverable retirement, not deletion of historical source or art. The archive still occupies disk space. Current native/browser packages, service configuration, tunnels and production saves were not changed by the retirement.
