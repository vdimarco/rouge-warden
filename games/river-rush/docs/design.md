# River Rush runner design

The user requested a full rebuild because the treasure race was boring, with the continuous decisions and quick retries of Subway Surfers. The old reach/unlock/escape race is replaced by an original three-lane whitewater runner. The approved face, long hair and modest brown loincloth are preserved.

## Visual direction
The production concept is `concepts/endless-runner.png` (1024×1536). Vivid turquoise water, sunlit jungle banks, distant ruins, gold coins, dark forest translucent controls, and geometric sans score typography. Gameplay uses DM Sans with white/ivory score text, gold multiplier, mint protection and Rush. The existing Bodoni/Georgia cinematic title and Higgsfield loop remain.

Assets: Higgsfield-generated landscape `runner-river.png`; ImageGen portrait `runner-portrait.png`; RGBA `runner-sprites.png` containing ride/jump/duck hero poses, boulder, log, branch gate, coin, magnet and shield. Unequal generated atlas rows are mapped through explicit rectangles rather than clipping full silhouettes. All objects use generated artwork. Canvas primitives are limited to perspective placement, navigational lane lines, water motion/wakes, shadow, protective aura, power feedback and particles. Representational scenery and characters are not drawn with code.

The photographic environment remains intact while projected objects, moving foam and wakes establish forward motion. A first scanline texture experiment was removed after native browser inspection exposed blocky artifacts. The character faces the camera to preserve the requested likeness. Intentional concept differences: compact rounded panels instead of painted HUD strips; the branch gate is a one-lane or three-lane traversable obstacle; Rush and active challenge indicators are functional additions; gold trails reflect the actual seeded course rather than decorative coins. Separate portrait/landscape environments avoid stretching jungle banks.

## Gameplay and pacing
Three discrete lanes. Keyboard: A/D or ←/→, W/↑/Space jump, S/↓ duck, Shift Rush, Escape/P pause, Enter retry. Touch: four-direction swipes, lane/jump/duck buttons, Rush button. Taps are queued and consumed once; lane state changes immediately with approximately 100 ms visual settling. Jump lasts .86 s, duck .82 s; opposite actions cancel immediately and repeated input near action end buffers for .2 s.

Speed starts at 22 m/s and rises to 42 m/s over roughly 111 seconds; Rush multiplies it by 1.32. Obstacle rows arrive around 1.17 s apart initially, tapering to .97 s. Ordinary rows have one or two hazards and a clear lane. Every twelve rows a full log barrier followed by a branch barrier demands jump then duck; the legal action route remains reachable. Coin trails encourage route choices and raised coins reward jumps. Successful actions score 100×multiplier and charge Rush. Eight consecutive coins raise the multiplier, up to ×5, with a 2.8 s collection gap breaking the streak; the HUD bar shows remaining streak time.

Rush requires 100 charge and lasts four seconds, clears obstacles and attracts coins from all lanes. It cannot recharge itself. Magnet lasts eight seconds and appears roughly once per thirteen rows. Shield absorbs one impact and grants 1.1 s grace; each run begins shielded and further pickups appear roughly once per seventeen rows. Trick, coin and distance challenges rotate within a run, reward 500 points and charge (outside Rush), and set targets relative to the moment they start.

Screens: loading/error, living menu, instructions, playing, pause and wipeout/result. The result explains the actual obstacle and offers immediate retry, best score, coins and distance. Versioned validated storage preserves the existing cabinet key while separating runner records from legacy race scores. Pause/hidden page/completion freeze simulation. Reduced motion disables decorative movement but keeps course/action feedback. WebMCP is guarded and offers read-only run status plus start/pause tools; the browser tests supply a shim solely to observe state while using real input.

## Visual comparison ledger
Compare the production concept and browser `game-concept.png` at their native 1024×1536 viewport, plus 390×844, 844×390 and 1536×1024.
1. Layout: upper score/coin/streak band; lower character; four aligned bottom actions; horizon opens the upcoming course. Smaller phone HUD and landscape controls preserve the action area.
2. Typography: bold sans score and gold multiplier preserve the hierarchy; geometric system/DM Sans replaces the generated italic lettering. Menu serif remains intentionally distinct.
3. Palette: turquoise/forest/gold retained; white/mint protection and Rush feedback distinguish active powers. Dark HUD backgrounds improve contrast over foliage.
4. Assets: generated jungle/ruins and individual coins/logs/gates/rocks match the concept; the requested face/long hair/loincloth is visible in all three poses. No generic avatar substitute.
5. Copy/responsiveness: live score replaces sample numbers; Jump/Duck labels and arrow icons remain. Added charge/challenge/protection copy explains actual mechanics. All actions remain reachable on phone and landscape; no horizontal overflow.

Validation results and actual deployment are recorded in verification.md.

## Living motion pass
The subsequent request for more animation, then fal.ai, adds matched first/last-frame MiniMax H3 Max river loops in portrait and landscape. Only the active aspect loads on starting a run. Silent inline playback never gates input; GPU water displacement provides a bounded-resolution loading/error fallback, and still art with animated foam works without WebGL. Reduced motion and data-saving preferences avoid gameplay video. All inactive screens stop playback; canvas caches the captured frame by simulation time, including late decode after pause.

An eight-frame generated paddle atlas provides distinct arm, paddle and torso positions. Brief exponential ride/jump/duck blending, raft banking, landing compression, wakes and paddle spray add character motion. Coin sprites squash horizontally as they spin, then travel from their actual lane to the measured HUD icon; attracted coins first arc toward the player's lane. Shield shards, impact recoil, expanding landing wakes, clipped generated obstacle pieces, magnet arcs and existing Rush trails stay bounded. HUD coin/multiplier pulses remain small. All presentation uses simulation time; authoritative lanes, action windows, speed, collisions and scoring are unchanged.

Native frame inspection confirmed both fal.ai clips preserve the existing backgrounds with moving rapids and no added hazards. The new paddle atlas preserves the approved face, long dark hair and loincloth. This pass retains the accepted concept, typography, controls and viewport layout; only character animation and effects intentionally differ. Provider endpoint, request IDs, original URLs and encoding are in media.json. Higgsfield's attempted new river generations were rejected for insufficient credits before any job was submitted; neither is claimed as a generated asset.

## Snappy flow pass — 2026-10-06
The user requested a faster, fluid feel like Subway Surfers. Opening speed is now 30 m/s with a 50 m/s ceiling; rows arrive at roughly 1.05 to .86 seconds. Jumps last .66 s with immediate upward motion and ducks .60 s. Visual lane settling reaches 95% in about 72 ms at 60Hz; authoritative lanes and action silhouettes change immediately. A first 26-pixel swipe can continue with a deliberate 56-pixel additional lane step; vertical swipes consume once. Cancelled pointers and restart clear gesture state.

The raft is registered to one center, base width and waterline across all eight paddle frames and jump/duck artwork. Six premultiplied-alpha samples per source frame produce 48 immutable cached frames (about 33 MB RGBA), with no per-frame image blending. Photo source art, face, hair and loincloth are retained. The river's projected foam now approaches with course distance instead of moving away. Playback rate follows speed and Rush, short wake streaks accompany dodges, and reduced protection arcs leave body motion visible. Reward flights and bursts expire faster. Portrait waterline moves from .80 to .77 screen height to clear the Rush control.

Video copies follow decoded frames and use a bounded native-size cache; the renderer draws a single opaque background and defers WebGL initialization during normal media loading. Backing buffers are capped at 1.2 million pixels on narrow views and .9 million on wide views, keeping DOM HUD/buttons sharp. Inactive runs repeat neither full canvas draws nor HUD snapshots. Assets are prepared once and reused on retry. Existing fal.ai loops remain; no new media generation was needed.

Native comparison retains the accepted layout, palette, typography and generated art. Intentional differences are faster movement, a registered/interpolated paddle cycle, a compact shield arc and a higher portrait waterline, which keeps the full raft visible above Rush.

The foreground raft is capped at .33 viewport width so its registered base stays within the two outer lanes. This corrects the edge clipping exposed by normalizing the old off-center paddle frames; the oar can extend outward during its stroke, while the face and raft remain visible.

Jump launch has a 60 ms clearance grace for logs and raised coins, so a timely tap registers on the next simulation frame. Rocks still require a lane dodge and branches still require duck. This changes the engine rule explicitly; visual animation remains independent of collision decisions.
## Moving world — 2026-10-06

The second feel review found that a stationary photographic scene and thin moving streaks still read as an incoming-obstacle overlay. Normal speed now starts at 42 m/s and rises to 72 m/s; the first hazard moves to 68 m and row spacing still follows encounter timing. View distance expands to 180 m and action hints scale with speed. Existing jump/duck windows and immediate logical controls remain.

Whitewater patches and mossy bank rock clusters now use the same world distance and projection as hazards. They grow, approach and leave through the edges continuously, even between hazard rows. They are bounded (at most 30 bank props and 36 water patches), fade in at a distance and stay outside playable lanes. Invisible bank props are culled. Reduced motion omits them.

Steering uses an analytic critically damped spring at omega 60, preserving position and velocity when the player reverses direction. A single-lane step reaches 95% in approximately 80 ms; unlike the previous exponential easing, its first 60 Hz step moves about 26% rather than half a lane. The jump lift is larger. Jump/duck retain the current paddle pose and raft registration. Duck compresses the torso below a full-size head, preserving face proportions. The eight exact source paddle poses replace photograph crossfades that produced doubled faces/arms; cached pose memory falls from about 33 MB to 5.5 MB.

The browser now composites the existing fal.ai videos directly behind a transparent gameplay canvas. This eliminates full-frame video copies and texture uploads during normal playback. Videos stay muted, lazy, speed responsive and pause with the game; clips detach when returning to the menu and can be reused. Still/GPU/video-error/context-loss/data-saving fallbacks remain. The HUD updates locally every 80 ms instead of rerendering App every 50 ms.

The production native clips are 60fps optical-flow derivatives of the existing fal.ai loops, sped up 1.3× and encoded at 512×768 and 768×512. Each lasts 3.916667 seconds; originals remain in the repository. Native playback begins at 1× and follows speed/Rush within 1.25×. Foreground resolution is bounded to 900,000 pixels on narrow layouts and 600,000 on wide layouts, while native video remains independent. This reduces texture/decoder work and uneven source-frame pacing; media.json records the exact derivation and original request IDs.

The fal.ai game asset skill was used for a foliage attempt. The live schema for `openai/gpt-image-2` listed transparent background support, but request `01a10ec1-129b-7323-8c3e-eec6473bcd10` rejected that exact field with 422. No paid retry was submitted and no foliage output is claimed. Existing approved mossy rock art provides consistent bank scenery instead of the flat vector draft.

## Meshy 3D world — 2026-10-06

Primary gameplay now uses a genuine Three.js world. Meshy 7.1 generated a timber raft, tropical rock/root/leaf bank and tall palm through the connected fal account. Local GLBs use meshopt geometry and WebP textures; repeated scenery, terrain, mountains and coins share instanced draws. The approved rider remains a photographic animated cutout to retain his face, long hair and modest loincloth. He is not a generated rigged 3D character.

The GPU displaced water and four CPU buoyancy probes share directional wave coefficients, simulation time and world distance. Damped heave/pitch/roll, steering lean, wake foam, obstacle motion, landing impulses, rings and spray connect the raft to the water. These are arcade wave/buoyancy approximations, not a full fluid solver, and never alter the deterministic course or collision rules.

WebGL initialization failure retains playable 2D. Context loss pauses and remounts a 2D canvas. Reduced motion freezes water and decorative movement. Software WebGL uses simplified derived Meshy bank/palm meshes and inexpensive shading; actual hardware uses full detail. All generated models are hosted under the arcade route, with no external generation-service dependency during play. Required images and models retry transient failures twice; persistent model failures use primitives, while persistent image failures offer a usable retry button.
