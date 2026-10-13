# Faster NORD browser stream and the tall phone frame

The user reports two problems on a phone: the game still shows a wide picture across the top of an upright phone, and the game runs very slowly. The user asked to delegate this optimization work to Codex on the host PC, because only that PC has Unreal Engine, the GPU, the game package and the stream services.

## Why the phone shows a wide picture

The live Vercel project builds the page with `NORD_PORTRAIT_STREAM=0` ("0 keeps 1280x720 for the current game build"). That page never asks the game for a tall frame. The tall HUD and the page code for tall frames are on `main`, but the host has not rebuilt the game, so the flag stayed at 0. On an upright phone the page then shows the whole 1280×720 frame in a 16:9 strip at the top (`styles.css`, portrait rule) with black space below.

## Why the game is slow

- The host is one RTX 4090 (24 GB) with 32 CPU cores. It runs two full game processes (NordHost and NordFriend1) at 1280×720 and 30 FPS. That load should fit this GPU.
- The records show 10–13 native FPS while Dota 2, the desktop shell and two game processes shared the GPU at 96–97%, and 27–30 FPS in quieter windows. A controlled comparison with the other GPU applications closed was never made.
- The idle slot (usually NordFriend1) keeps drawing the world at up to 30 FPS when nobody watches it.
- Phones on mobile data reach the host through TURN over TLS/TCP on a Tailscale Funnel. Same-PC relay runs carried only 0.7–1.7 Mbps, while the host starts each stream at 8 Mbps. On TCP, that overshoot shows as late, bursty frames and freezes.
- The next rebuild also brings the new sky, weather and night lights from `nord-sky-water`, which add GPU work in both processes.

## What changes

1. Measure a clean baseline with the other GPU applications closed, before any code change.
2. One game rebuild that adds: an idle-slot throttle (opt-in host flag), a game-to-page message that says the build supports tall frames, a game-side handler that limits stream sizes, and a stream budget for the sky (opt-in host flag).
3. Host launch changes: a lower start bitrate, the new flags, and guarded tests of the capture scheduling and other codecs.
4. Page changes: ask for a tall frame only when the running game says it supports one (the build flag goes away), fix the look-pad scale after the frame changes shape, detect an ignored request, and give a sideways phone a frame of its own shape instead of a stretched one.
5. Deploy the page, check on a physical phone, and record the measurements.

## Out of scope

- Moving the host to a rented server. A separate cost estimate covers that decision.
- New art or gameplay. The stream budget keeps the requested look and only trims cost.
- Enabling browser console commands on the public host.
