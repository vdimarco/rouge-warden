# Show the tail puffs on the play page

## Why

A running car already leaves six pale puffs at the tail, and the play page never shows them.

## What changes

The play shell draws those same puffs while the engine is running. The puff count, life, interval, and the rise stay as they are. Bonnet smoke stays for a wreck. No new sound. No new mission.

## Impact

- Affected specs: nord-tail-puff
- Affected code: the puff ages sent to the play shell, and the shell canvas
