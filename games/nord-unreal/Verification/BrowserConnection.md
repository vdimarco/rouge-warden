# Browser connection repair — 2026-10-11 UTC

This records the initial signalling correction at00:59UTC. The later [mobile media fallback](BrowserMobileConnection.md) supersedes its STUN-only runtime limitation.

The deployed player now connects in ordinary Chromium on the hosting PC. The production alias [nord-montreal.vercel.app](https://nord-montreal.vercel.app/) passed all seven real-stream checks at **00:58:47–00:59:09 UTC**, without a DNS override or browser-security changes. Both native game processes stayed running throughout. Full structured evidence is in [BrowserConnection.json](BrowserConnection.json).

## Cause and correction

The failing normal-browser run at 00:50 UTC reported `net::ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`. Local Tailscale DNS resolved the old WSS hostname to `100.118.148.62`; the socket failed before a WebRTC peer existed. The earlier passing QA runs mapped that hostname to a public Funnel IP in their isolated Chromium processes. They demonstrated that route's media behavior, but did not establish ordinary-browser access.

Only the configured public player-signalling endpoint changed: `wss://reports-rec-encouraged-taught.trycloudflare.com` forwards to the unchanged `http://127.0.0.1:9010`. Its two observed IPv4 addresses are public Cloudflare addresses. An already installed cloudflared 2026.9.3 runs in the owned transient `nord-browser-public.service`. The original Funnel was preserved; the player no longer uses it. No dependencies, native code, map/assets, renderer settings, saves or VRAM guard changed.

[Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) are temporary development endpoints without an uptime guarantee. The hostname changes when the tunnel process is recreated. If that happens, rebuild and redeploy the configured static player using the new WSS address; restarting only the tunnel cannot repair the old published bundle. The user service has `Restart=on-failure`, five-second retry, and no reboot persistence. The existing native lifecycle retains its original behavior.

## Verification

| Check | Result |
| --- | --- |
| Ordinary browser before repair | Failed before streamer discovery; Chrome local-network error, no WebRTC peer created. |
| Local player with replacement endpoint | Seven live checks passed, 00:56:50–00:57:10 UTC. |
| Public HTTPS preview | Seven live checks passed, 00:57:59–00:58:19 UTC; `networkMode=ordinary`, no DNS override. |
| Production HTTPS alias | Seven live checks passed, 00:58:47–00:59:09 UTC; `networkMode=ordinary`, no DNS override. |
| Media and controls | Host/friend independently decoded advancing 1280×720 VP8 video and received audio packets; trusted mouse/WASD/C/Space inputs, Escape release, occupied-slot refusal and both reconnect paths passed. |
| Published build | Production `dpl_5nXnqkFxfDRz71iG7BQJBL44RbKt` READY in the existing NORD project/team. Preview, production and local player JS have SHA-256 `ee95fc0410b3534443422e9a833a2342780692c9544f1f7041d32da5123cf924`. License notices unchanged. |
| Regression diagnostics | Live runner now records `ordinary` versus `scoped-dns-override`, plus browser console and WebSocket errors. Production showed no socket or local-network errors; resource 404 console entries are recorded separately and were not investigated in this connection repair. |
| Endpoint tests | Four existing validation tests pass; runner syntax and Git whitespace checks pass. |
| Preservation | Launcher 2695048 and children 2695156/2695666/2698970 retained. Both map hashes and every discovered campaign-save hash match the pre-repair state. The separate Plateau project was untouched. |

Production screenshots and raw summary remain in ignored `Browser/.qa/live-2026-10-11T00-58-47-890Z/`. The reviewed `host-reconnected.png` shows the native scene, two online players, campaign HUD and usable browser controls. The preview uses the exact same player files as production. The only static configuration change is the WSS endpoint.

## Remaining limits

This establishes ordinary-browser access **from the hosting PC**, not media reachability through a friend's external NAT/firewall. The current configuration still has STUN only and no TURN relay. Audible sound, sustained/manual driving responsiveness and full Mission 2 browser acceptance remain open. Brief samples observed about 19–22 decoded FPS; they are not sustained performance acceptance. The PC, native sessions and temporary tunnel must stay running. See [HOSTING.md](../Browser/HOSTING.md) for current lifecycle and stop procedures.
