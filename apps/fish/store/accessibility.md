# App Store accessibility labels

App Store Connect asks which Accessibility Nutrition Labels the app supports, for each device. Apple asks the developer to test each claim against its criteria for the common tasks of the app. A false label is worse than no label, so claim only what ships and passes the checks below.

For Reel It In, the common tasks are: start a game, cast, reel, fight and land a fish, open the Journal and the Places, change Settings, and read How to play.

## The labels

| Label | Claim? | Why |
| --- | --- | --- |
| Sufficient Contrast | **Yes**, after the check | The menus use light text on dark cards. The fish-store-polish change makes the gauge text larger. |
| Reduced Motion | **Yes**, after the check | The game follows the system Reduce Motion setting (`prefers-reduced-motion`), and Settings has "Calm effects" for the same result. |
| Differentiate Without Color Alone | **Yes**, after the check | The fish-store-polish change gives the gauge words and patterns as well as colours (SLACK, the rub band, the drag), and every prompt is a word. |
| Larger Text | Only if the in-game Text size setting ships | The game does not follow Dynamic Type. It needs its own Text size setting that makes the text at least 200% larger without clipped controls (Apple's criterion). If the setting stops below 200%, do not claim it. |
| Dark Interface | No | The menus are dark, but the lake is a bright day scene in most places. Apple's criterion is about a dark appearance for the whole app. |
| VoiceOver | No | The cast and the fight are motion and timing games on a 3D view. A VoiceOver user cannot do the common tasks. The buttons have labels, but that is not enough for the claim. |
| Voice Control | No | The controls are gestures and phone motion. |
| Captions | No claim needed | The game has no speech. The guide clips have no voice. |
| Audio Descriptions | No claim needed | The guide clips are short silent loops beside text that says the same thing. |

The same answers apply to iPhone. The app is built for iPhone only, but it runs on iPad in iPhone compatibility mode. Mac and Apple Vision Pro are turned off. Do a quick check on an iPad in compatibility mode before review (see the device checklist in `apps/fish/README.md`).

## The checks that back each claim

Run these on the build you submit. If one fails, take the label off until it passes.

### Sufficient Contrast

- Text: every text over 4.5:1 against its background (3:1 for text of 18 pt, or 14 pt bold, and larger). This covers the title menu, the cards, the HUD chip, the prompts, the gauge words and the toasts.
- On Linux: the contrast check that the menus and access work adds to `qa/fish/` (make sure it runs over each screen at 390x844, in both art styles, and passes), and the screenshots of every screen at the six sizes, checked by eye.
- On a phone: Settings > Accessibility > Display & Text Size > Increase Contrast on, then play one derby. Nothing must get harder to read.

### Reduced Motion

- With `prefers-reduced-motion: reduce` (in Playwright: `reducedMotion: "reduce"`) and with Calm effects on: no camera punch on the hook set, no zoom on a jump, no shake, no flashing; the catch card shows at once; the guide clips do not autoplay.
- On a phone: Settings > Accessibility > Motion > Reduce Motion on. Cast, hook and land a fish, and open the catch card and the derby results.

### Differentiate Without Color Alone

- In a fight, each gauge state has a word or a pattern as well as a colour: tension, the drag slipping, slack, the rub band and the tired fish.
- Prompts name the move ("Lower the rod", "Reel", "Steer left").
- Check: screenshots of a fight in grayscale (`page.emulateMedia` with a CSS `filter: grayscale(1)` on `html`, or the phone's Color Filters > Grayscale). Every state must still read.

### Larger Text (only if claimed)

- Set Text size to its largest value. Every screen at 360x640 and at 390x844 must show all its text with nothing clipped or covered, and every button must still work.
- On a phone: the largest Text size in Settings, then the title, the pause card, Settings, the Journal, How to play and a fight.

## Where to set them

App Store Connect > the app > App Information > Accessibility (per device: iPhone). Google Play has no such labels; the store listing can say "Play with touch or with motion" and "Easy mode".
