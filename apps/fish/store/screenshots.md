# Store screenshots

The shots to take, the sizes each store needs, and two ways to make them. Save them as PNG with no alpha (RGB) in `apps/fish/store/screenshots/<slot>/`, for example `store/screenshots/iphone-6.9/01-title.png`.

The Android set is ready in `store/screenshots/android/`: the eight shots below at 1080 x 1920, made with `qa/fish/store-shots.mjs` (Way 1). The App Store sets are ready too, the same eight shots in each, made with Way 1: `store/screenshots/iphone-6.9/` (1320 x 2868), `store/screenshots/iphone-6.5/` (1284 x 2778) and `store/screenshots/ipad-13/` (2064 x 2752).

## Sizes

| Slot | Size (portrait) | CSS viewport at 3x | Needed? |
| --- | --- | --- | --- |
| iPhone 6.9" | 1320 x 2868 | 440 x 956 | Yes. App Store Connect scales it down for the smaller iPhones. 1 to 10 shots. |
| iPhone 6.5" | 1284 x 2778 | 428 x 926 | Only if there is no 6.9" set. Make it anyway, so both are ready. |
| iPad 13" | 2064 x 2752 | 1032 x 1376 at 2x | Yes, now that the app runs on iPad. App Store Connect scales it down for the smaller iPads. 1 to 10 shots. The Mac uses the iPad set. |
| Android phone | 1080 x 1920 | 360 x 640 | Yes. 2 to 8 shots. Give at least 4, each side 1080 px or more, so Play can feature the app. |

Rules to keep:

- Play needs each side between 320 and 3840 px, and the long side at most twice the short side. **1080 x 2400 (9:20) is too long for Play.** Use 1080 x 1920 (9:16), or 1080 x 2160 (2:1) at most.
- No alpha channel. Flatten on `#0d2f38` if a tool adds one.
- Show the game as it plays. No device frames are needed. Short captions on top are allowed on both stores; if you add them, keep them in the style of `listing.md` and do not cover the HUD.
- Show the store build (`data-build="store"`), so no "Switch game" or arcade link shows.
- Never show the words Ghibli, Miyazaki or "anime film", and no other brand.
- The iPhone set must not show Android parts, and the Android set must not show iPhone parts (a notch is fine).

## The shots

In this order, for every slot:

| # | File | What it shows | Why |
| --- | --- | --- | --- |
| 1 | `01-title.png` | The title at Loon Lake in the Painted style, with "Go fishing" first. | The first look at the game. |
| 2 | `02-cast.png` | A motion cast in flight: the lure in the air over the water, the line, and the rod. The aim line shows only before the cast, so it is not in this shot. | The main idea: the phone is the rod. |
| 3 | `03-strike.png` | The strike prompt with the shadow under the lure. | The moment to set the hook. |
| 4 | `04-fight.png` | A fight with the gauge, the crank and a jumping smallmouth bass. | The fight and its controls. |
| 5 | `05-trophy.png` | A trophy catch photo with the TROPHY badge and the ruler. | The reward. |
| 6 | `06-journal.png` | The Journal tab for Loon Lake with several fish found. | Collection and goals. |
| 7 | `07-places.png` | The Places card with all four places, Gull Rock in view. | Variety. |
| 8 | `08-touch.png` | A touch-play fight, crank on the left, rod pad on the right. | Motion is optional. Apple 1.4.5 and the review notes. |

## Way 1: render them with Playwright (Linux or a Mac)

This is the quickest way, and it gives exact sizes. The game draws WebGL in software (SwiftShader) here, so it can lower its render scale. The `?shot` flag stops that: it sets Graphics High, draws the lake at up to 3x, and turns off the automatic render scale.

1. From the repository root, serve `public/`, for example `python3 -m http.server 8765 --directory public`. On another port, set `FISH_URL`, for example `FISH_URL=http://127.0.0.1:8790/fish/`.
2. Run `NODE_PATH=qa/browser/node_modules node qa/fish/store-shots.mjs`. It makes the eight shots of the table for the Android slot in `store/screenshots/android/`, as RGB PNGs at the exact size, and it checks each scene (for example, that the catch card has the TROPHY badge). `SLOTS=iphone-6.9,iphone-6.5,ipad-13` makes the iPhone and iPad sets, and `OUT=<dir>` writes them to another folder. It needs `npm ci` in `apps/fish` first, for `sharp`.
3. Look at every picture. The script stages each scene with the game's QA hooks (`window.FISH`): a save with every place open and fish in the journal, a real motion cast with the virtual phone, and stand-ins for the strike, the fight and the catch. A change to the game can move a scene, so a check that passes is not enough.

For another scene, `qa/fish/shots.mjs` saves every screen of the store build at the sizes in `SIZES` (for example `SHOTS=<dir> SCALE=3 SIZES=360x640`), and `store-shots.mjs` shows how to stage one. A picture from another tool may need flattening. Flatten it and check its size:

```sh
node -e "const s=require('./node_modules/sharp');s('in.png').flatten({background:'#0d2f38'}).removeAlpha().png().toFile('out.png')"
python3 -c "import sys,struct;d=open(sys.argv[1],'rb').read(32);print(struct.unpack('>II',d[16:24]),'colour type',d[25])" out.png
```

The colour type must be 2 (RGB), and the size must match the table.

## Way 2: take them on real phones

- iPhone 16 Pro Max, 17 Pro Max or another 6.9" iPhone gives 1320 x 2868 with the side button and volume up. An iPhone 11 Pro Max or XS Max gives 1242 x 2688, which App Store Connect also takes for the 6.5" slot.
- On Android, a 1080 x 2400 phone gives a shot that is too long for Play. Crop it to 1080 x 1920 around the action, or use the emulator or Way 1.
- Turn on Airplane mode and Do Not Disturb, so the status bar is clean. The game hides the status bar anyway.

## Check before upload

- Every file has the exact size of its slot and colour type 2.
- No arcade parts, no debug overlay (`?debug` off), no QA text.
- The order matches the table, and shot 8 shows touch play.
