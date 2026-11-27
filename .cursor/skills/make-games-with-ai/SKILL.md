---
name: Make games with AI
description: >-
  Use this when planning, building, art-directing, testing, or shipping a game
  with AI agents (Rouge Warden studio and any browser or mobile game).
---
# Make games with AI

Studio rules for every game agent: design, gameplay, art, audio, QA, release and community. Apply them before building, and check every build against them.

## 1. Give the agent a target, not a vibe
- Find the look first: a real game or an AI image. Agents match pictures far better than words.
- "Make it like TowerFall" isn't a spec. Run speed, jump height and dodge length are.
- Ask for one frame of the look first, then check every build beside the reference.

## 2. Never let the agent fake an asset
- Don't stick to one asset library. When search comes up empty, an agent draws a box instead.
- Image to 3D beats text to 3D. Make a clean front view with Nano Banana 2.1, then turn it into a model with Meshy 7.1.
- Rig and animate people with Mixamo. If a character isn't in Mixamo's cast, make it in Meshy and animate it in Mixamo.
- Model hero props in Blender with parts that move. Bake lighting in patch's cloud Blender.

## 3. Where the good assets are
- Build on the best games on patch: Small Magic, Quarantine, Friendlies, Siege.
- Sketchfab is huge. Check each licence, and use one artist's packs to keep one look.
- Quixel Megascans is free for commercial use now. It has models, materials and plants, all photoreal.
- Music: Kevin MacLeod (royalty free, credit him). Sound effects: Sonniss.

## 4. One game, one look
- Two good assets in two styles make one unfinished game. Match pixel size, shading and outline.
- Make the UI fit the game's world, and swap words for pictures: icons, tiles, keycaps.
- Take colours from the subject (a picnic is green lawn, red gingham and gold cake), not from your brand.
- Never make it dark. Night is a colour shift. If players can't see, they're annoyed, not scared.

## 5. Effects need acting
- Make effects from AI video: film each one alone on black, cut it into a flipbook, and layer it in code.
- The most convincing cue in a spell is its light sliding across the floor underneath it.
- Use a wind-up, a freeze on hit, and a recovery. Without them, effects look like stickers on a mannequin.

## 6. The boring 10% makes it a game
- Before release, ship a loading screen, a title card, title music, menu sounds and full controller support.
- Show controls for both controller and keyboard. Keep UI and sounds the same across every mode.
- Warm up the GPU one piece at a time. Uploading everything on frame one froze the page for 3 s.
- In menus, a held direction should repeat: after 0.42 s, then every 0.12 s.

## 7. Online: send buttons, not the world
- Make the game deterministic and send only inputs. Every screen predicts, rolls back and replays.
- When the host alt-tabs, their browser drops to 1 tick a second. Tick the match from a Worker.
- Test with lots of tabs and fake lag: the host leaves, someone reloads, someone joins late.

## 8. Your agent can't play your game
- An agent can't hold a controller or hear a sound. Every number it picks is a guess until a person plays.
- So make the game test itself: bots, an autopilot, and a self-test that plays a whole match.
- Don't trust AI judges on motion. Three of them passed a backwards walk, and two failed a correct one.
- Measure what feels off. Our "shaky diagonals" were 67 camera jitters in 118 frames.

## 9. AI is cheap, taste isn't
- 87 AI sound effects cost $0.29. A whole spell's effects cost $6 to $9.
- Our guns have been through 5 rounds of "more detail." Budget for rounds, not tokens.
- Play the best game in your genre first. One playthrough reversed three of our design calls.

## 10. Show it, then open it
- Rebuild one mechanic everyone's watching. GTA 6 car damage had 4M views, and our version took an hour.
- An "AI-generated" label on real gameplay makes people think the game is fake.
- Open source what you can. For licensed assets, leave a note telling agents where to get them.
- Never let a CC0-only rule make your game worse.

## Checklist before calling a build done
1. Is there a reference image, and was the build compared beside it?
2. Are the feel numbers written down as numbers?
3. Are there no placeholder boxes or stand-in assets?
4. Do pixel size, shading and outline match across every asset?
5. Is the game bright enough to see at night?
6. Do effects have a wind-up, a freeze on hit and a recovery?
7. Are the loading screen, title card, music, menu sounds and controller support in?
8. Are input repeat timing and GPU warm-up in place?
9. If it's online, was it tested with tabs, lag, the host leaving, a reload and a late join?
10. Did a self-test play a full match, and are measured issues logged?
11. Has a person actually played the build?
12. Are licences checked and asset sources noted?
