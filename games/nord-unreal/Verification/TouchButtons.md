# NORD game-style phone buttons

Sprint, Jump/brake, Use and Menu now have round 72–88 px targets (88 px on a full-height portrait phone), monochrome action icons, 12 px gaps, and yellow pressed faces. The two bottom-right rows, input bindings, move stick and drag-anywhere look remain intact. The portrait crew list sits above the taller action grid. No new dependency, native package or service restart was needed; streaming profiles remain unchanged.

Validation passes: 22 unit checks, the browser UI suite, and all 14 real-stream mobile checks both locally and on production. Chromium touch emulation covers 360×800 portrait, 800×360 landscape and 667×375 narrow landscape, including native mission/radar/prompt/speed clearance, simultaneous movement/look/jump, full-face Jump press feedback, keyboard menu activation, receiver adaptation and clean release. A separate 360×800 portrait crew-list check measured a 20 px gap above the action grid, verified the page identity and found no page errors. Screenshots were inspected. Browser plugin not available; the installed Playwright workflow was used. Local diagnostics contain only the existing missing favicon requests.

Local evidence: `Browser/.qa/mobile-2026-10-13T20-29-22-178Z/`. Public evidence: `Browser/.qa/mobile-2026-10-13T20-34-08-953Z/`. Public diagnostics are retained in its `summary.json`.

[PR #341](https://github.com/vdimarco/rouge-warden/pull/341) merged as `b9e63e8eca294e9192c5fbacfdba65d649f38891`. Production deployment `dpl_8HwsVdemNnNNiK4u3WyveLMmvP1z` is READY at [nord-montreal.vercel.app](https://nord-montreal.vercel.app/). All twelve production files and all twelve public files match the tested distribution by SHA-256. OpenSpec structure and canonical/archive agreement were checked manually because the CLI is unavailable.

Physical iOS/Android thumb reach, carrier performance, audio and subjective driving feel remain unverified. This controls change makes no new streaming performance claim.
