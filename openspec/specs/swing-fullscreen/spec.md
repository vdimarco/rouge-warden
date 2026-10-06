# swing-fullscreen Specification

## Purpose
In Full Swing, full screen as the default for play.

## Requirements

### Requirement: Full screen by default
Starting flat play SHALL ask the browser for full screen, in the same click or tap. Leaving flat play for the title SHALL leave full screen. A browser that has no full screen API for pages, or refuses it, SHALL play in the page with no error.

#### Scenario: Press PLAY
- **WHEN** the player presses PLAY ON THIS SCREEN (or PLAY ON PHONE)
- **THEN** the page asks for full screen

#### Scenario: Esc, then resume
- **WHEN** the player presses Esc (full screen and the pointer lock end) and then clicks the city to resume
- **THEN** the page asks for full screen again

#### Scenario: No full screen API
- **WHEN** the browser has no full screen API for pages (an iPhone)
- **THEN** the game starts in the page as before
