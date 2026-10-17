# Swing: the Spider-Verse look and feel

In Full Swing (`public/vr/`) already has a comic look: cel bands, ink outlines, Ben-Day dots, sound words and comic caption boxes. The user asked to take the art direction of the film "Spider-Man: Into the Spider-Verse" further into the game, and to make movement and combat feel more like the film.

## Why

- **The look stops at the surfaces.** The film's style lives in how the image moves and is printed, too: characters animated on twos, colour plates off register where a camera would blur, impact frames on big hits, and drawn spider-sense lines. The game draws each object in comic style, but the frame still moves and focuses like a 3D game.
- **A blow has no weight.** A punch plays a sound and a word, but the world does not react. The film and the Spider-Man games hold the frame and shake the camera on a hit.
- **A fight stops between goons.** After a goon falls, the hero must walk to the next one. Spider-Man zips from goon to goon, and a fight flows.
- **A swing feels flat.** The camera stays level through every arc.

## What changes

All of it is flat play only. The headset does not change.

- **On twos.** The hero takes 12 poses a second, as in the film. The body still slides smoothly with the player, and the ropes still start at the hands. With a full focus meter, the hero goes on ones (every frame): in the film, Miles moves on twos at first and on ones once he is in control (`hero.js H.setTwos`).
- **Colour plates.** In the last full-screen draw, the red and the blue plates slip off register with distance from the hero: a little near the focus, more toward the far city and the sky. The slip grows with speed and jumps for a moment after a release boost or a zip (`bloom.js`, `main.js verseFrame`).
- **Impact frames.** A kick, a zip strike, a finisher or a slam turns the frame into two inks, black and a red hold, for 0.07 s. At most two flashes a second.
- **Spider-sense.** While a goon winds up near the hero, seven wavy lines shake over the hero's head.
- **Hit-stop and shake.** A blow that lands stops the world for 30 ms to 120 ms, by its weight. The camera shakes from blows with a trauma value that decays (`flatcam.js shake`, `post`).
- **Zip strike.** While a combo runs, a press of the swing input with no goon in reach zips the hero at the next goon in front of the view, up to 14 m away. The hero lands a flying kick and bounces off (`combat.js C.zipTarget`, `C.zipHit`; `main.js tryZip`, `zipFrame`).
- **Combo words.** The BONK word grows with the combo count.
- **Camera bank.** In a swing, or in fast flight, the camera leans into the turn, at most 7 degrees.
- **Comic motion setting.** The Comfort page gets a row "Comic motion": Full (everything), Calm (no impact frames, no shake, no bank) and Off (none of the new look; hit-stop and the zip strike stay).
- The version goes to 1.22.0 (Quest APK code 29).

## Out of scope

- New sound words. The atlas has nine words, and new art needs Higgsfield credentials.
- Smear frames and multiples (ghost copies of the hero). Each copy would cost a skinned draw.
- A new speed-line effect: `comfort.js` already draws speed lines.

## Player-facing change

On a computer or a phone, the hero moves like a drawn comic character, at 12 poses a second. Far buildings and the sky print with a slight colour offset. Blows hit hard: the world pauses for a moment, the camera shakes, and a big hit flashes a black and red frame. A red squiggle over the hero's head warns of a punch. In a fight, a press after a hit zips the hero to the next goon. In a swing, the camera leans into the turn. Players who do not want flashes or shake pick Calm.

## Capabilities

- `swing-verse-look`: on twos, colour plates, impact frames, spider-sense, the bank, the setting.
- `swing-verse-combat`: hit-stop, shake, the zip strike, combo words.
