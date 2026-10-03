## ADDED Requirements

### Requirement: Precise skill placement
Desktop skill keys SHALL use the cursor's world position. Touch dragging SHALL specify direction and distance for ground placement, and permit deliberate cancellation. Tapping SHALL retain aim assistance. Releasing or cancelling a skill touch SHALL preserve an independent movement touch.

#### Scenario: Place a ground skill
- **WHEN** a desktop player points near the hero and presses a trained ground skill, or a touch player makes a short aiming drag
- **THEN** the preview and effect use the selected distance within the ability's range.

#### Scenario: Cancel an aimed touch
- **WHEN** the player aims then uses the cancel gesture, or the pointer is cancelled
- **THEN** no spell is cast and no resources are spent; a held movement pointer remains active.

### Requirement: Readable combination states
Targets SHALL show active wet, brine, chill and spirit marks with expiry. The player's relevant follow-up skill SHALL indicate a currently useful combination. Important outcomes SHALL have distinct feedback without obscuring incoming threats.

#### Scenario: See a combination opportunity
- **WHEN** a visible target receives a combo mark and the player's learned follow-up is ready
- **THEN** the target mark and follow-up cue appear and clear when the condition expires or the target becomes unavailable.

#### Scenario: Check supported layouts
- **WHEN** selection and gameplay render at 390x844, 844x390 or 1440x900
- **THEN** existing controls remain reachable, the aim preview and feedback are visible, and relevant console or asset errors are absent.
