# Cars push cars on impact

## Why
The owner said the crash mechanics are bad: a car should push other cars when it crashes into them, like real physics. In the current game, a car treats every other car as a wall. The movement sweep stops the moving car and slides it along the contact, and the struck car never moves.

## What changes
- A car-to-car hit trades momentum between two equal-mass cars along the contact normal, with 25% restitution and some scraping friction. The struck car is shoved, and the striking car loses that much speed.
- Off-centre hits, such as a bumper corner or a side swipe, spin both cars in opposite senses, from the contact lever arm.
- A struck car slides on locked tyres for up to 1.5 s (0.35 s for a car with a driver), loses speed and spin to friction, and can strike further cars. Then it returns to its normal behaviour: a parked car parks again, a traffic car steers back to its lane, and a driver gets control back.
- A pushing car loses only its closing speed relative to the car ahead, so it can push a car down the street.
- Walls, buildings and curbs behave as before.

## Out of scope
Damage, deformation, sounds, airborne flips and rollovers. Cars stay on their wheels. Pedestrians and characters are unchanged.
