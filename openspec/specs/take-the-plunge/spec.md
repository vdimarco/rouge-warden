# take-the-plunge Specification

## Purpose
Take the Plunge has a loon dive into lakes for speed, ahead of winter, on lakes that change each day.

## Requirements

### Requirement: One mistake does not end the run
Take the Plunge SHALL let a player recover from a skim or a thud.

#### Scenario: Touch a lake bed
- **WHEN** the loon touches a lake bed
- **THEN** it loses 8% of its speed once for that touch, not on every step of the contact

#### Scenario: Thud into a shore
- **WHEN** the loon hits a shore
- **THEN** it keeps 85% of its speed and bounces up, and a chain of thuds counts on one label, for example "THUD ×5"

### Requirement: A truthful cue to dive
Take the Plunge SHALL show the player when a hold will rip into the next lake.

#### Scenario: The dive-now cue
- **WHEN** the loon glides toward a lake, and a hold now would rip with at least 25 m of lake left to swoop out
- **THEN** the loon pulses green with a tick, and a new player also sees HOLD

#### Scenario: Too little lake
- **WHEN** the predicted entry leaves less than 25 m of lake
- **THEN** the dotted path is amber, not green

### Requirement: Warnings before a hit
Take the Plunge SHALL warn of a thud or a belly-flop before it happens.

#### Scenario: A thud ahead
- **WHEN** the loon is about to thud into a shore
- **THEN** low beeps start up to 0.8 s before the hit, and a ring beats where the hit will be

#### Scenario: A belly-flop ahead
- **WHEN** the loon is about to land flat with its wings open
- **THEN** the whistle sounds before the landing

### Requirement: A slow-motion peak in every run
Take the Plunge SHALL slow time for the best moments of a run.

#### Scenario: A burst
- **WHEN** the loon bursts out of a lake for the first time in a run, or out of a perfect rip
- **THEN** the game runs at 0.3 speed for 0.8 s, and the camera pushes in

### Requirement: A day to fly through
Take the Plunge SHALL mark the time of day as distance goes by, and say how far the run got.

#### Scenario: Sunset and the northern lights
- **WHEN** the loon passes sunset, the northern lights and each new dawn
- **THEN** a title and a chord mark each one, and the sky cycles every 1,600 m

#### Scenario: The end card
- **WHEN** winter catches the loon
- **THEN** the end card shows the farthest sky reached, the next sky and how far away it was, and the number of thuds

#### Scenario: The winter pill
- **WHEN** winter comes within 40 m of the loon
- **THEN** the "Winter" pill in the HUD turns red

### Requirement: Ghost links that tell the truth
Take the Plunge SHALL report a ghost race from the ghost's recorded distance, and say when a ghost comes from an older version.

#### Scenario: Lose to a ghost
- **WHEN** winter catches the player during a ghost race
- **THEN** the gap is the ghost's recorded distance minus the player's distance

#### Scenario: An old ghost link
- **WHEN** a version 1 ghost link opens
- **THEN** its lakes open, and the game says that the ghost comes from an older version
