## ADDED Requirements

### Requirement: Readable moving river enemies
Each seeded river SHALL include sparse crocodile and swooping-bird enemies after its tutorial and early required actions. Crocodiles SHALL allow jumping or dodging, and birds SHALL allow ducking or dodging. Their lateral approach SHALL agree between physical contact and both renderers, and SHALL settle at a marked destination at least .8 seconds before contact at the highest Rush speed. Generation SHALL preserve reachable action rewards, attainable advertised chains, clear routes and finite finishes. Prepared animation resources and active entities SHALL remain bounded.

#### Scenario: React to a gliding enemy
- **WHEN** an enemy approaches on desktop, portrait touch or short landscape
- **THEN** its articulated silhouette, approach and marked destination show whether to jump, duck or dodge with enough warning, and successful action or physical avoidance preserves protection

#### Scenario: Contact and stopped state
- **WHEN** the raft overlaps an enemy, pauses, retries or enables reduced motion
- **THEN** physical contact uses its shared visible lane and existing protection/wipeout feedback, paused positions remain unchanged, retry resets encounters, and reduced motion keeps the collision route clear without extra shake

### Requirement: Drifting bonus relic targets
Courses SHALL offer sparse drifting relic targets in clear recovery space using the existing steering controls. Both renderers SHALL show their shared moving position and destination. Actual compatible ground-height contact within the existing .25-lane pickup radius SHALL award 200 points once and 10 charge outside active Rush with distinct visual and audible feedback; adjacent or airborne misses SHALL pass silently. Bonus routes SHALL NOT conflict with preceding jump arcs or demand an immediate lane change into another hazard.

#### Scenario: Collect or miss a drifting relic
- **WHEN** a player physically steers over a target or passes beside/above it
- **THEN** only compatible contact awards the bonus once, emits one pickup cue and visible burst, and preserves ordinary coin contact rules

#### Scenario: Keep accessible feedback and bounded play
- **WHEN** a player mutes, pauses, hides, retries or plays the graphics fallback
- **THEN** sound preferences and stopped motion remain correct, targets remain distinct and reachable, and their prepared resources do not grow with course distance
