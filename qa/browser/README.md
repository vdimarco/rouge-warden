# Pinball browser checks

GitHub Actions runs Chromium tests when the pinball game, shared controls, or these tests change. Each run checks portrait phones, landscape phones, and landscape tablets. Download `pinball-screenshots` from the Actions run to inspect the rendered screens.

Run locally from the repository root:

```sh
npm ci --prefix qa/browser
(cd qa/browser && npx playwright install --with-deps chromium)
python3 -m http.server 8765 --directory public
```

In a second terminal:

```sh
SHOTS=/tmp/pinball-shots npm run test:pinball --prefix qa/browser
node qa/lab/tilt.sim.mjs
```

The existing interaction suite covers scoring, skill shots, ball saves, keyboard controls, and simulated phone nudges. The layout suite checks table size, control bounds, launch direction, pointer capture, and rotation without restarting the run.

These tests need an environment that allows Chromium to start. They do not replace checks of real phone sensors, touch latency, or visual art quality on a device.
