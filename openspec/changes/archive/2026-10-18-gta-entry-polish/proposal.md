# GTA entry page polish

## Why
The player called the play page at nord-montreal.vercel.app cheap and cluttered, too small on phones, and its trailer broken.

On the play page (`games/nord-unreal/Browser/`), five stacked CSS layers fought each other. The last layer painted a 93% opaque cyan sheet over the title loop, so the loop played unseen while "Sound on" still showed. Title and status sat in two loose cards. Phone text was 9 to 12px. All text used Arial.

On the arcade landing page (`public/gta/`), the page used two names (NORD / Montréal and GTA: NORTH). It hid the controls in tiny text. It sent two links to the same player URL. On phones the badge was small and the lower half of the screen was empty. The badge image was a 429 KB PNG.

## What changes
### Play page
- The title loop shows through a light halftone screen and a dark fade.
- One comic panel holds the title, the connection status (with a colored state dot) and two equal buttons: Connect and Watch trailer.
- PLAY on the badge becomes a yellow stamp with an ink border, still in the lower third and still pulsing gently.
- Phones get a badge up to 440px, 15 to 23px text, and 46 to 50px buttons. The badge and panel fit without scrolling from 320×568 up.
- Barlow Condensed replaces Arial in the header, title screen and footer. Key names in the footer show as key caps.
- One set of title-screen rules replaces the five layers in `hero.css`.

### Arcade landing page
- One name on the page: GTA: NORTH. The title, description and trailer label use it.
- A status chip under Play gives the two facts that stop a join: two player slots, and the host PC must be online.
- Three numbered steps tell the player how to join and how to install. The duplicate install link is gone; Play is the only link to the player.
- Keyboard controls show as key caps at a readable size on desktop. Phones show only the touch-controls note.
- Phones get a larger badge. The cover still fits one screen at 390×844.
- The badge loads as a 78 KB WebP with the PNG as fallback.
- Social preview tags (Open Graph) for links to `/gta/`.

## Out of scope
The homepage cabinet, the switcher entry, the streamed game, the touch controls, the menu, and the start-screen story and crew choice.
