# Table Tennis design

## Camera and ball read

The view sits behind the bat. Eye height is 0.5 m above the table. The far end of the table is drawn at about 45% of the near end's width, so the table reads in one-point perspective and fills the lower part of a 390x844 screen. Score and the recenter control stay in the top 56 px. Arcade links stay in the bottom 56 px.

Height is read from a shadow on the table, the same cue described for 2D ball games in [How can I give the illusion of height to a ball in 2D?](https://gamedev.stackexchange.com/questions/123602/how-can-i-give-the-illusion-of-height-to-a-ball-in-2d) and used by the 2D tennis prototype at [YWBK/tennis_game](https://github.com/YWBK/tennis_game): the shadow sits on the table under the ball, and it gets smaller and darker as the ball drops. A spin stripe on the ball shows topspin and backspin.

## Static scene

The room, floor planks, lamp glow, table and net are drawn once into an offscreen canvas and blitted each frame. The ball, its shadow, the trail, the bat, the Neighbour and the contact sparks are the only things redrawn. `devicePixelRatio` is capped at 2. If a 390-wide view with 4x CPU throttling is under 60 fps, the trail drops to 2 ghost balls before any other cut.

## Shot model

Swing speed is the magnitude of yaw rate and pitch rate. A swing starts when the 3-sample average is over 300 deg/s. The fastest sample inside the next 150 ms is the shot. 300 to 600 deg/s is a push at 6 m/s, above 600 through 1100 is a drive at 11 m/s, and above 1100 is a smash at 17 m/s only when the ball is at least 15 cm above the net. Otherwise that swing stays a drive.

The hit plane is 0.3 m in front of the player's end. Inside +/-40 ms the shot is perfect: no aim pull and 1.15 times speed. Out to +/-120 ms, early pulls the ball off the aim line and late pushes it the other way, reaching 25 degrees at the edge. Forehand early goes left. Backhand mirrors that. Outside the window the swing whooshes and does not touch the ball.

Gamma of +/-30 degrees maps to +/-0.7 m across the table. Beta of +20 degrees (open face) lands 0.3 m past the net. Beta of -20 degrees lands on the far baseline. Wrist roll past 200 deg/s is topspin when the roll is upward and backspin when it is downward. Level 3 topspin reaches the table in 85% of the no-spin time. The path is the same shape. Backspin takes longer and sits up. A peak acceleration over 12 m/s2 adds 10% speed. Over 40 m/s2 pauses for a drop.

Casual forgiveness is 8.0 cm, measured with `<=`. A ball 7.9 cm long is nudged in. A ball 8.1 cm long is out. The same band applies wide of the sideline. A casual push is solved on a higher arc until it clears the 15.25 cm net. A clip of the tape is lifted over. A deeper net hit is a fault.

## Neighbour and the average bot

The Neighbour waits 260 ms, misses 18% of the returns he swings at, and sends 6 to 9 m/s with light topspin toward the middle, plus or minus 0.3 m. Drives that arrive before he is ready are winners. The average bot mixes pushes and drives, mistimes some balls, and misses some. The sim keeps his point share between 20% and 40%, so the Neighbour loses most games to 11.

The opening point is a 5 m/s high feed. Any swing over 300 deg/s inside +/-200 ms becomes a perfect drive, and that point is won.

## Gate and fallback

`gate.js` is the Lawn Tennis unlock: `requestPermission` for motion and orientation, then `AudioContext.resume`, all synchronous inside the tap, before any await. `?input=swing` skips the gate for tests. Touch and mouse use one drag path: speed picks the band, the horizontal lean picks aim, a flick up at the end is topspin, and a pull down is backspin.

## Sound

Every voice is an oscillator or a noise buffer. The bat is a 1.2 kHz blip plus noise for about 40 ms. The table is a higher, shorter tik. Those two stay distinct. A quiet brown-noise murmur loops under the rally. A point won gets a clap, louder after 8 hits. The opening winner adds a short ooh. Android vibrates 15 ms on a hit and 30 ms on a smash, from the look sheet.

## Checks

`qa/pingpong/` imports the modules in Node. No browser is required for the numbers, the 8 cm line, the hook, or the 1,000-point win rate. Screenshots and the throttled frame rate need the static server and Chromium.
