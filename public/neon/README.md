# Neon Ronin

Standalone mobile cyberpunk sword game. Serve `public`, then open `/neon/`.
The arcade Lab links to the game. No build or external assets are required.

## Controls

- Swipe horizontally or vertically to match the enemy's bright guard line.
- Hold Guard just before the countdown ends to parry. A parry opens the enemy to either cut direction. Holding guard early reduces damage but does not prevent it.
- Enable gyro over HTTPS. Small wrist turns trigger cuts. Return to a steady grip between cuts. Recenter resets aim.
- Overdrive spends a full meter to deal damage and slow combat for four seconds.
- Keyboard: arrows cut, Space guards, E uses overdrive, Escape pauses.

Clearing a district offers three random circuits. Enemy health and speed rise with districts. Every fifth district features enforcers. High score saves locally when a run ends. Audio starts on the first play gesture. Sound can be muted.

## Verification

Run from the repository root: `node --test qa/neon/combat.test.cjs`.
Tests cover direction matching, cooldown, timed parry, guard damage, pause, progression, overdrive, loss/restart, gyro rearming and touch fallback. Canvas calls run against a mock context at portrait and landscape sizes; this does not validate pixels.

Browser visual QA was blocked in the build workspace because Playwright had no browser executable. Test on Android Chrome and iOS Safari before release, including permission denial, orientation changes, background/resume, and sensitivity. The 105 degrees/second cut threshold requires physical-device tuning. No long-session fun or retention claim has been validated.
