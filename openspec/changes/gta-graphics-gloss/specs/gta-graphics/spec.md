# gta-graphics

## ADDED Requirements

### Requirement: Wet asphalt and car paint take a specular lobe

The wet road uses roughness 0.15 and F0 0.04. The car paint clearcoat uses roughness 0.22 and F0 0.04. The directional light's specular scale is 1. The opening camera stays at pitch −16 with the socket at (0, 70, 110). The opening weather stays clear.

#### Scenario: A grazing wet road reflects the sky

- **WHEN** the view skims a wet road
- **THEN** the sky reflection is stronger than the reflection on a head-on panel, and a face aimed at the sun's highlight is brighter than a face turned away

#### Scenario: The opening aim stays

- **WHEN** the player spawns on foot
- **THEN** the look is pitch −16, the socket is (0, 70, 110), and the weather is clear
