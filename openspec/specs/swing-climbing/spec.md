# swing-climbing Specification

## Purpose
In Full Swing flat play, how the hero holds on to walls, climbs, tops out and clings to roof antennas.

## Requirements

### Requirement: Hold on to walls in flat play
In flat play (mouse or phone), the player SHALL hold on to a wall when the chest touches it in the air, or when the player walks into it. Holding a wall SHALL let go of the ropes and stop the body. Headset play SHALL NOT climb.

#### Scenario: Fly into a wall
- **WHEN** the player flies into a wall
- **THEN** the player holds on in the air with no gravity, and the first time a mouse player does this a line says "W and S climb, A and D go along it, Space jumps off"

#### Scenario: Walk into a wall
- **WHEN** the player walks into a wall from a roof or the street
- **THEN** the player holds on to it

#### Scenario: Headset
- **WHEN** a headset player flies into a wall
- **THEN** the player does not hold on

### Requirement: Climb with the keys or the climb pad
On a wall, W or the up arrow SHALL climb up and S or the down arrow down, at 6 m/s. A/D or the left/right arrows SHALL move along the wall, toward the view's left or right. Space SHALL jump off, and a rope SHALL swing the player off. A phone SHALL show a climb pad (up, down, left, right, JUMP) only while the player holds a wall.

#### Scenario: Climb up and along
- **WHEN** the player holds W (or the up arrow) for 0.5 s, then D for 0.5 s
- **THEN** the player climbs 3 m, then moves 3 m to the right along the wall, and stays on the wall

#### Scenario: Jump off
- **WHEN** the player presses Space (or JUMP on the phone pad)
- **THEN** the player leaves the wall with speed out from it and up, and does not grab it again at once

#### Scenario: Phone climb pad
- **WHEN** a phone player holds a wall and holds the up arrow for 0.5 s
- **THEN** the player climbs 3 m and stops when the arrow is let go; the pad hides once the player leaves the wall

#### Scenario: Tap off a wall
- **WHEN** a phone player on a wall taps
- **THEN** a rope fires and the player leaves the wall

### Requirement: Tops, bottoms and overhangs
At the top of a wall the player SHALL step on to the roof. Climbing down to a roof or the street SHALL stand the player there. Under an overhang the player SHALL move out to its face and climb on.

#### Scenario: Top of a building
- **WHEN** the player climbs to the top of a building
- **THEN** the player stands on its roof

#### Scenario: Climb the Needle
- **WHEN** the player climbs the Needle from the street
- **THEN** the player goes round the collars and the deck, and can stand on the deck (262 m), the pod roof (286 m), the mast (322 m) and the antenna tip (360 m)

### Requirement: Roof antennas
Every tower over 60 m SHALL carry one to three roof antennas that a rope catches and the player can climb. They SHALL keep 9 m clear of the start, the gold ring, the clogs, the trial starts and the safe spots.

#### Scenario: Rope an antenna
- **WHEN** the player aims at a roof antenna and fires
- **THEN** the rope attaches to it

#### Scenario: Climb an antenna
- **WHEN** the player flies into an antenna and climbs up
- **THEN** the player stands on its top

### Requirement: A brushed wall does not stop a swing
In the air, a wall SHALL hold the player only when the player comes at it slowly (under 8 m/s) or fairly head-on (at least 40% of the speed goes into the wall, not counting a fall). A wall the player only brushes during a fast swing SHALL let the swing go on. A fall steered into a wall SHALL still catch it.

#### Scenario: Brush a wall mid-swing
- **WHEN** the player swings past a wall at 20 m/s and touches it at 2 m/s
- **THEN** the player does not hold on, and keeps the swing's speed

#### Scenario: Fall into a wall
- **WHEN** the player falls at 14 m/s while steering into a wall at 3 m/s
- **THEN** the player holds on to the wall in the air

#### Scenario: Tap-only phone play
- **WHEN** the player plays 12 s from the start roof with taps only
- **THEN** the average speed is at least 15 m/s (measured 20.9 m/s with this rule, 18.9 m/s without)
