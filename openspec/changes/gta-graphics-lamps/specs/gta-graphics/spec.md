## ADDED Requirements

### Requirement: Some windows are lit
The estimated facade shader SHALL colour the inner pane of some windows warm, and SHALL leave other windows dark. Mullions and doors SHALL stay readable.

#### Scenario: Read a row of windows
- **WHEN** the facade shader is evaluated across a floor of window bays
- **THEN** some inner panes are warm and some stay dark, and the mullions still cross the glass
