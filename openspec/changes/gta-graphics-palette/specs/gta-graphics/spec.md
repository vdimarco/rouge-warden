## ADDED Requirements

### Requirement: Brick and stone read as different hues
A brick wall and a stone wall SHALL use different body colours. The brick body SHALL sit toward burnt orange. The stone body SHALL sit toward a cool grey. The lamp pane, the apron under it, and the gallery rail SHALL keep their colours.

#### Scenario: A brick row beside a stone row
- **WHEN** the facade shader shades a brick building and a stone building in one elevation
- **THEN** the brick field is warmer than the stone field, and the lit panes and iron rails match the colours they had before the body change
