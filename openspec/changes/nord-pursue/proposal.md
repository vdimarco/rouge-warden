# Catch the traffic car

## Why

The tail follows your car. The courier drives toward a point you can stand on. Nothing asks you to catch a car that keeps its own lane.

## What changes

After the send-off is banked, a traffic car is already ahead on one surveyed avenue. It cruises at the traffic straight-line speed and does not steer toward the player. A real car that pulls alongside it, before the avenue ends, banks the beat and pays 460 once. A walker does not. If the traffic car reaches the end first, it is ahead again and the beat stays open. The step is saved on version 15. Version 14 starts this beat over. How far it has driven is session state. The seven story banks stay seven. Mission 15 and mission 20 are not retuned.

## Impact

- Affected specs: nord-pursue, nord-unreal
- Affected code: `QuebecPursue.h`, `QuebecStorySave.h`, `QuebecCampaign`, the pursuit tests, and the version-15 save readers
