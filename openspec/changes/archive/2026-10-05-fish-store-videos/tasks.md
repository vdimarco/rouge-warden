# Tasks

- [x] Add `FORMAT=appstore` to `qa/fish/store-video.mjs`: the phone size, the shots, the titles, the sound and the encoding.
- [x] Film the clips, and look at a still of each title.
- [x] Make the app preview, and check it with ffprobe and a frame sheet.
- [x] Keep the pixel ratio through each capture, and check it in a frame.
- [x] Film the Play promo video again, and check its length, its mix and a frame against the first one.
- [x] Describe the app preview in `apps/fish/store/video.md` and `apps/fish/store/listing.md`.
- [x] Validate the change with the OpenSpec CLI.
- [x] Archive the change.

## Checks

- App preview (`FORMAT=appstore`): ffprobe gives H.264 High at Level 4.0, 886 x 1920, 30 fps, 882 frames, 29.4 s, 10.1 Mbps video, and AAC LC stereo at 48 kHz and 257 kbps. The mix is -16.1 LUFS. Frame sheets of the final MP4 show each title clear of the game's prompts, the hour each place sets, and the trophy card with NEW RECORD and TROPHY.
- Play video: 1920 x 1080, 30 fps, 31.2 s (the new cast lands 0.13 s sooner, so each scene starts that much sooner). The same 61 sounds and loops, -16.3 LUFS. A crop of the phone panel is sharper than in the first video.
- The Play mix from the new sound code, on the first clips, matched the first mix: 11,620 samples differ by at most 4e-7.
- A frame of each format is at its full size: the lake stays at 886 x 1920 in the 2x phone through a clip.
- Gull Rock failed twice in the 2x phone before the timeStamp fix ("Swing the phone forward"), and cast well after it.
- Not checked: playback on an iPhone, and an upload to App Store Connect or YouTube.
