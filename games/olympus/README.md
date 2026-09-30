# Olympus: Last Flame

One-thumb Greek mythology survivor, ported from the original ChatGPT Site.
Open `/olympus/` or use its cabinet on the Cottage Arcade home page.

## Build

Run `npm ci` then `npm run build` in this directory. The committed JS and CSS in
`public/olympus` let the existing static Vercel deployment serve this game without
changing the other arcade games or the repository build settings.

The game uses the existing `/api/warden` Jev gateway. Local encounter selection
continues when the gateway is unavailable. No provider credentials are bundled.
Progress is saved on this browser and origin under `olympus-legacy-v2`.

## Faster pacing

- Movement 148 → 195 units/second; flame interval .92 → .48 seconds.
- Five opening enemies, shorter spawn intervals, faster enemies and projectiles.
- XP threshold starts at 6 instead of 12 and increases more gradually.
- Soul pickup radius 62 → 105, encouraging continuous movement.
- Waves last 30 seconds; guardians arrive after 90 seconds per realm.
- Recovery windows and attack warnings stay in place; time uses real seconds.
- Forge costs and limited upgrades remain, preserving longer-term progress.
