# Private character ink-wash comparison

**Accept the private NovelCrew wash attenuation for colour only. Keep the high-detail pilot out of the production default.** All 14 native 720p stills were independently viewed. The shirt shifts from strong indigo toward dark charcoal, jeans retain clearer blue separation, and hair/beard read darker brown/black. Skin, red emblem and prop remain legible in both closeups and all five body poses.

The native author/fresh-readback receipts prove only the private `M_ComicInk` package changed. Its saved HLSL multiplies the violet addition by `lerp(1.0,0.35,NovelCrew)` with the visible-depth mask retained. Production stencil255/environment evaluate the unchanged multiplier1; the production Art material hash is unchanged. `InkWashReview.json` retains the exact material, HLSL, image, report, window, raw-video and CSV hashes, inputs/defaults and preservation guards.

Software-decoded review covers 11 selected frames per run across eight phase representatives and three jump offsets, plus full-frame HUD/jump checks. These samples show no obvious new colour-mask break. Camera, HUD and prop remain present. Background wind and native phase poses differ, so there is no pixel-identity claim. The final `ReviewFrames/frame-05.png` is editor after PIE and is excluded from gameplay evidence. **Continuous playback was not viewed.**

Airborne sleeve/shoulder collapse into raised skin lobes, pale/chipped collar/neck-wall artifacts and detached ground/shadow fragments remain. The wash does not change geometry, rig or clips; raw jump defects still block default promotion. The 26-face UV collar study remains unpromoted.

The before/after CSVs contain 59/68 numeric rows. FrameTime p50 is 115.806/109.338ms and nearest-rank p95 is 217.165/121.508ms; GPUTime p50 is 85.779/80.501ms. These are short warmed editor diagnostics with startup spikes, varying row counts and wind/timing. They do not establish a wash performance gain, packaged FPS, 60fps or fluidity. The raw RenderThreadTime rollup is retained without interpreting its near-zero values as negligible rendering work.

Both managed windows/native processes/recorders passed and restored the demo, settings and protected Content. No final character art, default promotion, physical-input/network/crowd or packaged performance acceptance is implied.
