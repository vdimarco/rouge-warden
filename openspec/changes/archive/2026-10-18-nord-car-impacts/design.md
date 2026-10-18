# Design

## Source
This is the standard rigid-body impulse for two bodies with a restitution coefficient, as in Erin Catto's "Fast and Simple Physics using Sequential Impulses" (GDC 2006) and the Box2D contact solver, reduced to one planar impulse between equal masses. Unreal's Chaos Vehicles would give full tyre and body simulation, but replacing the existing tuned arcade car (driving feel, curbs, traffic, network replication and tests) was out of proportion for this request.

## Impact (`QuebecCarImpact::Resolve`, pure function)
- Inputs: both planar velocities, the contact normal from the struck car B toward the striking car A, and each car's arm from its centre to the contact point.
- Closing speed `c = (vA - vB) · n`. Below 60 cm/s closing (resting or separating), nothing is exchanged and the contact only blocks.
- Normal impulse per unit mass, equal masses: `j = -(1 + e) c / 2`, with `e = 0.25`. A gets `+j n`, B gets `-j n`, so momentum is conserved.
- Friction along the contact: up to `0.3 j`, never more than half the sliding speed, so it never reverses the slide.
- Spin: `Δω = 12 (r × Δv)_z / (L² + W²)` for a 4.6 m × 1.9 m box, scaled by 0.45 for tyres gripping the road, clamped to ±180°/s.

## Car state (`AQuebecCar`)
- `MoveWithCollision`: on the authority, when the sweep hits another `AQuebecCar`, apply the impulse to both cars, then remove only the closing speed relative to the other car.
- `ReceiveImpact`: adds the velocity change and spin, starts the slide timer, and ticks the struck car every frame until it settles. Parked cars normally tick every 0.1 s and traffic every 0.05 s.
- Slide state in `SimulateDrive`: forward speed decays at 650 cm/s², sideways at 900 cm/s² and spin at 220°/s². It ends at the timer or when nearly still; a car with no driver then zeroes its speed and restores its tick interval.
- Traffic recovery needs nothing new: `UpdateTraffic` already steers toward a look-ahead point on its lane.
- Network: cars simulate only on the server; replicated movement carries the result to clients.

## Check
- `Quebec.Driving.CarImpactMomentum`: head-on (37.5% / 62.5% split, momentum conserved, no spin), corner hit (opposite spins), glancing scrape (slows, never reverses), and no exchange when separating or at walking pace.
- `Quebec.Driving.FittedHullCurbsAndWalls`: the parked-car block now expects the parked car to be shoved forward, no overlap, both cars upright, and the struck car stopped after the driver brakes.

## Host verification — 18 October 2026
The Linux compiler rejects a steering-local `YawRate` that shadows the new impact field. Rename only that local and its two uses to `SteeringYawRate`; the steering calculation and impact state remain separate. Editor/game builds, five native driving tests, the saved-map regression and fresh package all pass. See `games/nord-unreal/Verification/CarImpacts-20261018.md` for live impact evidence and limits.
