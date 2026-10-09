# ASCII FRONT

A playable Battle City inspired tank roguelite, rendered in ASCII characters. Aesthetic reference: [bas3line/ascii](https://github.com/bas3line/ascii). All game art and logic are original.

## Play locally

```sh
npm install
npm run dev
```

Open the URL Vite prints. `npm run build` creates the static site in `dist/`. `npm run preview` serves that build.

WASD or arrows move freely, including diagonally. Aim independently with the mouse and hold left click or Space to fire. Keyboard-only aim follows movement. Shift dashes; E triggers a limited-charge EMP; Enter deploys/resumes; Escape pauses; R resets. Phones get touch controls. Switching modes starts a new run.

Protect HQ through five campaign waves, or choose endless mode. Faster movement, rapid cannon fire, shorter dash recharge and denser waves keep combat moving. Scouts pursue your tank, strikers and heavies push HQ. Brick cover is destructible; steel and water block movement; brush conceals your tank from scouts beyond 160 pixels. EMP damages/stuns nearby enemies and destroys hostile projectiles. Every third kill drops supplies. Chains multiply score. Between waves choose rapid fire, reactive armor, overdrive, rail rounds, or field engineer. Runs are local and reset on refresh.

All battlefield art is drawn with characters: shaded tank hulls and rotating turrets, animated tracks, highlighted terrain, shimmering water, swaying brush, muzzle flashes, projectile trails and expanding debris. The canvas supports high-density displays, while combat runs at a fixed 120 Hz. Reduced-motion preferences disable camera shake, flashes and cosmetic pulses.

## Warden arcade build

From the Warden repository root:

```sh
cd games/ascii-front
npm ci
npm run build:arcade
```

`build:arcade` must run from `games/ascii-front`; its relative output path writes to Warden's `public/ascii-front/` and includes the arcade shell scripts. The standalone project should use `npm run build` instead.

Deployment target: [arcade.uptick.systems/ascii-front/](https://arcade.uptick.systems/ascii-front/). Building locally does not publish the game.

## Checks

`npm test` covers normalized diagonal movement, wall sliding, independent mouse aim, projectile collision and firing cadence, plus damage, invulnerability, pause, EMP, upgrades, campaign/endless progression, seeded restart, concealment and HQ siege paths. Renderer checks cover finite coordinates, engine-state purity, independent turret rotation and reduced-motion behavior. Run `npm run build` to validate the standalone production bundle.

Browser verification used the Codex in-app browser at 1536×1024, default 1280×720, and 390×844. Tested deploy, keyboard movement/fire/dash/EMP, pause/resume, restart, help/focus, sound toggle, mode switching, and mobile action controls. Source engine tests cover upgrade/campaign endings.

Native ASCII glyph art preserves the requested aesthetic. No external service, account, AI API, multiplayer, or cloud save is needed.

Fonts: iA Writer Mono S ([iA Fonts](https://github.com/iaolo/iA-Fonts)) and Press Start2P ([Google Fonts](https://fonts.google.com/specimen/Press+Start+2P)), under the SIL Open Font License. Font license files are included under public/licenses.

Balance has automated functional checks; extended human playtesting remains useful.
