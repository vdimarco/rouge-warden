Fix the remaining adjacent-coin collection loophole. Magnet and shield pickup
still use the immediately selected lane, allowing power acquisition before the
visible raft arrives. A wrongly acquired magnet then collects remote coins.
Restore visible contact for power pickups, retain intentional powered coin
attraction and verify the primary 3D view as well as the fallback.
