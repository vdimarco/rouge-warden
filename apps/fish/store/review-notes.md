# Notes for app review

Paste the text block into App Store Connect (App Review Information > Notes) and into Google Play (App content > App access > "All functionality is available without special access", and the release notes for testers if asked). Then read the checks under it.

## Text for the reviewer

```
Reel It In is a fishing game. The phone is the rod and the reel.

No account and no login. The game works offline and makes no network requests. It has no ads and no in-app purchases.

Motion is optional. On the first start the game asks how you want to play. Pick "Touch" to play sitting down: hold the reel at the bottom of the screen, drag down to tip the rod back, then flick up and let go to cast. Turn the crank on the left with your thumb to reel. When the fish strikes, flick up on the lake to set the hook.

With motion: hold the phone upright, keep your thumb on the reel, tip the phone back, and whip it forward. Lift your thumb as the phone passes 11 o'clock. A safety card asks the player to grip the phone and keep 2 m clear before the first motion cast.

To see a catch quickly: leave Easy mode on (Settings), cast into a ring of rising fish, and wait for the strike. The first cast of a new game always gets a bite.

Where things are: How to play, Journal, Places and Settings are on the title screen. The privacy policy is in Settings. The Android back button closes the top screen or pauses the game.

The app reads the motion sensors only inside the game. It does not use the camera, the microphone, location, contacts or photos.
```

## Checks before you send it

These lines depend on other work in `public/fish`. Read each one against the build you upload, and change the text if the game differs:

| Line | Depends on |
| --- | --- |
| The first-start choice of Touch or Motion, and the safety card | The current first-run flow (`main.js` setup screen). |
| "Turn the crank on the left" | The touch layout with the crank on the left. |
| "Flick up on the lake to set the hook" | The touch hook set. Name the gesture the game actually uses. |
| "The first cast of a new game always gets a bite" | The sure first bite for a fresh save. |
| "The privacy policy is in Settings" | A Privacy row in Settings that opens `privacy.html`. Apple 5.1.1 needs the policy inside the app. |
| "The Android back button closes the top screen or pauses the game" | The back button handling in `js/native.js` and `main.js`. |

## Facts behind the notes

- No network: `npm run check:www` fails on any file that loads another host, and `qa/fish/app-bundle.e2e.mjs` blocks and counts every request that leaves the origin. The count must be 0.
- No motion permission text: the iOS project has no `NSMotionUsageDescription`. Capacitor's web view grants the motion events to the page itself, and that key is only for Core Motion classes the app does not use.
- Haptics: the app uses `@capacitor/haptics` on iPhone and `navigator.vibrate` on Android (the `VIBRATE` permission).
- The screen stays awake while the player fishes (`@capacitor-community/keep-awake`), and sleeps again on the title and the pause screen.

## If a reviewer asks

| Question | Answer |
| --- | --- |
| Is this a repackaged website? (Apple 4.2) | No. It is a full game with four places, 26 species, legends, a derby and a journal, native haptics on iPhone, a native save copy in Preferences, the Android back button, a splash screen and screen-awake control. It runs offline from files inside the app. |
| Is swinging the phone safe? (Apple 1.4.5) | Motion play is optional, a safety card shows before the first motion cast, How to play and the store description say to grip the phone and keep 2 m clear, and touch play works sitting down. |
| Why does the Android app ask for INTERNET? | The Capacitor template includes it. The game makes no network requests. |
