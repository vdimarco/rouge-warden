# Swing hero and comic look

In Full Swing (`public/vr/`) is a swinging game for Meta Quest 3. It also plays on a flat screen. The user asked for two things: comic-book graphics made with Higgsfield, and controls that play well on phones and on desktop. This change holds the comic look and the camera that the controls work needs. The new control scheme itself follows as its own change.

## Why

- **The look.** The user said the graphics were poor. The Higgsfield art is in the repo (key art, sky strip, window atlas, sound words) and the city already uses it. The things the player sees up close still had the old look: the clogs, the Loonies, the rings, the King, the ropes, the launchers, the HUD, the menus and the opening in mixed reality.
- **The camera.** On a flat screen the player looked through the hero's eyes. The player never saw the body, the plunger leave the hand, or the arc of a swing. A third-person hero and a chase camera show all of them.
- **The phone.** Main brought a one-thumb phone scheme (`js/mobile.js`). Its tap-to-aim code assumes that the camera sits at the player's head. A chase camera sits up to 5.6 m behind the head, so a tap went to the wrong building. The tutorial also spoke about a mouse.

## What changes

- A third-person hero on flat screens (`js/hero.js`). It uses the model `/wild/models/crew5.glb` (the crew's Red Jersey) and poses its bones in code. A figure built in code takes its place when the model does not load.
- A chase camera on flat screens (`js/flatcam.js`). It is a spring arm that orbits with the look input, pulls in at walls, follows the swing and widens with speed. V switches to the old first-person view and back. The wiring is in `js/main.js`.
- The phone scheme on main (one tap swings, the rope lets go by itself; change `full-swing-phone-and-climbing`) works with the chase camera. A tap aims through the pixel the player sees, in third and first person. A phone reports the input kind "touch" and reads the phone lines (`LINES_PHONE`). The phone's field of view curve also drives the chase camera.
- The comic restyle of the objects in `game.js`, `rope.js`, `hands.js`, `ui.js` and `portal.js`: cel bands and ink outlines on the clogs, the Loonies, the rings, the pipes, the ball and the King, on the ropes, the plungers, the launchers and the gloves, and on the pieces of the mixed reality opening. The HUD, the toasts, the subtitles and the menus become comic caption boxes.
- The Quest session does not change in play. The hero stays hidden and the camera stays under the rig. Only the objects wear the new look.
- Review fixes inside this change: a phone tap that aimed at the screen centre, a phone start that tipped the camera up through the roof, a first-person muzzle that sat in the wrong place, the touch tutorial lines, a hero texture that was freed after upload, two-line toasts that lost their border, a compass arrow that left its ring, and black dots at the end of the opening.

## Out of scope

The new flat-screen control scheme and the auto target follow as their own change. The controls change adds:

- an auto target for the rope (`R.autoTarget`);
- the pad button Y and an eye button for the view toggle;
- comic-style touch buttons;
- vibration on attach and yank;
- a key hint strip for the first minute;
- a "turn your phone" card for portrait;
- `qa/vr/flat.mjs` and `qa/vr/touch.mjs`.

Until that change lands, V is the only view toggle, phones keep the buttons from main, and the rope aims along the view. Two more things stay as they are: `physics.js` and `city.js` do not change, and nothing here changes the audio.

## Player-facing change

On a computer or a phone you now see the hero from behind and above. The hero wears a red jersey and reaches along the rope to the anchor. The camera swings with you and never goes inside a building. On a phone, a tap on a building sends the rope to that building. In a headset you see no hero. The clogs, the coins, the King, the ropes and the menus have ink lines and flat colour bands like the key art.

## Capabilities

- `swing-flat-camera`: the hero and the chase camera.
- `swing-phone-aim`: tap-to-aim, the phone start and the touch lines.
- `swing-comic-look`: the ink and the cel look of the objects, the HUD and the opening.
