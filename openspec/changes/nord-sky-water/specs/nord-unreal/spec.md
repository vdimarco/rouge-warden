## ADDED Requirements

### Requirement: Readable Parc La Fontaine pond water
The ponds SHALL read as water at walking height in the default view and in F2: darker and deeper away from the banks, a soft line at the shore, small moving ripples that follow the wind, and rings when it rains. The pond geometry, outlines, island, actors, mesh assets and material path SHALL stay the same.

#### Scenario: Look across the north pond on a calm day
- **WHEN** a player stands at the north pond edge in clear weather at 1280×720 or 1920×1080
- **THEN** the water near the bank is lighter and warmer than the water in the middle
- **AND** reflections of the sky, trees and buildings are sharper than before and broken by small moving ripples instead of broad slow bands
- **AND** a thin, broken lighter line follows the bank and the island edge.

#### Scenario: See rain on the pond
- **WHEN** drizzle or rain falls and the player looks at either pond
- **THEN** small rings appear and spread on the water, more of them in rain than in drizzle
- **AND** the rings stop shortly after the rain ends.

#### Scenario: Keep the comic view of water
- **WHEN** the player presses F2 at a pond
- **THEN** the water keeps continuous reflection gradients without light bands in calm weather, as before
- **AND** the pond actors, meshes, triangles, island hole and `M_PondWater` path pass the existing park verification unchanged.

### Requirement: Montréal day and night
The game SHALL run a shared clock in which a full day takes 40 real minutes by default and night passes twice as fast as day. The sun, moon, sky, exposure, street lamps, lit windows and car headlights SHALL follow the clock. Both players SHALL see the same time.

#### Scenario: Play into the evening
- **WHEN** a host starts the game without QA flags
- **THEN** the game starts in the mid-afternoon of a mid-October day
- **AND** the sun sets in the west after about six real minutes, with a coloured sky and longer shadows when the weather is clear or breezy
- **AND** street lamps, windows and headlights come on as the light goes, and the scene stays readable at night under moonlight and lamps
- **AND** the top-right map panel shows the time and weather under the map, above the map credits.

#### Scenario: Join at night
- **WHEN** a friend joins a session after dark
- **THEN** the friend sees the same time of day and the same weather as the host within a few seconds of joining.

#### Scenario: Read signs and the worklight at night
- **WHEN** it is night and the player approaches lit signs, comic illustrations, mission captions or the mission 1 worklight
- **THEN** they are readable and not blown out to white
- **AND** the worklight still lights a clear pool on the ground.

#### Scenario: Preserve crew colours at night
- **WHEN** any supplied crew member is viewed after dark in standard or comic view
- **THEN** their daylight-calibrated emissive fill follows the sky exposure instead of turning the face and clothing white
- **AND** the source textures, base colour and daytime appearance remain unchanged.

#### Scenario: Set the time
- **WHEN** the host starts with `-NordHour=21` or types `NordTime 21` in the console
- **THEN** the clock jumps to 21:00 for both players.

### Requirement: Variable and gloomy Montréal weather
The game SHALL move between clear, breezy, overcast, fog, drizzle and rain over time with smooth transitions, and gloomy weather SHALL be common. The host SHALL choose the weather and both players SHALL see the same weather.

#### Scenario: Watch the weather change
- **WHEN** a session runs for about half an hour without commands
- **THEN** the weather changes several times, each change blending over one to two minutes
- **AND** in most sessions overcast, fog, drizzle or rain hold for at least half of that time, because a session joins the weather chain part-way through instead of always starting clear.

#### Scenario: Walk in gloomy weather
- **WHEN** the weather is overcast, fog, drizzle or rain
- **THEN** the sky turns grey, shadows soften, colours are muted and distant buildings fade into fog
- **AND** in drizzle and rain, streaks fall around the player, rain sounds play, roads and pavements darken and shine, puddles form, and the pond shows rings
- **AND** roads stay wet for a few minutes after the rain stops.

#### Scenario: Choose the weather
- **WHEN** the host starts with `-NordWeather=Fog` or types `NordWeather rain`
- **THEN** both players see the requested weather after a short blend, starting from the look that was showing.

#### Scenario: Guest asks for other weather
- **WHEN** the friend types `NordWeather clear` or `NordTime 12`
- **THEN** the sky does not change for either player
- **AND** the friend sees "Only the host can change the sky".

### Requirement: Fixed sky for verification
Existing QA, capture, story, HUD, package and profile runs SHALL keep the authored afternoon look unless they ask for a time or weather.

#### Scenario: Run an existing check
- **WHEN** the game starts with `-NordCapture`, `-NordCampaignQA`, `-NordNoCampaign`, `-NordNoCampaignSave`, `-NordStoryRenderChecks`, `-NordRenderChecks`, `-NordFixedSky` or CSV profiling
- **THEN** no sky actor runs, the sun, fog, sky light and exposure keep their saved values, and the HUD has no time line
- **AND** editor capture runs started with `-ExecutePythonScript` are pinned the same way.

#### Scenario: Capture a fixed night or storm
- **WHEN** such a run also passes `-NordHour=22 -NordWeather=Rain`
- **THEN** the sky stays at 22:00 in rain for the whole run, so captures and profiles are repeatable.
