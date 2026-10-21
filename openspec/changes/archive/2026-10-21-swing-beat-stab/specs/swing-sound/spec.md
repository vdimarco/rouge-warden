## ADDED Requirements

### Requirement: A mission stabs, a trial counts in
A job that carries a mission name SHALL play a short brass stab when it starts. A job with no mission name, a crime, and a trial SHALL play the trial countdown. The stab SHALL put its sound in the first third of a second and SHALL be quiet after four fifths of a second. The stab's voice SHALL last at least six tenths of a second, through the second brass note. The trial countdown SHALL still be sounding after four fifths of a second. The first flush SHALL NOT play the stab.

#### Scenario: The first flush
- **WHEN** one clog is flushed and no mission starts
- **THEN** the stab does not play and the trial countdown does not play

#### Scenario: The second flush
- **WHEN** the second clog is flushed and the falling rescue starts
- **THEN** the short stab plays and the trial countdown does not

#### Scenario: An odd job
- **WHEN** a job with no mission name starts
- **THEN** the trial countdown plays and the short stab does not

#### Scenario: The two cues
- **WHEN** both cues are rendered
- **THEN** the stab is quiet after four fifths of a second and the countdown is still sounding

#### Scenario: The stab's voice
- **WHEN** the stab is played
- **THEN** its voice lasts at least six tenths of a second
