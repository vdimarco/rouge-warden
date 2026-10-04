# Tasks

## 1. Boot and app shell
- [x] 1.1 Ship three.js r170 and the fonts in `public/fish/`, with the font license; no other host at boot.
- [x] 1.2 Add the loading screen and the boot error card with "Try again".
- [x] 1.3 Make the render scale recover, pause on GL context loss, redraw on restore, and slow the lake under opaque screens.
- [x] 1.4 Add the store build flag; hide the arcade parts; use app copy.
- [x] 1.5 Add `js/native.js`: back button, pause and resume, splash, status bar, keep awake, and the save mirror.
- [x] 1.6 Add native haptics for iOS in `haptics.js`, and fix the last-run buzz.
- [x] 1.7 Tests: offline boot, store mode, the back button with a stubbed bridge, context loss, render scale, native haptics.

## 2. Fight
- [x] 2.1 Drag gives before the line breaks; a run starts with a click and a buzz.
- [x] 2.2 Easy mode jump rise; a beaten fish makes no trick moves.
- [x] 2.3 SLACK on the gauge and the slack prompt in a shake.
- [x] 2.4 Prompt hold and the toast place and queue in the reel.
- [x] 2.5 Larger gauge text, patterns as well as colours.
- [x] 2.6 Longer loss beat, a legend loss line, and copy fixes.
- [x] 2.7 A sure first bite for a fresh save.
- [x] 2.8 Update the stale `screens.mjs` and `reel.ui.mjs` checks; rerun the fight and place sims.

## 3. Casting
- [x] 3.1 Grade touch and mouse releases at the finger.
- [x] 3.2 Forgive a touch flick that ends above the press point.
- [x] 3.3 Grow the touch area; decide between a cast and an aim after 12 px.
- [x] 3.4 Smooth the motion window on the early side; grade a held thumb as late.
- [x] 3.5 Instant release feedback, the distance preview, the right back-swing tip, and the touch rail.
- [x] 3.6 Offer touch when the sensors stop; a hook set anywhere on the lake in touch mode.
- [x] 3.7 Tests: release grading in node, the gap and overshoot sweeps, the miss-press check.
- [x] 3.8 A quick turnaround to the next cast: shorter waits, a skip by any cast input, and a faster empty retrieve.
- [x] 3.9 A mouse hold cast on desktop, with sideways aim, and its tests.

## 4. Goals
- [x] 4.1 Six goals at each place, on the Places card, with the toast and the sting.
- [x] 4.2 Today's goal and the run of days, with `?day=` for QA.
- [x] 4.3 The next-goal line, the rank ladder, and the old best on the results.
- [x] 4.4 Help for short casters, and the short-caster case in `journey.sim.mjs`.
- [x] 4.5 The sweet-cast streak in free fishing.
- [x] 4.6 The derby unlock on the catch card; fix the small progression bugs.
- [x] 4.7 Tests: save fuzz for the new fields, the goal predicates, the daily goal over 60 days, and the screens checks.

## 5. Feedback
- [x] 5.1 The hook-set hit.
- [x] 5.2 The jump zoom.
- [x] 5.3 Tiered stingers, the new-place stinger and card, the derby count-up and close.
- [x] 5.4 Splashes you can see at range, the rod-tip twitch, and the legend glitter.
- [x] 5.5 Tests: new sounds render, and a moments script checks each key moment's sound, buzz, and picture.

## 6. Menus and access
- [x] 6.1 "Go fishing" first, the art picker in Settings, and "Painted" for the old style name.
- [x] 6.2 The guide on for new players, with a clear button label.
- [x] 6.3 Short help on the right tab, and one word for each move.
- [x] 6.4 Fix the HUD chip, short screens, the journal wall, the icons, and the small layout bugs.
- [x] 6.5 Larger text, Calm effects, the full left-handed mode, the drag buttons near the thumb, live regions, dialogs, and the About row.
- [x] 6.6 Screenshots of every screen at the six sizes, checked by eye.

## 7. App project
- [x] 7.1 `apps/fish/` Capacitor project, config, and the build script with its bundle check.
- [x] 7.2 The iOS and Android projects with portrait lock, the status bar, the privacy manifest, and the plugins.
- [x] 7.3 Icons and the splash from the game's art.
- [x] 7.4 The privacy policy page, the store listing, the data safety and age answers, and the release README.
- [x] 7.5 An Android debug build on this machine.

## 8. Cutscenes
- [x] 8.1 A cutscene player: a scripted camera over the live scene, letterbox bars, a caption, a sound, skip by tap, Space, Escape, or back, and a calm version with still shots and fades.
- [x] 8.2 The opening, the four arrivals, the four legend reveals, the legend landed shot, and the finale.
- [x] 8.3 Hold the fish, the clock, and the derby while a cutscene plays; never start one in a fight; remember the seen ones in the save.
- [x] 8.4 "Watch" on the Places card for seen arrivals and reveals.
- [x] 8.5 Tests: skip timing, the derby clock, seen once, old saves, calm, and screenshots at the four sizes.

## 9. Finish
- [ ] 9.1 Update the Reel It In part of `README.md`.
- [ ] 9.2 Run every Reel It In check and the review.
- [ ] 9.3 Record the checks that need a real iPhone, an Android phone, or a Mac.
- [ ] 9.4 Archive the change and review the canonical specs.
