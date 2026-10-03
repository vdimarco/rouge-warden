# Design

Follow-up: use existing combat fighters for dismounted officers so attacks, parries, dodges and knockouts use the established rules. Reserve occupied patrol driver seats, brake before dismount, expose vacated cars through normal door interactions, and transfer stolen cars out of pursuit cleanup while retaining them for session cleanup. Officers return physically to their own unstolen vehicle before remounting. Ambient pedestrians retain the existing melee damage path, with a brief visible hit reaction.

Ambient crowd circles opt into damage; every other circle retains the existing soft stop. Check contacts each vehicle substep, including reverse travel and elevation, with a cooldown per pedestrian. Only a vehicle driven by the hero incurs crimes. Melee uses the existing swing arc and cleave set.

Use bounded ballistic motion, spinning limbs, dust bursts and ground bounces, followed by a still body and cleanup. This is exaggerated procedural animation, not a new physics dependency. Improve civilian eyes and facial shading, vary idle timing and let nearby people flee approaching cars.

A separate wanted state owns escalation, dispatch delay, search, evasion and arrest. Ground units use the road-aware pursuit driver. Sheriff reinforcements wear cowboy hats; air support uses a speed-limited helicopter, rotor animation and searchlight. Five stars cap at four ground vehicles and one helicopter. Sight loss starts a timed search of the last known position rather than tracking the player through walls indefinitely. All state and spawned resources reset on session changes.

Validate pure rules with Node tests and integration in the existing browser QA harness. Capture desktop and touch screenshots; check bounded unit counts, finite motion and HUD bounds. Physical phone and subjective audio checks must be disclosed if unavailable.
