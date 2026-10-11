# Temporary PC hosting

Vercel hosts the static browser player. The existing Linux GPU PC can run two full Unreal processes and Epic's signalling server. `NordHost` listens for normal Unreal multiplayer; `NordFriend1` joins it. Sharing one stream does not create another character. Each stream accepts one browser subscriber. This is a public two-slot demo without accounts, authentication, reservations or automatic recovery; anyone with the public endpoint can try to occupy a slot.

The public player is [nord-montreal.vercel.app](https://nord-montreal.vercel.app/). Its production deployment `dpl_5nXnqkFxfDRz71iG7BQJBL44RbKt` is READY and uses `wss://reports-rec-encouraged-taught.trycloudflare.com` through a Cloudflare Quick Tunnel to the unchanged `127.0.0.1:9010` server. Ordinary Chrome passed the seven-check production regression without a DNS override at 00:58:47–00:59:09 UTC on October 11; the preview also passed seven checks at 00:57:59–00:58:19 UTC. The original `wss://omarchy.tail7b97f6.ts.net` Tailscale Funnel remains running and preserved, but is no longer the intended browser endpoint. These are temporary PC-hosted endpoints, not permanent hosting. See [connection diagnosis](../Verification/BrowserConnection.md) and [recorded streaming checks](../Verification/BrowserStreaming.md).

**Host PC status:** the demo, original Funnel and Quick Tunnel services are running. The earlier 22:29 UTC seven-check public-player regression used a scoped DNS override; ordinary Chrome later failed on the Funnel address with `ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS` at 00:50 UTC on October 11. The replacement Quick Tunnel passed seven local checks at 00:56 UTC and seven ordinary Chrome checks through the production alias at 00:58:47–00:59:09 UTC. The prior normal lifecycle, signalling and two native children remained alive through 12 readings ending 22:30:15 UTC, with at least 2,431 MiB free VRAM. An earlier restart failed with Vulkan out of memory under competing GPU use; its clean shutdown and later recovery are recorded in [BrowserGpuRecovery.md](../Verification/BrowserGpuRecovery.md). The unchanged helper requires **at least 12,000 MiB free VRAM** on NVIDIA adapter 0 before launching two players. This check does not reserve memory or prevent later competing GPU use. The helper does not close other applications.

The PC must remain powered on, connected and running the lifecycle and intended Quick Tunnel when the demo is available. Transient user services keep them alive independently of a tool terminal, but provide no reboot persistence or permanent uptime. Two 1280×720 output streams use a **High (2)** base, with global illumination/reflections/shadows at **1**, virtual shadow maps disabled, **75% internal screen percentage** and a **30 FPS render/WebRTC cap**. A cap is not a measured guarantee; see the bounded [performance record](../Verification/BrowserStreaming.md). Existing map/assets and gameplay are retained, with held-input cleanup on browser disconnect. The temporary host uses VP8 software encoding and synchronous MediaIO capture because this PC's H264 path stalled during testing; retest hardware encoding after engine/driver updates. Each stream has an 8 Mbps start rate and 12 Mbps WebRTC video ceiling. `-NoDebugExecBindings` disables Development debug key bindings, and Pixel Streaming `ConsoleCommand` payloads are disabled. The current command uses corrected `-PixelStreamingKeyFilter=Tilde`; native logs accepted it, and a bounded rendered Backquote test showed no console. Earlier live runs used the unknown `PixelStreamingInputKeyFilter` argument, so their Tilde filtering was ineffective. Only the host can write campaign progress. The browser package's host save directory remains intact across restarts; the guest disables campaign saving and uses `Saved_BrowserGuest` for its other files. The previous `Builds/Linux` package and its saves are separate and untouched. An isolated browser-package Mission 1 save and restart/reload passed, with production/guest saves unchanged; full Mission 2 progression/reload remains unverified.

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

The demo uses transient `systemd --user` units: `nord-browser-demo.service` runs the existing lifecycle, `nord-browser-public.service` runs the intended Cloudflare Quick Tunnel, and the preserved `nord-browser-funnel.service` runs the original Tailscale Funnel. The demo and Funnel have **Restart=no**. The public unit has **Restart=on-failure** and **RestartSec=5**; if it restarts, its Quick Tunnel hostname can change and the browser must be rebuilt and redeployed with the new WSS address. There are no static unit files, `enable`, reboot persistence, native quality/guard changes or new GPU host. The user session and PC must remain available. Start only missing units: check other rendered Unreal jobs and the memory preflight before the demo; require `tailscale serve status --json` to report `{}` before starting a new Funnel. Preserve unrelated units and Serve configuration.

Run from the repository root when the relevant unit is stopped. The current public unit uses the existing `cloudflared` **2026.9.3** binary at the path below:

```bash
python3 games/nord-unreal/Scripts/browser_streaming.py check
systemd-run --user --unit=nord-browser-demo --collect \
  --property=KillMode=mixed --property=TimeoutStopSec=40 --setenv=PATH \
  --working-directory=/home/von/Work/rouge-warden-codex-nord-unreal/games/nord-unreal \
  /usr/bin/python3 Scripts/browser_streaming.py run
systemd-run --user --unit=nord-browser-public --collect \
  --property=Restart=on-failure --property=RestartSec=5 \
  /home/von/.npm/_npx/8a26fc3a61fe4212/node_modules/cloudflared/bin/cloudflared \
  tunnel --no-autoupdate --url http://127.0.0.1:9010
```

The original Funnel is kept only for historical access/QA. Start it separately only after its own status check when it is needed:

```bash
systemd-run --user --unit=nord-browser-funnel --collect \
  /usr/bin/tailscale funnel --yes http://127.0.0.1:9010
```

Inspect only these units and their logs:

```bash
systemctl --user status nord-browser-demo.service nord-browser-public.service nord-browser-funnel.service
journalctl --user -u nord-browser-demo.service -u nord-browser-public.service -u nord-browser-funnel.service -n 80 --no-pager
```

Stop this demo with:

```bash
systemctl --user stop nord-browser-demo.service nord-browser-public.service nord-browser-funnel.service
tailscale serve status --json
```

The helper receives SIGTERM and cleans up its owned signalling/game process groups. `KillMode=mixed` bounds shutdown to this unit's processes if cleanup exceeds 40 seconds. Stopping the public unit ends the Quick Tunnel; starting it again creates a new hostname requiring a browser rebuild/redeploy. Stopping the separate Funnel unit removes that legacy exposure; inspect Serve state afterwards and preserve unrelated services. Do not start the manual foreground option at the same time.

## Manual foreground option

From the repository root:

```bash
python3 games/nord-unreal/Scripts/browser_streaming.py check
python3 games/nord-unreal/Scripts/browser_streaming.py run
```

The foreground helper refuses other rendered Unreal processes, less than **12,000 MiB free VRAM on NVIDIA adapter 0**, occupied TCP ports **8888/8889/9010** or UDP **7791**, and a second helper instance. It starts signalling with `--no_config`, which prevents the upstream default configuration from accidentally enabling an unrelated static web server. Player signalling is `ws://127.0.0.1:9010`; streamer signalling stays on **8888**. It waits for the host listen socket and the friend's native welcome before reporting their connection. That startup message alone does not verify browser media/input; the [live regression](./README.md) checks the real streams separately.

Press **Ctrl-C** in that terminal to stop only the three process groups created by this helper. SIGTERM also performs cleanup. Startup failure stops already launched children. It does not kill unrelated jobs or reset any service configuration. Timestamped logs, STUN configuration and `lifecycle.json` live under `games/nord-unreal/Saved/BrowserStreaming/`. A forcibly killed launcher or a PC crash cannot run cleanup; inspect its recorded processes and command lines before stopping them manually. This manual option depends on the terminal staying open; the temporary user services above avoid that dependency without adding automatic recovery.

For local player testing, build `Browser` with `NORD_SIGNALLING_URL=ws://127.0.0.1:9010` and serve it on loopback as described in its README. Do not deploy that local endpoint.

## Temporary public signalling

The separate Vercel player needs the public **WSS player endpoint**, never the streamer port or native Unreal server port. The current production route is the `nord-browser-public.service` Cloudflare Quick Tunnel: `wss://reports-rec-encouraged-taught.trycloudflare.com` forwards to `http://127.0.0.1:9010`. It requires no change to the native streamer, signalling process, rendering settings or GPU guard. This is a Quick Tunnel, so **its hostname changes when the process is recreated**; even the public unit's on-failure restart requires checking the newly printed hostname, rebuilding `Browser/dist` with that `NORD_SIGNALLING_URL`, and redeploying the static player. The current production build passed ordinary Chrome on this PC, but has no permanent uptime or new GPU hosting.

The original Tailscale Funnel remains running and preserved, but is no longer the intended browser route. Ordinary host-PC Chrome resolved that hostname through MagicDNS to a private tailnet address and blocked the Vercel connection with a local-network-access error. Earlier seven-check runs using `NORD_FUNNEL_PUBLIC_IP` deliberately bypassed that DNS route; the live runner now labels such reports with its `networkMode`. The replacement tunnel passed seven local checks at 00:56 UTC and ordinary production checks at 00:58:47–00:59:09 UTC on October 11. Same-PC success still does not prove an off-LAN friend's media path. See [the connection record](../Verification/BrowserConnection.md).

For the optional legacy Funnel, inspect current Serve state before changing anything:

```bash
tailscale serve status --json
```

Proceed with a new foreground Funnel only when that command reports **`{}`**. If services are already configured, preserve them and choose a separate reviewed endpoint instead. Do not run `tailscale serve reset` or `tailscale funnel reset`.

```bash
tailscale funnel 9010
```

Keep that terminal open for the manual Funnel; the preserved transient Funnel unit runs the same exposure independently of a tool terminal. Use the hostname printed by whichever reviewed tunnel is intended as a `wss://` URL in `NORD_SIGNALLING_URL`, then rebuild and upload the configured static output. The Vercel project uses prebuilt files without Git linkage; changing a Vercel setting or committing source does not rebuild that upload automatically. For a future Git-connected build, set the variable in the intended Vercel environment before redeploying. The endpoint is deployment configuration, not hardcoded player source. Stop only a manual foreground Funnel with **Ctrl-C**, or stop the relevant owned units as documented above. Then inspect Serve status to confirm unrelated state remains unchanged. The lifecycle helper deliberately does not create or remove tunnels.

Both tunnels carry signalling traffic; neither relays the WebRTC video/audio. The initial ICE configuration uses public STUN without TURN. External NAT/firewall combinations may therefore fail even when WSS and Vercel both work. A successful local browser test does not prove an internet friend can play. If external ICE fails, a reachable TURN relay is the missing infrastructure; this rollout does not buy hosting, open router/firewall ports, or claim that signalling success is gameplay success.

The pinned signalling dependency audit retains eight runtime findings. The active WebSocket-only launch paths were reviewed and the default static server is disabled, but those findings are not resolved. Upstream control messages still let a subscribed input owner request resolution changes, affecting GPU/resource use even with native console commands disabled. This temporary unauthenticated demo is not a production security acceptance. Audit remediation and any move to permanent hosting require a separate review of the pinned infrastructure and deployed exposure.

## Acceptance checks

The [streaming record](../Verification/BrowserStreaming.md) and [connection record](../Verification/BrowserConnection.md) distinguish completed checks from remaining acceptance. Earlier Funnel regressions passed both streams, decoded video/audio packets, trusted browser input, Escape release, occupied-slot refusal and reconnect **with a scoped DNS override**. The replacement Quick Tunnel passed the same seven checks locally, on its public preview, and on the production alias through ordinary Chrome without an override. [Isolated browser-package QA](../Verification/BrowserGpuRecovery.md) completed Mission 1 through real input, restarted and loaded its save on both peers; held-input close and crew switching also passed. A person must still check audible playback, sustained driving feel and input latency, full Mission 2 browser progression, and visual/facial quality. Repeat from a genuinely external network to establish public media reachability. The 30 FPS cap is not sustained performance acceptance.
