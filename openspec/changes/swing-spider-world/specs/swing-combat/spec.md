## ADDED Requirements

### Requirement: A throw
In flat play, G (pad d-pad up, or a phone THROW button) SHALL throw a toilet lid at the living goon nearest the middle of the
view, 3 to 18 m away and within 40 degrees of the view. It SHALL fly 0.45 s along an arc and take two points. One throw SHALL
follow another after 2.5 s at the soonest. During a fight, with a goon in range, the prompt line SHALL say THROW.

#### Scenario: Throw at a goon
- **WHEN** a goon stands 8 m in front of the hero and the player presses G
- **THEN** the lid flies to him and he loses two points

### Requirement: A group pull
A rope pull on a goon SHALL also drag up to two goons within 3.5 m of him. They SHALL land in a heap at the hero's feet, and each
SHALL take two points.

#### Scenario: Pull three
- **WHEN** the player ropes a goon who has two goons beside him
- **THEN** all three land at the hero's feet and are hurt
