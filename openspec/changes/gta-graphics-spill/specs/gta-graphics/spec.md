## ADDED Requirements

### Requirement: A lit window warms the brick under it
A room that draws an orange pane SHALL also warm the brick directly under that pane. A dark pane SHALL leave the brick under it unchanged. The pane colour SHALL stay the lamp colour.

#### Scenario: A wall of lit and dark windows
- **WHEN** a facade is shaded with some rooms above the lamp threshold and some below it
- **THEN** the brick under a lit pane is warmer than the brick under a dark pane, and the lit pane itself stays orange
