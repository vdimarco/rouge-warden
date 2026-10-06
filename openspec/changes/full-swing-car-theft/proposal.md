# In Full Swing: steal a car from the traffic

## Why

The player said: "let's make the car something that I can get into. Maybe, steal."

Flat play already has parked cars at the kerbs that the hero can drive (change full-swing-city-action). The moving traffic is
drawn in a shader and cannot be entered, and the "R GET IN" prompt shows only next to a parked car. Players do not find the
cars, and the cars that catch the eye, the ones that move, do nothing.

## What changes

- **Steal a traffic car.** In flat play, near a moving street car, the hero presses the car key (R, a pad's B, the phone's
  CAR button). The car stops, its driver jumps out and runs off shouting, and the hero drives the car with the same model as
  the parked cars. The traffic shader no longer draws that car.
- **A generous reach.** A traffic car is in reach when its body is within 3.5 m of the hero, and the hero may be on the
  ground or just above it (landing from a swing). A press up to 0.35 s before a car comes into reach still counts.
- **Clear prompts.** Next to a traffic car the prompt says "R STEAL" ("B STEAL" on a pad; the CAR button on a phone).
  Next to a parked car it still says "R GET IN".
- **A stolen car stays.** When the hero gets out, the stolen car stays parked where it stopped, in the traffic car's
  colour, and the hero can get back in with GET IN. When the player has gone far away, it goes, and its traffic car drives
  again.

## Out of scope

The headset (no car action there). Expressway cars and streetcars. Police or a wanted level. Traffic that stops for the
hero or for the stolen car. New car models or sounds.
