# Stop the car and let them walk to it

## Why

The send-off asks you to drive, stop, and then walk. Nothing asks you to hold a car still while someone else walks a fixed line to the door, and turns around if the car rolls.

## What changes

After the yard is banked, a stop on a surveyed road takes a real car held at 60 cm/s or slower. A person off the road walks that line at a walk. Reaching the car while it is still stopped banks the beat and pays 680 once. A roll sends them back along the same line and does not save. A bike does not start them. The step is saved on version 23. Version 22 starts this beat over. Where they are on the walk stays in the session. The seven story banks stay seven. The yard, the send-off, and the bolt are not retuned.

## Impact

- Affected specs: nord-lift, nord-unreal
- Affected code: `QuebecLift.h`, `QuebecStorySave.h`, `QuebecCampaign`, the lift tests, and the version-23 save readers
