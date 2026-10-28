# swing-instance-uploads Specification

## Purpose
Incremental Full Swing rendering work reduction, with no FPS-benefit merge gate.

## Requirements

### Requirement: Upload populated instance ranges
Dynamic character/sign buffers SHALL upload only populated attribute components after initial allocation, preserving visible output and instance counts.

#### Scenario: Shrink, grow and empty
- **WHEN** populated counts change
- **THEN** uploaded ranges cover currententries, instanceCount matches andzeroentries require no upload

#### Scenario: Appearance
- **WHEN** the samefigures/signs render
- **THEN** their pixels, motion andpopulation are unchanged
