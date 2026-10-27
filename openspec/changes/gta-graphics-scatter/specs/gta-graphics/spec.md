## ADDED Requirements

### Requirement: A scattering sunset sky
The sunset shade SHALL colour the sky from Rayleigh and Mie scattering, orange toward the sun and blue at the zenith. The opening pitch of −16 and the walking socket at Y 70 and Z 110 SHALL stay, and the spawn weather SHALL stay clear.

#### Scenario: The horizon toward the sun is red and the zenith is blue
- **WHEN** the scattering sky is sampled one degree above the horizon toward the sun, and again at seventy degrees
- **THEN** the horizon sample is redder than it is blue, and the zenith sample is bluer than it is red

#### Scenario: The opening camera stays
- **WHEN** the avenue is framed
- **THEN** the look stays at pitch −16 and the socket stays at Y 70 and Z 110
