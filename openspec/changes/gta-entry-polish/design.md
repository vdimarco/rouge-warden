# Design

## Play page title screen
- `#overlay` background: a 5px ink halftone at 35% over a fade from 20% cyan to 72% ink. The loop stays visible on the badge side, and the panel side stays readable.
- `.hero` and `.caption` sit in a new `.panel` wrapper, so they read as one card. `#watch-trailer` moves into `.actions` next to Connect; its id and behavior stay the same.
- The status dot color follows `body[data-state]`: green for idle and ready, amber for connecting and selecting, pink for offline, error and disconnected.
- Phones hide the panel title, because the badge already names the game. Short phones (≤700px high) shrink the badge so the overlay never scrolls.
- Barlow Condensed 500 and 700 come from `public/vr/fonts/`. The build copies them, and THIRD_PARTY_NOTICES carries the OFL text.

## Merge with #398 (badge-matched chrome)
#398 landed on main during this change. It sets the entry-screen direction: ink header and footer with cream lettering and a hot-pink rule, angled cyan, yellow and hot-pink background panels, and Bungee lettering on the status and controls. This change keeps that direction inside the single-layer layout:
- Header, footer and ☰ Menu use #398's colors. Menu is yellow with a pink shadow and Bungee lettering.
- The status chip, status title, Connect, Watch trailer and Sound on use Bungee. They use larger sizes than #398 (17 to 21px on the main button, 11 to 13px on the secondary row), because of the "too small on phone" feedback.
- The status block and the button row carry #398's 7px hot-pink left rule.
- The angled panels are partly see-through (80% on the panels, 60% on the cyan). #398's opaque cyan base would hide the title loop again, which is the fault this change fixes.

## Play page buttons
- Main action: full-width yellow button, 3px ink border, 5px hard shadow, label on the left and "→" on the right (the same pattern as the arcade Play button). player.js sets its text, so the arrow and "Waiting for host" are CSS `::after` content.
- Secondary row (`.media-actions`, after `.caption`): Watch trailer and Sound on, paper fill, 2px border, 3px shadow, inline SVG icons. The row sits outside the `role="status"` caption, so showing Sound on does not trigger an announcement.
- Sound on moved from an absolute corner position into this row. The fullscreen rule that moved it left is gone.
- Menu (header and fullscreen overlay): paper fill, ink border, hard shadow, yellow on hover.

## Arcade landing page

## Layout
- One stylesheet layer replaces the old base rules plus the override block that followed them.
- Desktop: badge column 5fr, copy panel 6fr. The badge width is `min(100%, 46dvh, 460px)` so Play stays on the first screen at 720px height.
- Phones (≤760px): one column. Badge `min(58vw, 27dvh)`; trailer up to 20dvh. Phones shorter than 700px use a smaller badge and let the trailer go below the fold; Play, the story and the steps stay on the first screen.
- Short wide windows (≤500px high): compact panel, smaller step numbers, footer hidden.

## Content
- Steps are an ordered list with CSS counters drawn as yellow comic boxes.
- The install step names the in-game Menu item (`Install GTA: NORTH` in `games/nord-unreal/Browser/index.html`) as text. Play is the one link to the player, so every action keeps a 44px target.

## Images
- `comic-badge.webp` is the approved badge re-encoded with Pillow (quality 86). A `<picture>` keeps the PNG for browsers without WebP and for social previews.

## Sources
This is page layout and copy, not a rendering or art technique, so no outside source applies.
