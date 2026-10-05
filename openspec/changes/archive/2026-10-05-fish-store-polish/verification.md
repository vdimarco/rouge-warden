# Verification

## Spec structure

`openspec validate fish-store-polish --type change --strict` passes. The change has 9 capabilities, 62 requirements and 112 scenarios.

## Checks on the final code

All checks ran on Linux with headless Chromium on SwiftShader, one at a time. A check that failed once was run again one time.

On the fix branch (`daee906`, before main's #201 and the last two small fixes), every check passed with no rerun:

- Node: all 10 `qa/fish/*.test.mjs` files (motion 133, save 226, release 27, cutscenes 20, and the rest), the 4 sims (cast, fight, journey, places), `check-www.test` (61) and `native-check.test` (12), and the pinball lab's `tilt.sim`.
- Browser: `boot.e2e` (twice, 91 checks), `flow`, `mouse.e2e`, `turnaround.e2e`, `moments.e2e`, `travel`, `reel.ui` (163), `desk`, `motion.e2e` (19), `menus.e2e`, `touch.e2e`, `cutscenes.e2e` (twice, 75 checks), `screens` (369), `fish.render` (515), `world.render` (106 shots), `cartoon.render`, `audio.render`, `places.map` and `app-bundle.e2e` (15).
- `shots.mjs` at 390x844 and 360x640 for the store build: 22 pictures at each size, and the layout scan found no problems.

Then main's #201 (a press anywhere loads the rod) was merged in, with the two small fixes below. On that merged tree, all Node tests, sims and app script tests, `tilt.sim`, `boot.e2e`, `flow`, `mouse.e2e` and `turnaround.e2e` passed with no rerun. The other browser checks were still running on the merged tree when this change was archived.

## How the scenarios were checked

| Capability | Main checks |
| --- | --- |
| fish-boot | `boot.e2e`, `app-bundle.e2e`, `render-scale.test` |
| fish-app-shell | `boot.e2e` (store part), `app-bundle.e2e`, `menus.e2e` |
| fish-casting | `cast.sim`, `release.test`, `touch.e2e`, `mouse.e2e`, `turnaround.e2e`, `motion.e2e`, `motion.test` |
| fish-fight | `fight.sim`, `places.sim`, `pull.test`, `line.test`, `reel.ui`, `screens` |
| fish-goals | `journey.sim`, `save.test`, `screens`, `moments.e2e` |
| fish-feedback | `moments.e2e`, `screens`, `haptics.test`, `audio.render`, `fish.render` |
| fish-menus-access | `menus.e2e`, `mouse.e2e`, `screens`, `words.test`, `desk` |
| fish-cutscenes | `cutscenes.test`, `cutscenes.e2e` |
| fish-store-package | `check-www.test`, `native-check.test`, `app-bundle.e2e`, `shots.mjs` |

## Reviews

- The final integration review and the store app review found 8 problems (tasks 10.1 to 10.7). All are fixed (#197).
- The player review played seven journeys at 390x844, 360x640, 844x390 and 1280x800, and in the store build. It found 15 problems. All are fixed (#198 and this change). One fix changes a settled design note: after "Nothing this time" a press on the drawn rod now goes on into the next cast, because the owner asked for a quick turnaround.
- Two reviewers then read the whole diff, one for code faults and one for the player's words and the docs. Each reproduced what it reported. They found 15 problems, 10 of them different. All 10 are fixed, with a check for each.
- The last full check run found 2 more problems: the Fish moves list opened out of view at 360x640, and the motion pull meter said "Tip back as you reel" while the prompt said to stop reeling. Both are fixed, and `menus.e2e` checks the first one.

## Checks that could not run

- No real iPhone, Android phone, iPad or Mac was available. Touch used Playwright's mobile emulation. The mouse and the keys used synthetic events. Motion used the virtual phone in `qa/fish/lib.mjs`.
- No sound came through speakers. `audio.render` checks the sound offline.
- No vibration ran on a device. `haptics.test` checks the patterns in Node.
- The Android emulator could not run, because the machine has no KVM. The debug APK was built and checked with `aapt2`, but it was not installed on a phone.
- The iOS project was not built, because that needs a Mac with Xcode.

## Before release

- Do every item in the device checklist in `apps/fish/README.md` ("Device checklist") on a real iPhone and a mid-range Android phone.
- Make the owner decisions in `apps/fish/README.md` ("Owner decisions still open"): the bundle ID, a check of the store name, the support email in `public/fish/privacy.html`, the privacy policy URL, the Google Play account type, and the content rating and audience. The release build (`--release`) fails until the support email is in place.
