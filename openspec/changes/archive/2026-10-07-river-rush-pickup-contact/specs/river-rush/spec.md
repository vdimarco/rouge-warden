## ADDED Requirements

### Requirement: Visible power pickup contact
Magnets and shields SHALL activate only when the visibly moving raft overlaps
them at their crossing. Selecting a target lane before arriving SHALL NOT
grant a power. Pickups SHALL be resolved in travel order so a magnet cannot
collect a coin crossed before its acquisition. Existing explicit Magnet and
Rush attraction SHALL remain available after legitimate activation.
Missed powers SHALL remain visibly missed. Attracted coins SHALL visibly pass
through the raft before flying to the counter in the primary 3D view.

#### Scenario: Steer beside a magnet
- **WHEN** a player changes toward a magnet's lane too late to overlap it
- **THEN** the magnet passes uncollected, no power activates and another lane's
  coins remain missed in both renderers

#### Scenario: Acquire a magnet between two coins
- **WHEN** a raft overlaps a magnet between adjacent coins within one frame
- **THEN** only the later coin is attracted, regardless of entity insertion order

#### Scenario: Real play and refresh rates
- **WHEN** a player crosses or misses pickups at 30, 60 or 120 Hz, or uses
  screen-wide gestures in the primary 3D view
- **THEN** scoring, visible contact and power feedback agree without changing
  movement timing, finite-map progression or saved scores
