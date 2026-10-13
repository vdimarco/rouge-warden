# Faster NORD browser stream and the tall phone frame

The user reports two problems on a phone: the game still shows a wide picture across the top of an upright phone, and the game runs very slowly. The user asked to delegate this optimization work to Codex on the host PC, because only that PC has Unreal Engine, the GPU, the game package and the stream services. The user also asked to close Dota 2 on that PC.

## Why the phone shows a wide picture

The Vercel project `nord-montreal` has the environment variable `NORD_PORTRAIT_STREAM=0` for production and preview, with the comment "0 keeps 1280x720 for the current game build" (read through the Vercel API on 2026-10-13). A page built with it never asks the game for a tall frame. The tall HUD and the page code for tall frames are on `main`, but the host has not rebuilt the game, so the flag stayed at 0. On an upright phone the page shows the whole 1280×720 frame in a 16:9 strip at the top (`styles.css`, portrait rule) with black space below.

## Why the game is slow

- The host has one RTX 4090 (24 GB) and an i9-14900K (24 cores, 32 logical CPUs). It runs two full game processes (NordHost and NordFriend1) at 1280×720 and 30 FPS.
- The records show 11–13 native FPS while Dota 2, the desktop shell and both game processes shared the GPU at 96–97%. Later desktop samples of about 1.5 s decoded 26–30 FPS, with Dota 2 and the desktop shell still running; no native FPS was recorded for those windows. No measurement was made with the other GPU applications closed.
- The idle slot (usually NordFriend1) keeps drawing the world at up to 30 FPS when nobody watches it.
- Phones on mobile data reach the host through TURN over TLS/TCP on a Tailscale Funnel. Short same-PC relay samples carried 0.7–1.7 Mbps, while the host starts each stream at 8 Mbps. On TCP, that overshoot shows as late, bursty frames and freezes.
- The next rebuild also brings the new sky, weather and night lights from `nord-sky-water`, which add GPU work in both processes.

## What changes

1. Prepare the host checkout, and measure a clean baseline after the user closes Dota 2, before any game change.
2. One game rebuild that adds: a game-to-page message that says the build supports tall frames, a game-side size limit, an idle-slot throttle (opt-in host flag), a stream budget for the sky (opt-in host flag) and a frame-rate log line. The rebuild also completes the native steps of `nord-sky-water`.
3. Host launcher changes: validated options for the new flags, bitrate and capture scheduling, so each can be compared on and off.
4. Page changes: ask for a tall or sideways frame only when the running game says it supports one (the build flag goes away), fix the look-pad scale after the frame changes shape, detect an ignored request, and add a QA readout of stream statistics.
5. Deploy the page, check on a physical phone, and record the measurements.

## Out of scope

- Moving the host to a rented server. A separate cost estimate covers that decision.
- New art or gameplay. The stream budget keeps the requested look and only trims cost.
- Enabling browser console commands (`-AllowPixelStreamingCommands`) on the public host.
