# Temporary PC hosting

Vercel hosts the static browser player. The existing Linux GPU PC can run two full Unreal processes and Epic's signalling server. `NordHost` listens for normal Unreal multiplayer; `NordFriend1` joins it. Sharing one stream does not create another character. Each stream accepts one browser subscriber. This is a public two-slot demo without player accounts, slot reservations or automatic game recovery; anyone with the public endpoint can try to occupy a slot. The separate TURN relay uses local credentials described below.

The public player is [nord-montreal.vercel.app](https://nord-montreal.vercel.app/). Production deployment `dpl_FYQAQ4mbiKNSKeQyMQ77hLTZPgyB` is READY, built from merged commit `d45e2e47` ([PR #338](https://github.com/vdimarco/rouge-warden/pull/338)). It uses `wss://officials-soundtrack-engines-institute.trycloudflare.com` through the restored Quick Tunnel to `127.0.0.1:9010`. All twelve served static files match the tested local build. The original signalling Funnel and separate TURN/TLS Funnel are restored. These temporary services have no reboot persistence; a reboot or Quick Tunnel recreation changes the hostname and requires a player endpoint update and deployment. The project builds from Git; see [Vercel project and Git builds](#vercel-project-and-git-builds).

**Host PC status — 2026-10-13:** the existing optimized native package and relay were restored after a PC reboot, with idle-world suspension and CPUWeight=400. Both simultaneous local camera-sweep streams sustained about 30 decoded FPS for 60 seconds with no dropped frames or freezes. The production alias passed all seven real-media/input/reconnect checks. The player retains drag-anywhere and gyro controls and clears the landscape action row from the objective. Stream resolution, native quality, codec, scheduling, maps and launch guard are unchanged. Physical-phone/carrier, audible playback and driving acceptance remain open. See [the optimization and delivery record](../Verification/BrowserOptimization.md); earlier hosting/connection checks remain in [BrowserConnection.md](../Verification/BrowserConnection.md) and [BrowserStreaming.md](../Verification/BrowserStreaming.md).

The browser demo defaults to a frozen 15:00 clock (`-NordHour=15 -NordFreezeTime`) with native weather still active. Explicit `NORD_SKY_ARGS` overrides remain supported. The PC must remain powered on, connected and running the lifecycle, intended Quick Tunnel and TURN relay when the demo is available. Transient user services keep them alive independently of a tool terminal, but provide no reboot persistence or permanent uptime. Desktop streams use 1280×720; phones negotiate 800×450 or an equivalent tall frame, with a 640×360 fallback on receiver pressure. Both players use a **High (2)** base, with global illumination/reflections/shadows at **1**, virtual shadow maps disabled, **75% internal screen percentage** and a **30 FPS render/WebRTC cap**. A cap is not a measured guarantee; see the bounded [performance record](../Verification/BrowserStreaming.md). Existing map/assets and gameplay are retained, with held-input cleanup on browser disconnect. The temporary host uses VP8 software encoding and synchronous MediaIO capture because this PC's H264 path stalled during testing; retest hardware encoding after engine/driver updates. Each stream starts at 2 Mbps. Desktop keeps a 12 Mbps ceiling; the mobile player requests 1.5 Mbps, falling back to 1 Mbps when received FPS/buffer delay or freezes indicate pressure. `-NoDebugExecBindings` disables Development debug key bindings, and Pixel Streaming `ConsoleCommand` payloads are disabled. The current command uses corrected `-PixelStreamingKeyFilter=Tilde`; native logs accepted it, and a bounded rendered Backquote test showed no console. Earlier live runs used the unknown `PixelStreamingInputKeyFilter` argument, so their Tilde filtering was ineffective. Only the host can write campaign progress. The browser package's host save directory remains intact across restarts; the guest disables campaign saving and uses `Saved_BrowserGuest` for its other files. The previous `Builds/Linux` package and its saves are separate and untouched. An isolated browser-package Mission 1 save and restart/reload passed, with production/guest saves unchanged; full Mission 2 progression/reload remains unverified.

## Prepare the existing package and pinned signalling server

Run from the repository root. The verified PC toolchain is **Node.js 26.7.0 / npm 11.19.0**; use those versions to reproduce the signalling preparation below. Git, `nvidia-smi` and the existing UE5.8 installation are also required. Check for active Unreal rendering before any rebuild; do not overlap another task's GPU job. Launch also needs at least 12,000 MiB free on NVIDIA adapter 0. This build-specific preflight threshold does not reserve VRAM or prevent another application from allocating memory after startup.

```bash
python3 games/nord-unreal/Scripts/browser_streaming.py self-check
ps -eo pid,comm,args | rg 'UnrealEditor|/Binaries/Linux/Quebec'
```

`Quebec.uproject` already enables `PixelStreaming2`. The launcher passes `-NordTouchControls` so the native HUD reserves the lower corners for the movement stick and two-row action grid. The streaming package belongs at `games/nord-unreal/Builds/Browser/Linux/Quebec.sh`. When it needs rebuilding, use the existing UE installation:

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

The demo uses transient `systemd --user` units: `nord-browser-demo.service` runs the existing lifecycle, `nord-browser-public.service` runs the intended Cloudflare Quick Tunnel, `nord-browser-funnel.service` preserves the original Tailscale Funnel on 443, and `nord-browser-turn-funnel.service` exposes TURN/TLS on 8443. The named Docker container `nord-browser-turn` runs the co-located Coturn process. The demo and original Funnel have **Restart=no**. The public unit has **Restart=on-failure** and **RestartSec=5**; if it restarts, its Quick Tunnel hostname can change and the browser must be rebuilt and redeployed with the new WSS address. These transient units have no static unit files, `enable` or reboot persistence. The user session and PC must remain available. Start only missing units: check other rendered Unreal jobs and the memory preflight before the demo; inspect Tailscale Serve state before adding/removing the owned 8443 mapping and preserve the unrelated 443 mapping. A new original Funnel on 443 requires its own Serve status check. No native quality, GPU guard or paid-hosting change is involved.

Run from the repository root when the relevant unit is stopped. The current public unit uses the existing `cloudflared` **2026.9.3** binary at the path below:

```bash
python3 games/nord-unreal/Scripts/browser_streaming.py check
systemd-run --user --unit=nord-browser-demo --collect \
  --property=KillMode=mixed --property=TimeoutStopSec=40 --property=CPUWeight=400 --setenv=PATH \
  --setenv=NORD_ICE_CONFIG=/home/von/Work/rouge-warden-codex-nord-unreal/games/nord-unreal/Saved/BrowserStreaming/relay/ice.json \
  --working-directory=/home/von/Work/rouge-warden-codex-nord-unreal/games/nord-unreal \
  /usr/bin/python3 Scripts/browser_streaming.py run
systemd-run --user --unit=nord-browser-public --collect \
  --property=Restart=on-failure --property=RestartSec=5 \
  /home/von/.npm/_npx/8a26fc3a61fe4212/node_modules/cloudflared/bin/cloudflared \
  tunnel --no-autoupdate --url http://127.0.0.1:9010
```

The TURN unit forwards TLS-terminated TCP 8443 to the Coturn container's loopback TCP 3478. Start it only when its named container and private configuration are ready, after inspecting Serve state; preserve the existing 443 mapping. The original Funnel is kept only for historical access/QA. Start either missing unit separately when needed:

```bash
systemd-run --user --unit=nord-browser-turn-funnel --collect \
  /usr/bin/tailscale funnel --yes --tls-terminated-tcp=8443 tcp://127.0.0.1:3478
systemd-run --user --unit=nord-browser-funnel --collect \
  /usr/bin/tailscale funnel --yes http://127.0.0.1:9010
```

Inspect only these units and their logs:

```bash
systemctl --user status nord-browser-demo.service nord-browser-public.service nord-browser-funnel.service nord-browser-turn-funnel.service
journalctl --user -u nord-browser-demo.service -u nord-browser-public.service -u nord-browser-funnel.service -u nord-browser-turn-funnel.service -n 80 --no-pager
docker ps --filter name=^/nord-browser-turn$
```

Stop this demo with:

```bash
systemctl --user stop nord-browser-demo.service nord-browser-public.service nord-browser-funnel.service nord-browser-turn-funnel.service
docker stop nord-browser-turn
docker rm nord-browser-turn
tailscale serve status --json
```

The helper receives SIGTERM and cleans up its owned signalling/game process groups. `KillMode=mixed` bounds shutdown to this unit's processes if cleanup exceeds 40 seconds. Stopping the public unit ends the Quick Tunnel; starting it again creates a new hostname requiring a browser rebuild/redeploy. Stop or remove only the named TURN container and these owned units; inspect Serve state afterwards and preserve unrelated services. Do not start the manual foreground option at the same time.

## Temporary TURN relay

The co-located relay uses the official Coturn **4.18.0-r0** image pinned to `sha256:bbefd3e1fdfdc0d58770fe01b581fd8b00d9f3a5580d00acb77cf719a6bc78e3`. Its owned `nord-browser-turn` container runs as user 1000 with a read-only filesystem, all capabilities dropped except `NET_BIND_SERVICE`, a 16 MiB `/tmp` tmpfs and host networking. Coturn accepts TCP only on loopback `127.0.0.1:3478`. The separate owned Tailscale unit forwards public TLS-terminated TCP **8443** to that port without replacing the preserved signalling Funnel on 443. A bounded public probe to `199.38.181.54:8443` verified TLS 1.3, the certificate and STUN Binding; the isolated forced-relay browser test received real **1280×720 VP8 video and a live data channel** over a selected local relay candidate. These checks do not establish physical 5G or off-LAN play.

The relay UDP range is **49160–49179** on the host's `192.168.86.39` LAN address. Coturn permits only `192.168.86.39` as a peer and denies other IPv4/IPv6 peer addresses. Its user quota is eight, with configured **2 MB/s per-session and 8 MB/s total** bandwidth caps. If DHCP changes this LAN IP, reconfigure the relay and ICE settings and repeat the TLS/forced-relay and public-browser checks before claiming availability. No router changes, new paid host or GPU quality change are involved.

The private Coturn and browser ICE files must already exist in ignored `Saved/BrowserStreaming/relay/{turnserver.conf,ice.json}`. Keep the directory mode **0700** and each file **0600**. They contain credentials and must never be copied into Git, Vercel, logs or these instructions. A subscribed browser necessarily receives its temporary TURN username/password through the signalling ICE configuration; the relay's peer restriction, quota and bandwidth caps limit that credential's use, but this remains a temporary public demo. Do not run the lifecycle command with a missing or unreadable config: `NORD_ICE_CONFIG` points to the existing private `ice.json`, and the helper validates it before launching. If that variable is absent, the helper falls back to the earlier **STUN-only** configuration. The [mobile connection record](../Verification/BrowserMobileConnection.md) separates forced-relay verification from pending real phone and 5G checks.

## Manual foreground option

From the repository root:

```bash
python3 games/nord-unreal/Scripts/browser_streaming.py check
python3 games/nord-unreal/Scripts/browser_streaming.py run
```

The host runs the live day, night and weather. For a browser QA run whose frames must be repeatable (`mobile.test.mjs`, `live.test.mjs`), set `NORD_SKY_ARGS=-NordFixedSky` (the authored afternoon) or `NORD_SKY_ARGS="-NordHour=15 -NordWeather=Clear -NordFreezeTime -NordFreezeWeather"` before `run`. The helper passes these flags to the host only, because the friend shows the host's replicated sky. It accepts only the `-NordFixedSky`, `-NordDynamicSky`, `-NordFreezeTime`, `-NordFreezeWeather`, `-NordHour=`, `-NordDayMinutes=`, `-NordSkySeed=` and `-NordWeather=` flags and refuses to launch with any other value. Leave it unset for the public demo.

The foreground helper refuses other rendered Unreal processes, less than **12,000 MiB free VRAM on NVIDIA adapter 0**, occupied TCP ports **8888/8889/9010** or UDP **7791**, and a second helper instance. Set `NORD_ICE_CONFIG` to the existing private ICE file before a manual run if relay support is intended; otherwise the helper uses STUN only. It starts signalling with `--no_config`, which prevents the upstream default configuration from accidentally enabling an unrelated static web server. Player signalling is `ws://127.0.0.1:9010`; streamer signalling stays on **8888**. It waits for the host listen socket and the friend's native welcome before reporting their connection. That startup message alone does not verify browser media/input; the [live regression](./README.md) checks the real streams separately.

Press **Ctrl-C** in that terminal to stop only the three process groups created by this helper. SIGTERM also performs cleanup. Startup failure stops already launched children. It does not kill unrelated jobs or reset any service configuration. Timestamped logs, generated ICE configuration and `lifecycle.json` live under `games/nord-unreal/Saved/BrowserStreaming/`; the private source configuration remains under its ignored `relay/` directory. A forcibly killed launcher or a PC crash cannot run cleanup; inspect its recorded processes and command lines before stopping them manually. This manual option depends on the terminal staying open; the temporary user services above avoid that dependency without adding automatic game recovery.

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

Keep that terminal open for the manual Funnel; the preserved transient Funnel unit runs the same exposure independently of a tool terminal. Use the hostname printed by whichever reviewed tunnel is intended as a `wss://` URL in `NORD_SIGNALLING_URL`, then update that variable in the Vercel project and redeploy, as described in [Vercel project and Git builds](#vercel-project-and-git-builds). A change to a Vercel variable does not rebuild an existing deployment. The endpoint is deployment configuration, not hardcoded player source. Stop only a manual foreground Funnel with **Ctrl-C**, or stop the relevant owned units as documented above. Then inspect Serve status to confirm unrelated state remains unchanged. The lifecycle helper deliberately does not create or remove tunnels.

The Cloudflare Quick Tunnel and preserved Tailscale Funnel carry signalling; the separate Tailscale TCP 8443 mapping exposes the optional TURN/TLS relay for WebRTC media. The original public regressions used STUN-only ICE. The new forced-relay test established a local browser media path, but external NAT/firewall behavior and a physical phone on 5G still need direct checks. WSS or a local media connection alone does not establish internet playability. This rollout does not buy hosting or change router/firewall ports.

The pinned signalling dependency audit retains eight runtime findings. The active WebSocket-only launch paths were reviewed and the default static server is disabled, but those findings are not resolved. Upstream control messages still let a subscribed input owner request resolution changes, affecting GPU/resource use even with native console commands disabled. This temporary unauthenticated demo is not a production security acceptance. Audit remediation and any move to permanent hosting require a separate review of the pinned infrastructure and deployed exposure.

## Vercel project and Git builds

The player is the `nord-montreal` project in the `vdimarcos-projects` team. The project settings are:

| Setting | Value |
| --- | --- |
| Git repository | `vdimarco/rouge-warden`, production branch `main` |
| Root directory | `games/nord-unreal/Browser` |
| Build command and output | From `vercel.json`: `npm run build` into `dist` |
| Ignored build step | `ignoreCommand` in `vercel.json`: `bash vercel-ignore.sh` |
| Variables (production and preview) | `NORD_SIGNALLING_URL`, `NORD_PORTRAIT_STREAM=0` |

Vercel runs [`vercel-ignore.sh`](vercel-ignore.sh) in the root directory. It compares the new commit with `VERCEL_GIT_PREVIOUS_SHA`, the last successful deployment on the same branch, so every commit in a push counts. A branch's first build compares with the parent commit. The script ignores files that never reach `dist/`: `*.test.mjs`, `*.md`, `stream-sample.mjs`, `.env.example` and `.gitignore`. If any other file in this folder changed, Vercel builds; if not, the deployment shows as **CANCELED**. Vercel's clone is shallow, so when the base commit is missing the script fetches that one commit. If the fetch or `git diff` fails, the script builds. The `ignoreCommand` in `vercel.json` takes priority over the Ignored Build Step in the project settings, which still holds the older `git diff --quiet HEAD^ HEAD -- .` rule.

A push to `main` makes a production deployment. A push to any other branch makes a preview at `nord-montreal-git-<branch>-vdimarcos-projects.vercel.app`. The build reads `NORD_SIGNALLING_URL` from the project, so a new tunnel hostname needs only a variable change and a redeploy.

**Public alias:** the project has automatic domain assignment turned off (`autoAssignCustomDomains: false`). A new production deployment moves `nord-montreal-vdimarcos-projects.vercel.app`, but it does not move `nord-montreal.vercel.app`. After a production deployment, point the public alias at it:

```bash
npx vercel alias set <deployment-url> nord-montreal.vercel.app --scope vdimarcos-projects
```

To deploy by hand from a checkout of `main`, run this in `games/nord-unreal/Browser` with `VERCEL_TOKEN` set. Vercel builds the files on its servers with the project variables:

```bash
npx vercel link --yes --project nord-montreal --scope vdimarcos-projects --token "$VERCEL_TOKEN"
rm -f .env.local
npx vercel deploy --prod --yes --scope vdimarcos-projects --token "$VERCEL_TOKEN"
```

`vercel link` writes `.env.local` with a short-term OIDC token. Remove it before you deploy, and do not commit `.vercel/` or `.env.local`.

On October 13 at 03:32 UTC a manual deploy of `main` (`676c605a`) made `dpl_3EyZk8DnzTiTw7Vwxu85TzRirLjn`, and the Git connection followed. The first Git production build was `dpl_7TZJDDGuoHcwUVKJbLysQyELN7dK` from `main` `54a86fe8` at 15:12 UTC. Pushes that did not change this folder show as CANCELED, as intended. At 21:50 UTC on October 13 the public alias pointed to `dpl_83UYqQgykYwTYtzvBEThzKm6FCMk`, a manual production deploy of `main` `79b56ad2`. The later Git build `dpl_FwjXP6W2gtNWAWMoEfKPaEa5zxrg` from `ed452c1a` did not move the alias.

## Acceptance checks

The current host enables idle-slot rendering suspension by default: it warms for 60 seconds, stops drawing an unwatched world after 30 seconds without a viewer, and wakes on a connection. Simulation and the 30 FPS cap remain active on both peers. `NORD_STREAM_FLAGS=''` disables suspension for a comparison; `idle` and optional `windowed` are the accepted space-separated flags. `NORD_STREAM_BITRATE=start,min,max` accepts integer bitrates with `100000 <= min <= start <= max <= 12000000`; production uses `2000000,100000,12000000`; the player reapplies its desktop/mobile ceiling after host defaults arrive. `NORD_STREAM_SCHEDULING=0|1` selects the existing capture scheduler; production retains `0`. Effective values are recorded in `lifecycle.json`, and `-NordStreamFps` logs native frame counts every five seconds. The managed service recipe sets `CPUWeight=400` for preference during CPU contention; this does not reserve cores or GPU capacity. See [the performance and resource record](../Verification/BrowserOptimization.md). The existing transient service and GPU-memory guard are retained.

The [streaming record](../Verification/BrowserStreaming.md), [connection record](../Verification/BrowserConnection.md) and [mobile connection record](../Verification/BrowserMobileConnection.md) distinguish completed checks from remaining acceptance. Earlier Funnel regressions passed both streams, decoded video/audio packets, trusted browser input, Escape release, occupied-slot refusal and reconnect **with a scoped DNS override**. The replacement Quick Tunnel passed the same seven checks locally, on its public preview, and on the production alias through ordinary Chrome without an override; those earlier checks preceded the TURN configuration. After activation, the ordinary public-player regression and a two-player forced-relay regression each passed all seven checks, and Android Chromium emulation decoded real video using a TLS relay candidate. [Isolated browser-package QA](../Verification/BrowserGpuRecovery.md) completed Mission 1 through real input, restarted and loaded its save on both peers; held-input close and crew switching also passed. A person must still check physical-phone and 5G media access, audible playback, sustained driving feel and input latency, full Mission 2 browser progression, and visual/facial quality. Repeat from a genuinely external network to establish public media reachability. The 30 FPS cap is not sustained performance acceptance.
