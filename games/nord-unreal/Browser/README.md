# NORD browser player

This is the static browser side of the existing UE5.8 game, using Epic's [Pixel Streaming frontend](https://github.com/EpicGamesExt/PixelStreamingInfrastructure/tree/UE5.8/Frontend). It receives actual game video/audio and forwards desktop input. Vercel serves these files; the game and signalling server run separately on the host GPU PC.

[Open the deployed NORD player](https://nord-montreal.vercel.app/). **The PC streams are currently stopped until sufficient GPU memory is free.** The page remains deployed; it cannot provide gameplay while the host is stopped. This temporary demo supports two player slots, one browser per slot. Before another GPU application started, the deployed two-player regression passed and a bounded 30-second sample averaged 23.1/24.2 decoded FPS. Car entry/driving/exit are visually checked. Sustained/remote responsiveness, off-LAN access, audible sound, handling enjoyment and full browser-package campaign reload remain open. See the [verification record](../Verification/BrowserStreaming.md) and [temporary PC hosting](./HOSTING.md).

Run the following commands from `games/nord-unreal/Browser`:

```bash
npm ci
npm test
NORD_SIGNALLING_URL=wss://your-signalling-host.example npm run build
python3 -m http.server 8081 --bind 127.0.0.1 --directory dist
```

The build reads `NORD_SIGNALLING_URL` and optional `NORD_DEFAULT_STREAMER_ID` (default `NordHost`). These are public settings embedded in JavaScript, never secrets. `.env.example` documents them; the build does not automatically load `.env` files. For the local lifecycle helper, use `ws://127.0.0.1:9010` when the player page is also on loopback. A Vercel build and every non-local browser require `wss://`. Credentials, URL query parameters and fragments in the endpoint are rejected. Player-page query parameters cannot override the endpoint or Pixel Streaming settings.

The current Vercel deployment uploads the configured, prebuilt `dist` plus static deployment configuration; it has no Git linkage. Rebuild with the intended public environment values before uploading another static deployment. A future Git-connected project can use `games/nord-unreal/Browser` as its root and the included `vercel.json` to build `dist`; configure the values in the intended Vercel environment and redeploy after changing them. An empty endpoint builds an explicit offline page; it does not create a running game.

Connect, choose a free player, then click **Play with sound**. Click the video to capture mouse/keyboard; **Esc** releases it. `NordHost` is Player 1 and `NordFriend1` is Player 2. They are separate Unreal processes connected to the same multiplayer session. The temporary signalling server accepts one browser per stream and refuses an additional subscriber to an occupied slot. The player lists streams reported by the server; sharing one stream would not create an independent character.

WSS signalling alone does not establish a WebRTC media path. The host needs reachable ICE candidates or a TURN relay. The current temporary PC host must remain powered on, connected, and running the game/signalling processes. Deployment success and UI checks do not establish external-network playability.

The player uses the existing native controls and campaign. Disconnect cleanup releases held movement/car input and the player's worklight without resetting progress. There is no touch control scheme, account/session allocator or new art. Phone play and headset/microphone input are outside this rollout.

`npm test` checks endpoint validation. `npm run test:browser` reuses the repository's installed `qa/browser` Playwright and system Chromium to check offline/error states, click-to-connect, ignored URL overrides, and 720p/1080p/narrow-page layout without a running game. Set `NORD_PLAYWRIGHT_PATH` or `NORD_CHROMIUM_PATH` when those existing tools live elsewhere. This test temporarily rebuilds `dist` and restores its original endpoint in `finally`; do not run it during a deploy. These checks pass; real-media evidence and outstanding manual/network checks are recorded separately in [BrowserStreaming.md](../Verification/BrowserStreaming.md).

With both native player slots running and free, run the opt-in real-stream regression from this directory:

```bash
NORD_PLAYER_URL=http://127.0.0.1:8100 \
  NORD_PLAYWRIGHT_PATH=/home/von/Work/rouge-warden/qa/browser/node_modules/playwright/index.mjs \
  npm run test:live
```

Use the deployed HTTPS player URL to check that deployment instead. This test creates isolated host/friend browsers and a third occupied-slot attempt. It requires actual 1280×720 video, advancing playback and decoded WebRTC frames, sends mouse/WASD/C/Space input, checks Escape release and disconnect/reconnect controls, then closes its own browsers. Screenshots and a JSON summary are written to a unique `.qa/live-*` directory. It does not launch/restart the game, rebuild the player, inject native game commands, or claim that screenshots prove native position/story progress. It prints observed decoded FPS without imposing a 60 FPS claim; audible sound and driving feel require a person.

On the hosting PC, Tailscale MagicDNS may resolve its own Funnel hostname to a private tailnet address. If your browser blocks the connection and prompts for this site's local-network access, allow it for this site, or use the documented loopback player for local testing. The ordinary browser flow on this PC has not been verified; QA used the scoped mapping below. Keep global browser security and system DNS settings intact.

For that isolated QA case only, set `NORD_FUNNEL_PUBLIC_IP` to the currently observed public Funnel IP. The runner validates it with Node's `isIP` and maps only `omarchy.tail7b97f6.ts.net` in its own Chromium process. It does not disable browser security or alter system DNS. This same-PC public-endpoint check does not establish reachability through an internet friend's NAT/firewall; external-network testing remains separate.

The build copies [THIRD_PARTY_NOTICES.txt](./THIRD_PARTY_NOTICES.txt) into the published static output. It preserves Epic frontend/common and Philipp Hancke `sdp` MIT notices, plus `@protobuf-ts/runtime` Apache-2.0 and its Daniel Wirtz/Google BSD-3-Clause portions. The [deployed notices](https://nord-montreal.vercel.app/THIRD_PARTY_NOTICES.txt) are publicly accessible.
