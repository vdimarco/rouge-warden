## ADDED Requirements

### Requirement: Skill card
The HUD SHALL explain a skill in the command bar with its name, key, rank, mana cost, cooldown, tags, effect and a status line that says why it cannot be used now. The card SHALL cover no skill, "+" badge or point button and SHALL stay on screen.
#### Scenario: Hover a skill
- **WHEN** the mouse moves over a skill
- **THEN** its card shows, and it goes when the mouse leaves.
#### Scenario: Tap a skill on a phone
- **WHEN** the player taps a skill at 390x844 or 844x390
- **THEN** a ready skill casts as before and no card shows: on a phone the Spellbook, from the pause menu, explains each spell.
#### Scenario: Read why a skill cannot be used
- **WHEN** a skill is cooling down, short of mana or not learned
- **THEN** the card says "Ready in N s", the mana still needed, or how to learn it.
