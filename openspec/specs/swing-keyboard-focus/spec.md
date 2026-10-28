# Keyboard focus

## Requirements

### Requirement: Keyboard focus is readable on flat paper panels
The pause and Comfort menus SHALL mark a keyboard-focused button with an outline that contrasts at least 3:1 against their paper background. Tab navigation SHALL still move between controls. The ring SHALL fit inside desktop and narrow portrait viewports.

#### Scenario: Tab through the pause menu
- **WHEN** a player opens pause and presses Tab
- **THEN** focus moves to another control with a clearly contrasting outline inside the viewport

#### Scenario: Tab through Comfort settings
- **WHEN** a player tabs between Comfort controls
- **THEN** the focused control has the same readable outline without changing its layout
