# Temporary PC hosting

Vercel hosts the static browser player. The existing Linux GPU PC can run two full Unreal processes and Epic's signalling server. `NordHost` listens for normal Unreal multiplayer; `NordFriend1` joins it. Sharing one stream does not create another character. Each stream accepts one browser subscriber. This is a public two-slot demo without accounts, authentication, reservations or automatic recovery; anyone with the public endpoint can try to occupy a slot.

The public player is [nord-montreal.vercel.app](https://nord-montreal.vercel.app/), using temporary player signalling at `wss://omarchy.tail7b97f6.ts.net`. These describe the current deployment, not permanent hosting. See [recorded checks and remaining acceptance](../Verification/BrowserStreaming.md).

**Current host status: running at the 2026-10-10 22:30 UTC check.** The normal public player passed a fresh seven-check real-stream regression at 22:29 UTC, and the transient demo/Funnel units were active. The normal lifecycle, signalling and two native children remained alive through 12 readings ending 22:30:15 UTC, with at least 2,431 MiB free VRAM. An earlier restart failed with Vulkan out of memory under competing GPU use; its clean shutdown and the later recovery are recorded in [BrowserGpuRecovery.md](../Verification/BrowserGpuRecovery.md). The unchanged helper requires **at least 12,000 MiB free VRAM** on NVIDIA adapter 0 before launching two players. This check does not reserve memory or prevent a later competing process from exhausting it. The helper does not close other applications.

The PC must remain powered on, connected and running the lifecycle and Funnel when the demo is available. The configured launch uses two temporary user services so closing a tool terminal cannot stop it. Two 1280×720 output streams use a **High (2)** base, with global illumination/reflections/shadows at **1**, virtual shadow maps disabled, **75% internal screen percentage** and a **30 FPS render/WebRTC cap**. A cap is not a measured guarantee; see the bounded [performance record](../Verification/BrowserStreaming.md). Existing map/assets and gameplay are retained, with held-input cleanup on browser disconnect. The temporary host uses VP8 software encoding and synchronous MediaIO capture because this PC's H264 path stalled during testing; retest hardware encoding after engine/driver updates. Each stream has an 8 Mbps start rate and 12 Mbps WebRTC video ceiling. `-NoDebugExecBindings` disables Development debug key bindings, and Pixel Streaming `ConsoleCommand` payloads are disabled. The current command uses corrected `-PixelStreamingKeyFilter=Tilde`; native logs accepted it, and a bounded rendered Backquote test showed no console. Earlier live runs used the unknown `PixelStreamingInputKeyFilter` argument, so their Tilde filtering was ineffective. Only the host can write campaign progress. The browser package's host save directory remains intact across restarts; the guest disables campaign saving and uses `Saved_BrowserGuest` for its other files. The previous `Builds/Linux` package and its saves are separate and untouched. An isolated browser-package Mission 1 save and restart/reload passed, with production/guest saves unchanged; full Mission 2 progression/reload remains unverified.

## Prepare the existing package and pinned signalling server

Run from the repository root. The verified PC toolchain is **Node.js 26.7.0 / npm 11.19.0**; use those versions to reproduce the signalling preparation below. Git, `nvidia-smi` and the existing UE5.8 installation are also required. Check for active Unreal rendering before any rebuild; do not overlap another task's GPU job. Launch also needs at least 12,000 MiB free on NVIDIA adapter 0. This build-specific preflight threshold does not reserve VRAM or prevent another application from allocating memory after startup.

```bash
python3 games/nord-unreal/Scripts/browser_streaming.py self-check
ps -eo pid,comm,args | rg 'UnrealEditor|/Binaries/Linux/Quebec'
```

`Quebec.uproject` already enables `PixelStreaming2`. The streaming package belongs at `games/nord-unreal/Builds/Browser/Linux/Quebec.sh`. When it needs rebuilding, use the existing UE installation:

```bash
/home/von/.local/share/Epic/UE_5.8.3/Engine/Build/BatchFiles/RunUAT.sh BuildCookRun \
  -project="$PWD/games/nord-unreal/Quebec.uproject" -noP4 -platform=Linux \
  -clientconfig=Development -build -cook -map=/Game/Maps/LaFontaine -stage -pak -archive \
  -archivedirectory="$PWD/games/nord-unreal/Builds/Browser" -utf8output -unattended \
  -AdditionalCookerOptions=-NullRHI -NoUBA
```

Clone only when the target does not already exist. Preserve an existing checkout or its modifications; do not reset it blindly.

```bash
git clone --branch UE5.8 --single-branch https://github.com/EpicGamesExt/PixelStreamingInfrastructure.git \
  games/nord-unreal/Saved/PixelStreamingInfrastructure
git -C games/nord-unreal/Saved/PixelStreamingInfrastructure checkout --detach \
  e5e243ed038313d3dad4e3fb9087d4393a5df192
```

From `games/nord-unreal/Saved/PixelStreamingInfrastructure`, install only the server's three workspaces. This avoids the unrelated SFU/native-media installation. The pinned checkout includes generated protocol sources, so the server needs only the Common CJS build, then Signalling CJS, then Wilbur.

```bash
npm ci --ignore-scripts --workspace Common --workspace Signalling --workspace SignallingWebServer --include-workspace-root
npm run build:cjs --workspace Common
npm run build:cjs --workspace Signalling
npm run build --workspace SignallingWebServer
```

The helper checks the exact infrastructure revision and refuses tracked modifications. It never installs dependencies, rebuilds Unreal, modifies a tunnel, or touches Vercel.

## Current temporary user services

The configured demo uses `nord-browser-demo.service` for the lifecycle and `nord-browser-funnel.service` for public signalling; both were active at the 22:30 UTC check. They are transient `systemd --user` units with **Restart=no**: no static unit files, `enable`, automatic restart or reboot persistence. They still require the user session and PC to remain available. Start them only when stopped, after checking that these names are absent, no other rendered Unreal job owns the GPU, the memory preflight passes, and `tailscale serve status --json` reports `{}`. Preserve any unrelated unit or Serve configuration.

Run from the repository root when the demo is stopped:

```bash
python3 games/nord-unreal/Scripts/browser_streaming.py check
systemd-run --user --unit=nord-browser-demo --collect \
  --property=KillMode=mixed --property=TimeoutStopSec=40 --setenv=PATH \
  --working-directory=/home/von/Work/rouge-warden-codex-nord-unreal/games/nord-unreal \
  /usr/bin/python3 Scripts/browser_streaming.py run
systemd-run --user --unit=nord-browser-funnel --collect \
  /usr/bin/tailscale funnel --yes http://127.0.0.1:9010
```

Inspect only these units and their logs:

```bash
systemctl --user status nord-browser-demo.service nord-browser-funnel.service
journalctl --user -u nord-browser-demo.service -u nord-browser-funnel.service -n 80 --no-pager
```

Stop this demo with:

```bash
systemctl --user stop nord-browser-demo.service nord-browser-funnel.service
tailscale serve status --json
```

The helper receives SIGTERM and cleans up its owned signalling/game process groups. `KillMode=mixed` bounds shutdown to this unit's processes if cleanup exceeds 40 seconds. Stopping the separate Funnel unit removes this temporary exposure; inspect Serve state afterwards and preserve unrelated services. Do not start the manual foreground option at the same time.

## Manual foreground option

From the repository root:

```bash
python3 games/nord-unreal/Scripts/browser_streaming.py check
python3 games/nord-unreal/Scripts/browser_streaming.py run
```

The foreground helper refuses other rendered Unreal processes, less than **12,000 MiB free VRAM on NVIDIA adapter 0**, occupied TCP ports **8888/8889/9010** or UDP **7791**, and a second helper instance. It starts signalling with `--no_config`, which prevents the upstream default configuration from accidentally enabling an unrelated static web server. Player signalling is `ws://127.0.0.1:9010`; streamer signalling stays on **8888**. It waits for the host listen socket and the friend's native welcome before reporting their connection. That startup message alone does not verify browser media/input; the [live regression](./README.md) checks the real streams separately.

Press **Ctrl-C** in that terminal to stop only the three process groups created by this helper. SIGTERM also performs cleanup. Startup failure stops already launched children. It does not kill unrelated jobs or reset any service configuration. Timestamped logs, STUN configuration and `lifecycle.json` live under `games/nord-unreal/Saved/BrowserStreaming/`. A forcibly killed launcher or a PC crash cannot run cleanup; inspect its recorded processes and command lines before stopping them manually. This manual option depends on the terminal staying open; the temporary user services above avoid that dependency without adding automatic recovery.

For local player testing, build `Browser` with `NORD_SIGNALLING_URL=ws://127.0.0.1:9010` and serve it on loopback as described in its README. Do not deploy that local endpoint.

## Optional temporary public signalling

The separate Vercel player needs the public **WSS player endpoint**, never the streamer port or native Unreal server port. The existing temporary option is Tailscale Funnel. Inspect current Serve/Funnel state before changing anything:

```bash
tailscale serve status --json
```

Proceed with a new foreground Funnel only when that command reports **`{}`**. If services are already configured, preserve them and choose a separate reviewed endpoint instead. Do not run `tailscale serve reset` or `tailscale funnel reset`.

```bash
tailscale funnel 9010
```

Keep that terminal open for the manual option; the current transient Funnel unit above runs the same exposure independently of a tool terminal. Use the HTTPS hostname printed by Tailscale as a `wss://` URL in `NORD_SIGNALLING_URL` when building the browser, then upload the configured static output. The current Vercel project was deployed from prebuilt files without Git linkage; changing a Vercel setting or committing source does not rebuild that upload automatically. For a future Git-connected build, set the variable in the intended Vercel environment before redeploying. The endpoint is deployment configuration, not hardcoded player source. Stop only the manual foreground Funnel with **Ctrl-C**, or stop the two owned units as documented above. Then inspect Serve status to confirm unrelated state remains unchanged. The lifecycle helper deliberately does not create or remove tunnels.

Funnel carries signalling traffic; it does **not** relay the WebRTC video/audio. The initial ICE configuration uses public STUN without TURN. External NAT/firewall combinations may therefore fail even when WSS and Vercel both work. A successful local browser test does not prove an internet friend can play. If external ICE fails, a reachable TURN relay is the missing infrastructure; this rollout does not buy hosting, open router/firewall ports, or claim that signalling success is gameplay success.

The pinned signalling dependency audit retains eight runtime findings. The active WebSocket-only launch paths were reviewed and the default static server is disabled, but those findings are not resolved. Upstream control messages still let a subscribed input owner request resolution changes, affecting GPU/resource use even with native console commands disabled. This temporary unauthenticated demo is not a production security acceptance. Audit remediation and any move to permanent hosting require a separate review of the pinned infrastructure and deployed exposure.

## Acceptance checks

The [verification record](../Verification/BrowserStreaming.md) distinguishes completed checks from remaining acceptance. The fresh normal public regression passed both streams, decoded video/audio packets, trusted browser-input actions, Escape release, occupied-slot refusal and reconnect. [Isolated browser-package QA](../Verification/BrowserGpuRecovery.md) completed Mission 1 through real input, restarted and loaded its save on both peers; held-input close and crew switching also passed. A person must still check audible playback, sustained driving feel and input latency, full Mission 2 browser progression, and visual/facial quality. Repeat from a genuinely external network to establish public media reachability. The 30 FPS cap is not sustained performance acceptance.
