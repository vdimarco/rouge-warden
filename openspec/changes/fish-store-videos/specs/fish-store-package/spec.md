## ADDED Requirements

### Requirement: Store videos
`qa/fish/store-video.mjs` SHALL make two store videos from the store build of the game: a Google Play promo video and an App Store app preview. Every picture of the game SHALL be the game itself, filmed frame by frame, and every sound SHALL be a sound the game played, at the time it played it. The videos SHALL show no device and no brand. `apps/fish/store/video.md` SHALL say what each video shows, how to upload it, and how to make it again.

#### Scenario: Google Play promo video
- **WHEN** a developer runs the script with `public/` served
- **THEN** it writes an MP4 of 30 s to 2 min at 1920 x 1080 and 30 fps, H.264 with AAC. The game is on screen from the first second, and the titles say what the game is with the sound off.

#### Scenario: App Store app preview
- **WHEN** a developer runs the script with `FORMAT=appstore`
- **THEN** it writes an MP4 of 15 to 30 s at 886 x 1920 and 30 fps, H.264 High Profile at Level 4.0 or lower at no more than 12 Mbps, with stereo AAC at 256 kbps. Each picture is a full-screen capture of the game with text over it, and no other art.
