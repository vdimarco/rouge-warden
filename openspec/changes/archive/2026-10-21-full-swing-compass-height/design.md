# Design

Use nearestTarget's existing y coordinate and the player's position. Show vertical separation rounded to five metres when at least five metres apart; leave the line empty near the target's height. Refresh independently of horizontal distance so moving only vertically updates the cue. Keep the existing distance node and use a smaller second line within the same compass pill. No new rendering technique, dependency, setting or target-selection logic.

Scope: shared flat UI construction/update/style, focused browser regression, existing layout and compass regressions, CI, evidence and round log. The headset's canvas HUD is unchanged. Check desktop and portrait bounds and above/below/near-height behavior against a real clog mission. No physical device or performance claim.

CI follow-up: index.html owns compact touch HUD rules. Keep the compass within its pre-existing 28-pixel icon height using a 14-pixel distance line and 12-pixel ↑/↓ metre cue in that layout. ui.js retains full text and supplies the compact visual label. The existing full phone-controls sweep validates arrow directions and four-pill boss/trial layouts; do not relax its bounds or angle checks.
