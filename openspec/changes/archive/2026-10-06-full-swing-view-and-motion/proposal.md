# In Full Swing: a higher camera, a steady mouse look, fluid hero motion and an opening you can look around in

## Why

The player played the merged build on desktop and said:
- "How can we avoid the mouse getting caught at the edge of the screen?"
- "The view's a bit funky. It's a bit too low. I think we need to be above the character rather than below."
- "The climbing animation needs to be improved. It should move like a real mountain climber or Spiderman."
- "The walking and running animation needs to be significantly improved. Character looks clunky. Animation should be fluid and seamless."
- "The user should be able to look around during the opening video."
- "I'm still not hearing any sound. Or music."

The chase camera orbited with the mouse pitch, so looking up put it at chest height or under the hero. The PLAY click asked for full screen before the pointer lock, which some browsers refuse or do not capture, and with no lock the mouse did nothing. The run was a sine wave whose feet slid about a metre a stride. The climb only raised the hands. In the desktop opening the mouse could tilt the view but not turn it. The music waited for the end of the tutorial.

## What changes

- **Camera (flat play):** the arm hangs from a pivot over the head and always points up from it. The default view looks down 20 degrees from about 1.9 m over the eyes; the hero sits in the lower middle with the aim just over the head. Looking up lowers the camera toward a floor 0.45 m over the eyes, never under it. The look-up limit is 25 degrees in third person, and a view left past it eases back in.
- **Mouse look:** the PLAY and RESUME clicks ask for the pointer lock first, then full screen; a Mac takes the lock again after full screen starts. Raw mouse movement where the browser has it. With no lock, the cursor still turns the view, the screen edges keep turning it, a caption says "Click to look around", and that click fires no rope.
- **Climbing:** both hands and both feet hold points on the wall and stay put while the body moves; they step in diagonal pairs (a hand with the opposite foot); the chest stays close, the knees go out wide, the head looks along the climb; it rests with all four held, and the mantle is drawn as a pull over the edge.
- **Walk and run:** motion capture (CMU walk, jog and run; Quaternius idle; see public/vr/anim/CREDITS.md) baked onto the hero's rig, blended by ground speed with one shared phase and a rate matched to the speed, so a planted foot keeps still. The air, swing, landing, rope arm and head look stay on top.
- **Opening:** the mouse turns the head inside the cottage room, as a headset would; the turn carries into play.
- **Sound:** the music starts with play instead of after the tutorial. Subtitles and toasts move to the top of the screen, clear of the hero.
- Version 1.7.1 (Quest APK code 7), after main's 1.7.0 (the auto target, #191). The motion file is in the offline cache.

## Out of scope

Story, cutscenes, clearer missions and the onboarding checklist (their own change). Street life (change full-swing-street-life).
