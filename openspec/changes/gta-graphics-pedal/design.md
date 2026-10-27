# Design: pedal follow

## Source

The drive step in `QuebecGameplay.cpp` already slews the pedal with a constant rate, then applies that fraction of the existing power curve. No outside vehicle model replaced it. A one-frame jump to full torque is the launch the handling test already refuses, so the pedal still takes three frames at 60 Hz.

## Rate

`QuebecSteer::ThrottleRate` is 20 per second. The old literal was 5. Full gas is 50 ms instead of 200 ms. `HoldRate` stays 3.5 and `ReleaseRate` stays 10. The lap model uses the same constant, so a faster pedal does not fork the simulated car from the game.
