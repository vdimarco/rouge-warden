# Add River Rush to the Cottage Arcade

## Why
The user approved and tested a standalone River Rush prototype, then requested deployment to the arcade in `vdimarco/rouge-warden`. The arcade currently has no cabinet or game page for it.

## What Changes
- Keep editable Vite/React source in `games/river-rush/` and commit the static arcade build at `public/river-rush/`.
- Append a River Rush cabinet, register it in Action and the shared game switcher, and use a real game capture for its screen.
- Show its validated browser-local best score on the cabinet and keep the existing key, chest, balance, rival and escape mechanics.
- Load the shared audio quieting script before game scripts and provide Switch game and Arcade links on the menu and end screens.

## Impact
Changes affect only the new game, arcade registration, documentation and targeted QA. Use the existing Vercel Git deployment; preserve existing games and deployment configuration.
