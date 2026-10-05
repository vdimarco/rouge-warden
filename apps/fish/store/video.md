# Promo video

The Google Play promo video: 31 s, 1920 x 1080 at 30 fps, H.264 with AAC sound. Play takes a YouTube link, not a file. `qa/fish/store-video.mjs` makes the video; the MP4 is not in git.

The game plays in phone panels on the painted water of the store art, and short titles move in beside it. Every picture in a panel is the real game, filmed frame by frame in the store build. Every sound is the game's own (`public/fish/js/audio.js`), at the moment the game played it.

## What it shows

| Time | Scene | Titles |
| --- | --- | --- |
| 0 to 5.8 s | A motion cast at Loon Lake at golden hour. The panel leans back and whips forward with the phone, and the lure flies out. | Your phone is the rod. Tip it back. Whip it forward. |
| 5.8 to 9.5 s | A bass follows the lure, nibbles it and strikes. The phone snaps up: "Fish on!" | Wait for the bite. Snap it up! |
| 9.5 to 14.3 s | The fight: a run against the drag, a leap, then the rod pumps the fish in. | Fight every run. Raise the rod. Reel as you lower it. |
| 14.3 to 19.5 s | The trophy photo: the push-in, the flash, gold sparks, and the card with NEW RECORD and TROPHY. | Land a trophy. |
| 19.5 to 24.9 s | Four phones, each casting at its place. | Fish four places. Loon Lake, Stump Bay, Cedar River, Gull Rock. |
| 24.9 to 27.9 s | Motion play beside touch play, with a finger on the crank. | Play with motion or touch. |
| 27.9 to 31.3 s | The end card: the bobber of the feature graphic, its rings, and the title. | REEL IT IN. Your phone is the rod and the reel. No ads · No accounts · Plays offline. |

"REEL IT IN" stays in the top left corner until the four places come up.

## Upload it for Google Play

1. Upload the MP4 to YouTube. Set it to Public or Unlisted, keep embedding on, turn off ads (no monetization), and set no age restriction.
2. In the Play Console, open Grow > Store presence > Main store listing. Under Graphics, paste the video's YouTube URL in Video. Use the plain watch URL, not a playlist or a Short.
3. Play shows the feature graphic (`store/graphics/feature-graphic-1024x500.png`) as the video's cover.

## Rules it keeps

- Landscape, 16:9. Play shows game videos in landscape.
- The game is on screen from the first second, and most of the video is the game itself.
- Play can play up to 30 s with no sound. The titles carry the message without sound, and the end card starts before 30 s.
- No other device and no brand: the phones are plain panels with no maker's marks. The words Ghibli, Miyazaki and "anime film" never show.

## Make it again

From the repository root, with `public/` served (for example `python3 -m http.server 8765 --directory public`):

```sh
NODE_PATH=qa/browser/node_modules node qa/fish/store-video.mjs
```

It needs ffmpeg, and about 20 minutes with software WebGL. It writes `reel-it-in-promo.mp4` in its work folder (`OUT`, by default `<tmp>/fish-video`). It runs in four passes:

1. film: each clip is the game on Playwright's fake clock, one frame each 1/30 s, in a 360 x 640 phone (at 1.5x, or 1.2x for the four places). The casts are real motion casts with the virtual phone. The strike, the fight and the catch are staged with the game's test hooks, as in `store-shots.mjs`.
2. cut: a page lays out the panels, the titles and the end card, one screenshot a frame.
3. sound: the sounds the game asked for in each clip, rendered by `renderOffline` and mixed on the video's timeline, over the sound of each place.
4. mp4: ffmpeg joins the frames and the sound, at -16 LUFS.

`STEPS=cut,sound,mp4` runs again from the filmed clips, `CLIPS=fight` films one clip again, and `STEPS=cut STILLS=8.1,15.7` draws only those moments, to look at. After a change to the game, film again and watch the whole video: a run that ends well says nothing about how it looks.
