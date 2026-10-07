# Visible death and pause screens

A fatal collision mounted the result dialog, but the paused game's blanket
`animation-play-state: paused` rule froze its entrance at zero opacity. The
player saw only the blurred backdrop. The same rule hid the pause dialog.

Pause now stops the three gameplay feedback animations (Rush pulse, notices,
and reward counters), allowing dialogs to finish appearing. Simulation and
world rendering still stop behind the dialog. This restores the existing
River Rush specification's fatal-collision results and one-action retry.

`qa/river-rush/death-retry.mjs` waits for actual collisions to consume the
shield and end each run. It checks painted dialog opacity, viewport bounds,
retry hit testing, score/distance/coins and cause, frozen run state, button and
Enter retries, and visible pause/resume/home controls. An active pointer at
death is covered on the phone layout. It checks phone, desktop and short
landscape WebGL, phone 2D fallback, and reduced motion.

Run against the built arcade served on port 8765:

```sh
node qa/river-rush/death-retry.mjs
```

Use `CASE=phone ARCADE_URL=https://arcade.uptick.systems/` for the focused live
check. The check fails on the previous bundle even though Playwright considers
the transparent dialog visible. Browser checks use Chromium with emulated
viewports and SwiftShader; physical phones are not covered.

Local build hashes and check results are recorded in
`death-screen-verification.json`.
