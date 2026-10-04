# Reel It In as an app of its own

The Cottage Arcade ships Reel It In at `/fish/`, inside the arcade. The owner wants to publish that game alone on Google Play. The Android app is a Trusted Web Activity (TWA) that shows `/fish/` and nothing else. The Android project has its own change. This change makes the web page ready for it: the page is self-contained, installable, and works offline, and it has an app mode with no way into the rest of the arcade.

## Scope

- Put everything the page needs in `public/fish/`: three.js r170, the two fonts, the icons. After this change nothing in `public/fish/` loads from another origin. The one file from outside the folder is `/arcade/quiet.js` (same site), which stops the sound of a hidden page.
- Add a web manifest, icons that read at 48 px, and a privacy page.
- Add an app mode. The Play app and the installed web app hide every link to the arcade and use words for a phone and for Android.
- Add a service worker for app mode. After the first visit the game starts with no network, and a video can seek, offline. The website does not register it.
- Add a Back button that does not close the app in the middle of a fight.
- Add Settings rows for Privacy (a short card) and Reset progress. In app mode, ask the browser to keep the storage.
- Add `qa/fish/pwa.mjs` and a CI workflow for its `--static` part.

## Not in scope

- The Android project: `twa-manifest.json`, signing, the build script, `assetlinks.json` and the header rule in `vercel.json`. The Android change owns them.
- Game rules, tuning, art, and the ids and storage keys of the game.
- The store listing, the Play Console forms, and the closed test.

## Player-facing change

On the website nothing a player knew changes: it has no service worker, and only the Play app counts as the Android app that turns app mode on. Settings gets two rows (Privacy and Reset progress) and the title gets a small Privacy link. In the app the title shows the name of the place alone, the menus have no Switch game, Back to the arcade, or Fullscreen button, and the Back button pauses and resumes before it closes the app.

## Decisions the owner can change in one place

| Decision | Where it lives |
| --- | --- |
| App name "Reel It In", colour `#0d2f38`, `display` standalone, `orientation` portrait | `public/fish/manifest.webmanifest` |
| Web start URL `/fish/?source=pwa` | the manifest. The Play start URL `/fish/?source=play` is in the Android change |
| Host `warden-alpha-wheat.vercel.app` | the `og:url` and `og:image` tags of `index.html` (a custom domain needs no other web file to change) |
| App version `1.0.0` | the first number of `VERSION` in `public/fish/sw.js` |
| Contact email | `OWNER_CONTACT_EMAIL` in `public/fish/privacy.html` |
| Android route to the site settings | `APP_TEXT.denied` in `public/fish/js/main.js` |

## Open items

- UNCONFIRMED, no device test yet: the Android route to the site settings in the "motion sensors are off" note; that `navigator.storage.persist()` is granted in the TWA; what happens to the save when the app is uninstalled.
- DEVICE: the real Back button in a TWA (Chrome's history rule), the `display-mode` signal in a TWA, the real event rate of the sensors, the safe area and the cutout at API 36, and a WebGL draw after ten minutes in the background.
- Owner: the contact email, the target audience (the privacy page says "not for children under 13"), and the final domain.
- Validation with the OpenSpec CLI did not run: the CLI is not installed.
