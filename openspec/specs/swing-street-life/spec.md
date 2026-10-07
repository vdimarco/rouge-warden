# swing-street-life Specification

## Purpose
In Full Swing, the people, crossings, shop signs and light that make the streets feel alive.

## Requirements

### Requirement: People walk the sidewalks
The city SHALL show people on the sidewalks around the player, in flat play and in a headset. Up to 160 people SHALL be out
at once, all within 150 m of the player. Each person SHALL walk on a sidewalk, never on a road, in a building or in the
lake, except on a zebra crossing. People SHALL have different clothes, heights and walking speeds (1.0 to 1.7 m/s).

#### Scenario: A street from the start roof
- **WHEN** the player stands on a street 60 s after play starts
- **THEN** at least 25 people are within 80 m, and every person is on a sidewalk or a zebra crossing

#### Scenario: The player travels
- **WHEN** the player moves 500 m across the city
- **THEN** the people left behind go, new people show around the new spot, and no person is more than 150 m from the player

### Requirement: Crossings follow the walk light
A person SHALL cross a street only on its zebra crossing at a corner. The walk lights of north-south and east-west
crossings SHALL take turns, 14 s each. A person who comes to a crossing while its light is off SHALL wait at the kerb, and
SHALL start across only while it is on.

#### Scenario: A person at a red light
- **WHEN** a person reaches a crossing whose walk light is off
- **THEN** the person stands at the kerb until the light turns on, then walks over on the zebra

### Requirement: Civilian activities
Some people SHALL stand still instead of walking: at a shop window, looking at a phone, or talking with another person.
After a while they SHALL walk on.

#### Scenario: People who stand
- **WHEN** the player watches a street for 30 s
- **THEN** at least one person in view stands still for a while and then walks on

### Requirement: People react to the hero
When the hero lands within 14 m of a person, that person SHALL stop, turn to the hero and cheer for 2 to 4 s. When the
landing is hard (faster than 12 m/s down) and within 6 m, the person SHALL first run 2 to 4 m away from the hero. When the
hero passes within 25 m across and under 30 m up at more than 12 m/s, the person SHALL look up and point. When the hero
walks within 0.8 m of a person, the person SHALL step aside. After a reaction, the person SHALL walk on.

#### Scenario: A landing in a crowd
- **WHEN** the hero lands on a sidewalk with people within 14 m
- **THEN** those people stop, face the hero, and show the cheer pose, and a cheer sounds from their spot

#### Scenario: A hard landing next to a person
- **WHEN** the hero lands at 15 m/s down within 5 m of a person
- **THEN** that person runs away from the hero first, then turns and cheers, and a gasp sounds

#### Scenario: A low swing over the street
- **WHEN** the hero swings at 18 m/s 10 m over a street with people on it
- **THEN** the people under the swing look up and point

### Requirement: Shop signs and neon
The street floors of the Market, Old Town and Warehouse districts, and of every building on an avenue, SHALL carry shop
signs: blade signs that stick out from the wall at 3.5 to 7 m, and boards over the shop windows. The signs SHALL glow in
neon colours (pink, cyan, yellow, green, violet). About one in eight SHALL flicker. A sign SHALL never cover a street or
stick into another building.

#### Scenario: A walk down a Market street
- **WHEN** the player stands on a Market street and looks along it
- **THEN** glowing signs line the shop floors, and the view shows neon colours brighter than the walls

### Requirement: Adjustable bloom
In flat play the bright parts of the view SHALL glow past their edges. The Comfort menu SHALL have a Bloom row with Off, Low
and High. The default SHALL be Low with a mouse or a pad and Off on a phone. The choice SHALL be saved. A headset SHALL
render with no bloom.

#### Scenario: The player turns bloom up
- **WHEN** the player opens Comfort and picks High
- **THEN** the glow round the neon signs, the lamps and the sun grows, and the choice is still High after a reload

#### Scenario: Bloom off
- **WHEN** the player picks Off
- **THEN** the view renders straight to the screen, as before this change

### Requirement: Crowd sound
A murmur SHALL rise as more people come within 25 m of the player, and fall to silence with nobody near or high over the
street. A reaction SHALL sound from the people who react: a cheer for a landing, a gasp for a hard landing.

#### Scenario: Down among people
- **WHEN** the player walks on a sidewalk with people near
- **THEN** the crowd level is above zero; on a roof 60 m up it is zero
