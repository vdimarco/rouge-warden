# swing-combat Specification

## Purpose
In Full Swing, the Sludge Gang's fights with the hero: the goons, the hero's hearts and the hero's attacks.

## Requirements

### Requirement: The Sludge Gang fights
Goons of the King's Sludge Gang SHALL stand guard on the roofs of uncleared clogs (two per clog, after Mission 1) and appear in
jobs. A goon that sees the hero within 24 m and 5 m up or down SHALL walk up, wind up for 0.55 s and punch. A goon SHALL stay on
his roof or street and never walk off an edge.

#### Scenario: A guard sees the hero
- **WHEN** the hero lands 10 m from a goon on his roof
- **THEN** the goon walks up, winds up and punches

### Requirement: The hero's hearts
A goon's blow SHALL take one of the hero's five hearts. No blow SHALL land while the hero rolls, drives or wakes up. The hearts
SHALL come back after 6 quiet seconds. At zero hearts the hero SHALL wake up with full hearts on the nearest safe roof, and a
fight job is lost.

#### Scenario: Four goons at once
- **WHEN** four goons surround the hero on a street and the player does nothing
- **THEN** the hero is knocked out and wakes on a safe roof with five hearts

### Requirement: The hero fights back
In flat play, with a goon in reach (2.4 m), the swing input (left mouse, E, RT, a phone tap) SHALL punch instead of firing a rope:
punch, punch, kick within 0.7 s of each other. A punch takes one point, a kick two (a goon has three). A rope that catches a
fighting goon SHALL yank him to the hero's feet and down. A car faster than 4 m/s SHALL knock a goon over. A downed goon SHALL
sink into a sludge puddle and go.

#### Scenario: Punch, punch, kick
- **WHEN** the player presses the swing input three times next to a goon
- **THEN** no rope fires, the hero punches twice and kicks, and the goon is down

#### Scenario: A rope pull
- **WHEN** the player ropes a goon 20 m away
- **THEN** he flies to the hero's feet and goes down, and the rope does not stay
