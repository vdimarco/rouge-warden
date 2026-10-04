# Store screenshots

The shots to take, the sizes each store needs, and two ways to make them. Save them as PNG with no alpha (RGB) in `apps/fish/store/screenshots/<slot>/`, for example `store/screenshots/iphone-6.9/01-title.png`.

## Sizes

| Slot | Size (portrait) | CSS viewport at 3x | Needed? |
| --- | --- | --- | --- |
| iPhone 6.9" | 1320 x 2868 | 440 x 956 | Yes. App Store Connect scales it down for the smaller iPhones. 1 to 10 shots. |
| iPhone 6.5" | 1284 x 2778 | 428 x 926 | Only if there is no 6.9" set. Make it anyway, so both are ready. |
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
| 2 | `02-cast.png` | A motion cast in flight: the lure in the air over the water, the aim line, and the rod. | The main idea: the phone is the rod. |
| 3 | `03-strike.png` | The strike prompt with the shadow under the lure. | The moment to set the hook. |
| 4 | `04-fight.png` | A fight with the gauge, the crank and a jumping smallmouth bass. | The fight and its controls. |
| 5 | `05-trophy.png` | A trophy catch photo with the TROPHY badge and the ruler. | The reward. |
| 6 | `06-journal.png` | The Journal tab for Loon Lake with several fish found. | Collection and goals. |
| 7 | `07-places.png` | The Places card with all four places, Gull Rock in view. | Variety. |
| 8 | `08-touch.png` | A touch-play fight, crank on the left, rod pad on the right. | Motion is optional. Apple 1.4.5 and the review notes. |

## Way 1: render them with Playwright (Linux or a Mac)

This is the quickest way, and it gives exact sizes. The game draws WebGL in software (SwiftShader) here, so it can lower its render scale; force full quality while you capture.

1. Build and serve the bundle: `npm run build:www`, then serve `apps/fish/www` on a free port, for example `python3 -m http.server 8790 --directory www`.
2. Open it in Chromium with Playwright at the CSS viewport from the table, `deviceScaleFactor: 3`, `isMobile: true`, `hasTouch: true`, and a fake `window.Capacitor` (see `qa/fish/app-bundle.e2e.mjs`), so the store build shows.
3. Use the game's QA hooks (`window.FISH` and the URL flags such as `?open` and `?day=`) to reach each scene. The game needs a screenshot flag that forces Graphics High and the full device pixel ratio while it captures; until that lands, check by eye that the lake is not blurry.
4. Take each shot with `page.screenshot({ type: "png" })`, then flatten it and check its size:

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
