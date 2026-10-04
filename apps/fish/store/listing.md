# Store listing: Reel It In

The text for App Store Connect and the Google Play Console. Copy each field as it is. The character counts are checked with `node -e`, and each field is under its limit.

## Names

| Field | Text | Characters | Limit |
| --- | --- | --- | --- |
| App Store name | Reel It In: Lake Fishing | 24 | 30 |
| Google Play title | Reel It In: Lake Fishing | 24 | 30 |
| Name under the icon (both stores) | Reel It In | 10 | iOS shows about 12 |
| App Store subtitle | Cast and reel with your phone | 29 | 30 |
| Google Play short description | Your phone is the rod and the reel. Whip it to cast. Crank to reel in. | 70 | 80 |
| App Store promotional text | Fish four places, from a quiet lake to the open sea. Play with motion or with touch. No ads, no accounts, and no network needed. | 128 | 170 |

Why "Reel It In: Lake Fishing": the app "Reel It In - Movie List" (Foddershock Studio, `com.foddershock.reelitin`) already uses the plain name on both stores. Apple needs a unique name of 30 characters or fewer. The added words also help people find a fishing game. Before the first upload, check that the name is free in App Store Connect, and search the USPTO for "Reel It In" in classes 9 and 41.

The name under the icon comes from the app itself: `appName` in `capacitor.config.json`, `CFBundleDisplayName` in the iOS `Info.plist`, and `app_name` in the Android `strings.xml`.

## Full description

Use the same text on both stores (limit 4000 characters).

```
Your phone is the rod and the reel.

Hold the line with your thumb. Tip the phone back, whip it forward, and let go at eleven o'clock. The lure flies out over the water. Crank to reel it in.

A shadow follows the lure. Wait through the nibbles. When the fish strikes, snap the phone up to set the hook. Then fight the fish: raise the rod, reel as you lower it, and steer it away from the weeds and the stumps. When the drag buzzes, stop reeling, or the line snaps.

Fish four places: Loon Lake, Stump Bay, Cedar River, and Gull Rock. Each place has its own look, its own gear, and its own fish. Catch 26 kinds of fish, from a pumpkinseed to a muskellunge. Each place has one legend to find.

Play a ten-cast derby for a high score, or fish with no limit. Keep your best catches in the journal.

Play with motion, or play with touch while you sit down. Easy mode softens bad casts and gives you more time to set the hook.

The game works offline. It has no ads, no accounts, and no in-app purchases. It collects no personal data.

Grip the phone tight, and keep 2 m clear around you when you cast with motion.
```

Do not use the words Ghibli, Miyazaki, or "anime film" in any field or screenshot. Do not name other games or brands.

## Keywords (App Store only)

```
bass,cast,motion,trout,salmon,tuna,catfish,pike,walleye,derby,angler,rod,lure,offline,outdoor
```

93 of 100 characters. Apple already indexes the words in the name and the subtitle ("reel", "lake", "fishing", "phone"), so the keywords do not repeat them. Every fish word names a fish in the game: Big Blue, the legend at Gull Rock, is a tuna.

## Category

| Store | Primary | Secondary |
| --- | --- | --- |
| App Store | Games > Sports | Games > Simulation |
| Google Play | Games > Sports | (Play has one category) |

Reason: both stores put most fishing games in Sports. Reel It In is a short-session skill game with a score and a derby, not a full simulation with gear and boats. Simulation is a good second choice on the App Store, where a game can have two game subcategories.

Google Play tags (pick up to five in the Console): Fishing, Casual, Offline, Single player, Stylized.

## What's new

Version 1.0:

```
The first release of Reel It In.
```

## Other fields

| Field | Value |
| --- | --- |
| Price | Free. No ads. No in-app purchases. |
| Privacy policy URL | `https://<the site>/fish/privacy.html` (the owner sets the host; see the README) |
| Support URL | Owner decision. A page or a mail link with the support email. |
| Marketing URL | Optional. The web game at `https://<the site>/fish/` is a good choice. |
| Copyright | `2026 <owner name>` |
| Age rating | 4+ (Apple), Everyone and PEGI 3 (IARC). See `age-rating.md`. |
| Contact email for review | Owner decision. |
| Devices | iPhone only, iOS 16.4 or later (an iPad runs it in iPhone compatibility mode). Android 7.0 (API 24) or later, phones in portrait. |
| Mac and Apple Vision Pro | Off. The Xcode project sets `SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD = NO` and `SUPPORTS_XR_DESIGNED_FOR_IPHONE_IPAD = NO`, because the game needs motion sensors and a touch screen. Check the same boxes in App Store Connect. |

## Graphics

| File | Size | Use |
| --- | --- | --- |
| `apps/fish/resources/icon-only.png` | 1024 x 1024, RGB, no alpha | The App Store icon (Xcode takes it from the asset catalog). |
| `apps/fish/store/graphics/play-icon-512.png` | 512 x 512, 32-bit RGBA (every pixel opaque), under 1024 KB | The Google Play hi-res icon. Play asks for a 32-bit PNG with alpha. |
| `apps/fish/store/graphics/feature-graphic-1024x500.png` | 1024 x 500, RGB, no alpha | The Google Play feature graphic. |
| Screenshots | See `screenshots.md` | Both stores. |

`npm run art` (with `NODE_PATH=../../qa/browser/node_modules`) renders all three again from `scripts/render-art.mjs`.
