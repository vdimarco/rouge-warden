# Store videos

`qa/fish/store-video.mjs` makes two videos of Reel It In. The MP4 files are not in git.

| Video | Store | Picture | Length |
| --- | --- | --- | --- |
| Promo video | Google Play, as a YouTube link | 1920 x 1080, landscape | 31 s |
| App preview | App Store, as a file | 886 x 1920, portrait | 29.4 s |

Both are 30 fps, H.264 with AAC sound. Every picture of the game is the store build of the game itself, filmed frame by frame. Every sound is the game's own (`public/fish/js/audio.js`), at the moment the game played it.

## Google Play promo video

The game plays in phone panels on the painted water of the store art, and short titles move in beside it.

| Time | Scene | Titles |
| --- | --- | --- |
| 0 to 5.7 s | A motion cast at Loon Lake at golden hour. The panel leans back and whips forward with the phone, and the lure flies out. | Your phone is the rod. Tip it back. Whip it forward. |
| 5.7 to 9.4 s | A bass follows the lure, nibbles it and strikes. The phone snaps up: "Fish on!" | Wait for the bite. Snap it up! |
| 9.4 to 14.2 s | The fight: a run against the drag, a leap, then the rod pumps the fish in. | Fight every run. Raise the rod. Reel as you lower it. |
| 14.2 to 19.4 s | The trophy photo: the push-in, the flash, gold sparks, and the card with NEW RECORD and TROPHY. | Land a trophy. |
| 19.4 to 24.8 s | Four phones, each casting at its place. | Fish four places. Loon Lake, Stump Bay, Cedar River, Gull Rock. |
| 24.8 to 27.8 s | Motion play beside touch play, with a finger on the crank. | Play with motion or touch. |
| 27.8 to 31.2 s | The end card: the bobber of the feature graphic, its rings, and the title. | REEL IT IN. Your phone is the rod and the reel. No ads · No accounts · Plays offline. |

"REEL IT IN" stays in the top left corner until the four places come up.

### Upload it

1. Upload the MP4 to YouTube. Set it to Public or Unlisted, keep embedding on, turn off ads (no monetization), and set no age restriction.
2. In the Play Console, open Grow > Store presence > Main store listing. Under Graphics, paste the video's YouTube URL in Video. Use the plain watch URL, not a playlist or a Short.
3. Play shows the feature graphic (`store/graphics/feature-graphic-1024x500.png`) as the video's cover.

### Rules it keeps

- Landscape, 16:9. Play shows game videos in landscape.
- The game is on screen from the first second, and most of the video is the game itself.
- Play can play up to 30 s with no sound. The titles carry the message without sound, and the end card starts before 30 s.

## App Store app preview

The game fills the picture, one shot after another, and the preview ends on the game's own title screen. The titles of the cast and the places sit in the band of sky. In the strike, the fight and touch play, the game shows its own prompts in that band, so those titles sit just below them.

| Time | Scene | Titles |
| --- | --- | --- |
| 0 to 5.6 s | A motion cast at Loon Lake at golden hour: the thumb holds the line, the rod tips back and whips forward, and the lure flies out. | Your phone is the rod. |
| 5.6 to 9.3 s | A bass follows the lure, nibbles it and strikes. The rod snaps up: "Fish on!" | Wait for the bite. Snap it up! |
| 9.3 to 14.1 s | The fight: a run, a leap, then the rod pumps the fish in. | Fight every run. |
| 14.1 to 18.7 s | The trophy photo: the push-in, the flash and the card. | Land a trophy. |
| 18.7 to 24.1 s | Four places, 1.35 s each: a lure comes down on the water of each place. | Fish four places, and the name of each place. |
| 24.1 to 26.5 s | Touch play: a ring shows the finger on the crank. | Or play with touch. |
| 26.5 to 29.4 s | The title screen of Loon Lake. | No ads · No accounts · Plays offline |

### Upload it

1. In App Store Connect, open the app, then the version under iOS App.
2. In Previews and Screenshots, choose iPhone, then the 6.9" display. Drag the MP4 into the well. The preview plays before the screenshots.
3. Set the poster frame: the picture the App Store shows before the video plays. The trophy card at about 18 s, with its NEW RECORD and TROPHY badges, works well.
4. Processing can take up to 24 hours. App Store Connect scales the 6.9" preview down for the smaller iPhones.

Each size and language can have up to three previews.

### Rules it keeps

- Apple's numbers: 886 x 1920 in portrait, 15 to 30 s, 30 fps, H.264 High Profile at Level 4.0 at no more than 12 Mbps (Apple aims at 10 to 12), and stereo AAC at 256 kbps and 48 kHz.
- Only screen captures of the game, with text over them (App Review Guideline 2.3.4). There is no device frame and no hand. A ring shows where the finger touches.
- The App Store plays previews with no sound, so the titles carry the message.

## Both videos

- No other device and no brand: the phones in the Play video are plain panels with no maker's marks. The words Ghibli, Miyazaki and "anime film" never show.
- The store build of the game: no arcade text, and today's goal is done, so no goal toast covers a scene.

## Make them again

From the repository root, with `public/` served (for example `python3 -m http.server 8765 --directory public`):

```sh
NODE_PATH=qa/browser/node_modules node qa/fish/store-video.mjs
FORMAT=appstore NODE_PATH=qa/browser/node_modules node qa/fish/store-video.mjs
```

It needs ffmpeg. With software WebGL the Play video takes about 30 minutes and the app preview about 45. Each writes its MP4 in the work folder (`OUT`, by default `<tmp>/fish-video`): `reel-it-in-promo.mp4` and `reel-it-in-app-preview.mp4`. Each format keeps its own clips, frames and sound there. It runs in four passes:

1. film: each clip is the game on Playwright's fake clock, one frame each 1/30 s. The Play video films a 360 x 640 phone at 1.5x (1.2x for the four places), and the app preview a 443 x 960 phone at 2x. The casts are real motion casts with the virtual phone. The strike, the fight and the catch are staged with the game's test hooks, as in `store-shots.mjs`.
2. cut: a page lays out the shots, the titles and the end card, one screenshot a frame.
3. sound: the sounds the game asked for in each clip, rendered by `renderOffline` and mixed on the video's timeline, over the sound of each place.
4. mp4: ffmpeg joins the frames and the sound, at -16 LUFS.

`STEPS=cut,sound,mp4` runs again from the filmed clips, `CLIPS=fight` films one clip again, and `STEPS=cut STILLS=8.1,15.7` draws only those moments, to look at. After a change to the game, film again and watch the whole video: a run that ends well says nothing about how it looks.
