# Design

Keep orders in the deterministic simulation. A single input command sets an attack or move order. Movement keys, joystick, stop, recall, pause, death and lost vision cancel an attack chase. Attack range, cooldown, cover and combo rules continue to apply. Route around inflated terrain obstacles and refresh routes as the target moves or the realm changes. Render a target ring while approaching and name the target in the HUD.

Acquire free assets through MagicPixel marketplace Add to library. The normal PNG export timed out, so use the public listing PNG files, unchanged, with source metadata in the repository. Retain procedural creatures as the fallback and use native pixel edges for the imported neutral sprites.

## Verification

- Targeting scenarios pass for all twelve heroes: pursuit, range, damage, movement override, recall, concealment, target/player death, neutral camp selection, and routing around cover.
- Existing skill/rank, basic attack contact, neutral camp, and legend checks pass. Thirty-six complete simulation matches pass.
- Desktop preview at 1363×936: selected Jersey Devil by clicking its sprite; HUD showed ATTACK and the combo progressed from one to three with damage at contact. Clicked the imported Undead Knight; the hero approached and attacked it. Ground click replaced that order and showed MOVING. Ogre and knight sprites and health bars render with crisp edges.
- No application-origin errors appeared in captured console logs. Vercel login and browser extension messages were unrelated to the game.
- Phone viewport and touch controls remain unverified. The current browser has no viewport resize control. OpenSpec CLI is unavailable; artifact structure and scenario coverage were reviewed manually.
- Preview deployment 0d70f35d446f1eed1e30c7b2639b62bb3eba8df3 was READY. Release follows the existing merge authorization in PR #132.
