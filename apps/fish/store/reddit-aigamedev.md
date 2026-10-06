# r/aigamedev launch post

Post type: Video. Upload `reel-it-in-app-preview.mp4` (portrait, 29 s). Add the text below as the body.

## Title

```
I made a fishing game where your phone is the rod. Code by Claude Code, art by image and 3D models.
```

## Body

```
Reel It In is a fishing game for phones. You hold the line with your thumb, tip the phone back, and whip it forward to cast. You crank to reel in. When a fish strikes, you snap the phone up to set the hook. You can also play with touch if you sit down.

There are four places (a lake, a swamp bay at night, a river, and a sea rock), 26 kinds of fish, and one legend at each place.

Play it in the browser on your phone: https://arcade.uptick.systems/fish/
The Android version is in testing on Google Play now.

How I made it:

- Code: Claude Code wrote all of it. It is plain JavaScript and Three.js, with no engine. Capacitor wraps it for Android and iOS.
- Art: the painted sky, the trees and the title art came from image models (a GPT image model through Higgsfield). The lake water tile came from Nano Banana Pro on fal.
- 3D: the rod, the reel, the lure, the trees, the cottage and the loon are Blender meshes from Higgsfield 3D Jutsu. The fish are procedural meshes, so they can bend and swim.
- Sound: there are no sound files. Every sound is made in code with Web Audio: the reel, the drag, the splash, the loons and the surf.
- Testing: Playwright bots play the game in a headless browser. They cast, fight fish, and check that no message covers the lure on 9 screen sizes. The trailer is the game itself, filmed frame by frame by a script.

What was hard for the AI: the feel of the cast. A motion cast must read a real phone's motion sensors, and a headless test cannot hold a phone. I tested on a phone again and again, and told it what felt wrong.

No ads, no accounts, no in-app purchases. It works offline.

I want to know what you think, most of all about the cast and the fight.
```

## Before you post

- Read the subreddit rules in the sidebar. Some subs allow self-promotion only on given days or in a weekly thread.
- Use the flair for a finished game or a showcase, if the sub has one.
- Stay for the first hour and answer comments. Questions about the workflow get the most interest on this sub.
- The video still shows the old message placement from before version 1.0.1. To film it again with the new layout takes about 45 min.
