# Store videos for Reel It In

The store kit has a Google Play promo video (`qa/fish/store-video.mjs`), and the App Store has no video. The App Store shows up to three app previews on the product page, before the screenshots, and plays them with no sound. Apple takes only screen captures of the app, with text over them. A preview for a 6.9" iPhone is 886 x 1920 in portrait, 15 to 30 s long.

## Scope

- Add `FORMAT=appstore` to `qa/fish/store-video.mjs`. It films the game in a 443 x 960 phone at 2x and puts the shots one after another, full screen, with short titles over the water. It ends on the game's own title screen.
- Give each format its own clips, frames, sound and file in the work folder, so one folder can make both videos.
- Encode the app preview to Apple's numbers: H.264 High Profile at Level 4.0, at most 12 Mbps, and stereo AAC at 256 kbps.
- Keep the phone's pixel ratio through each capture. The script captures from a CDP session of its own, and Chromium put back that session's screen after each capture, with no pixel ratio. After the first frame the game drew at 1x, and the capture scaled it up, so the Play video was soft. The same screen in the script's session keeps the ratio. Film the Play video again at its full 1.5x.
- Keep the game's input times on the page clock. Chromium stamps a synthetic event with the real clock, and the page runs on Playwright's fake clock. The game times the phone's motion samples and the thumb's lift by `event.timeStamp`. In the big phone a frame takes seconds of real time, so the samples of a whip fell outside the 450 ms that the game looks back, and the cast at Gull Rock failed. The script's synthetic events now read the page clock.
- Show the hour that each scene sets: the game draws its clock again only each 10 game minutes, so the script sets the hour just before such a mark.
- Describe both videos in `apps/fish/store/video.md` and `apps/fish/store/listing.md`, and add a requirement for the store videos to the store package spec. The Play video had none.

## Player-facing change

None in the game. The App Store product page can show the game in play.
