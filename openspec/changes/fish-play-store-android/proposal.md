# Publish Reel It In alone on Google Play, as an Android app

The owner wants to publish the phone fishing game "Reel It In" (`/fish/`) on Google Play as its own app. The repository already ships a similar app for Meta Quest (`quest/`, `public/vr/`). That app uses Meta's fork of Bubblewrap and forces SDK 34, so it cannot serve as the Play build. This change adds the Android side for Google Play: the app settings, a scripted and repeatable build that makes a signed bundle, the Digital Asset Links tool, a manual GitHub workflow, a test, and the owner's guide.

The web side (the web manifest, the service worker, the self-hosted three.js and fonts, the privacy page, the icons, and the hidden arcade links inside the app) is a separate change by the "web" package. This change lists what it needs from that package and does not edit its files.

## Scope

- `play/fish/twa-manifest.json`: the settings of a Trusted Web Activity for upstream `@bubblewrap/cli` 1.25.0. Package `com.cottagearcade.reelitin`, scope `/fish/`, start URL `/fish/?source=play`, standalone, portrait, minSdk 24, no notification, no feature, no Android permission.
- `play/fish/build-aab.sh`, `patch-android.mjs`, `verify-output.mjs`: install a pinned toolchain into `play/.tools`, generate the Android project, patch it, build a signed bundle (`.aab`) and APK, check both, and print the upload key fingerprint.
- `play/fish/assetlinks.mjs`: add, remove, print and check the app's entry in `public/.well-known/assetlinks.json`.
- `.github/workflows/play-aab.yml`: a manual workflow that builds a signed bundle from repository secrets.
- `qa/fish/play.mjs`: a test in node only that proves every check can fail.
- `play/fish/README.md`: the owner's guide from the Play account to the closed test, with the answers for the Play forms, the update rules, the `adb` log reading, and the DEVICE checklist.
- A section "Reel It In on Google Play" and a test row in `README.md`.

## Out of scope

- Any file under `public/fish/` (the web package makes them) and `play/fish/make-icons.mjs` and `play/fish/stamp-sw.mjs`.
- The Meta Quest app. This change does not touch `quest/`. Its placeholder fingerprint in `assetlinks.json` stays, and the tools warn about it (see the design).
- The Play listing texts and graphics, the account, the upload to the Console, and any promise about Google's review.
- A custom domain. The host is one value per file type, so the owner can move before the first upload.

## Decisions already made

Package id `com.cottagearcade.reelitin`. Host `warden-alpha-wheat.vercel.app`. Web start URL `/fish/?source=pwa`, app start URL `/fish/?source=play`. Display standalone. Orientation portrait. minSdk 24. compileSdk and targetSdk 36. Name "Reel It In". Colour `#0d2f38`. Category games. No notification, no location, no microphone, no Android permission.

## Player-facing result

A player installs "Reel It In" from Google Play. The game opens at once, in portrait, with no URL bar and no link to the arcade. After one start with a network, it starts again with no network. The app asks for no permission. The motion sensors, the buzz and the screen wake lock come from Chrome.

## Not proven

Nobody has run the app on a phone. The build ran in a sandbox only. The GitHub workflow has not run. `design.md` and `tasks.md` list every UNCONFIRMED and DEVICE item. The OpenSpec CLI is not installed, so `openspec validate` did not run.
