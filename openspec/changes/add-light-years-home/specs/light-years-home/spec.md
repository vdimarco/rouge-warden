## ADDED Requirements

### Requirement: Quest and route
Light Years Home SHALL take the player from the Sloan Great Wall to Earth through 15 landmark stops in 4 chapters, in the order of the reference video. It SHALL add a spot with no travel after Andromeda and after the Pleiades, and a fork after the Andromeda lock. The route SHALL be 1,215,266,893 light-years long, within 0.1 %, measured from the object positions.

#### Scenario: First choice comes quickly
- **GIVEN** a first run at 1440×900, 390×844 or 844×390
- **WHEN** the player presses Play and touches nothing else
- **THEN** within 14 seconds the Laniakea ring and its label show, rings A, B and C appear, and one ring pulses with a hint

#### Scenario: Landmarks in order
- **WHEN** a careful player plays a new journey to the end
- **THEN** each stop runs clue, scan, flight and reveal in that order, and a chapter card comes between chapters
- **AND** the stops come in this order: Coma, Virgo, Fornax, Andromeda, the Milky Way, Carina, Orion's Belt, the Orion Nebula, Betelgeuse, the Pleiades, Aldebaran, Sirius, Alpha Centauri, the Sun and Earth

#### Scenario: Spot after a landmark
- **WHEN** the Andromeda or the Pleiades reveal ends
- **THEN** a scan for Triangulum or Antares runs with no flight, both clocks stay the same, and a find on the first try scores 300

#### Scenario: Fork after Andromeda
- **WHEN** the player locks Andromeda
- **THEN** a fork offers the Local Sheet and the edge of the Local Void
- **AND** either branch reaches Andromeda with the same light-years still ahead, and the Sheet with no crack scores 400

### Requirement: Scan and choosing a landmark
At each stop the game SHALL show a clue and three unnamed candidates in rings A, B and C, with the letters seeded per run. Exactly one candidate SHALL match every part of the clue. Opening a candidate SHALL show a card with a telescope view, 3 short facts and SET COURSE. A wrong lock SHALL name the decoy, say why it is wrong, grey its ring and add heat to the next flight. The third lock SHALL always be right.

#### Scenario: Open a card on desktop
- **GIVEN** the scan at stop 1 at 1440×900
- **WHEN** the player clicks ring B or presses 2
- **THEN** a card for candidate B opens with a telescope view that is not black, 3 facts and SET COURSE

#### Scenario: Lock a decoy
- **GIVEN** a decoy's card is open
- **WHEN** the player presses SET COURSE
- **THEN** a caption names the decoy and says why not, its ring greys out, the next flight starts 0.25 hotter (at most 0.5 in all), and the find at this stop can score at most 400

#### Scenario: Third lock is always right
- **GIVEN** two decoys were locked at this stop
- **WHEN** the player locks the last ring
- **THEN** the flight starts and the find scores 100

#### Scenario: Candidates in view
- **GIVEN** any stop or spot at 1440×900, 390×844 or 844×390
- **WHEN** its scan opens
- **THEN** all three candidates are inside the free part of the screen, not under the top row, the card, the chips or the flight strip

### Requirement: Flight, throttle, heat and cracks
In flight, holding SHALL raise the throttle and letting go SHALL lower it. Each zone of space SHALL have a speed limit, shown as a notch on the throttle bar, where heat from gas impacts and from the blueshifted cosmic background equals the Lens rating of 10¹² W/m². Above the limit heat SHALL build, and at full heat a pane SHALL crack. Each leg SHALL end with a 1.2 second drop-out at the target.

#### Scenario: Hold and let go
- **GIVEN** a flight
- **WHEN** the player holds thrust (a pointer on the scene, or Space) and then lets go
- **THEN** the throttle rises at 0.42 per second while held and falls at 0.9 per second after release

#### Scenario: Heat over the limit
- **GIVEN** the throttle is above the zone's notch, so the heat ratio r (heat on the Lens over its rating) is above 1
- **WHEN** time passes
- **THEN** the heat bar rises at min(1.5, 0.55 ln r) per second
- **AND** once the throttle drops so that r is below 0.8, the heat bar falls at 0.22 per second

#### Scenario: Crack
- **GIVEN** zero heat in open space
- **WHEN** the player holds full throttle
- **THEN** after 1.15 ± 0.05 seconds a pane cracks: one pane is lost, heat drops to 0.4, the throttle drops to 0.1 below the notch, input is locked for 0.8 seconds, and the caption reads "SHIELD CRACKED."

#### Scenario: Drop-out
- **WHEN** the last 1.2 seconds of a leg begin
- **THEN** the throttle goes to 0, the view eases to rest, input is ignored, and the ship stops exactly at the target

### Requirement: Fair challenge and seeded journeys
A careful player who stays under the notches SHALL reach home without a crack, a player who pushes closer to the notches SHALL score more, and reckless play SHALL lose. A journey SHALL play out the same for the same seed and the same inputs.

#### Scenario: Careful and skilled play
- **GIVEN** seeds 1 to 5
- **WHEN** the careful bot plays each seed
- **THEN** it reaches home with no cracks on every seed
- **AND** the skilled bot scores more than the careful bot on every seed

#### Scenario: Reckless play
- **WHEN** the reckless bot plays any seed
- **THEN** it loses its third pane before stop 4

#### Scenario: Same seed, same journey
- **GIVEN** the same seed and the same sequence of inputs
- **WHEN** two journeys run
- **THEN** their game states are deep-equal at the end

### Requirement: Clocks and Earth timeline
The game SHALL keep two exact clocks from the true distance flown: ship time dτ = dℓ / sinh η and Earth time dt = dℓ / tanh η, where η is the ship's true rapidity. The Earth date SHALL be today minus the route light-years still ahead, so the journey arrives today. Scans SHALL take no time on either clock. Each "On Earth" history card SHALL show once, when the Earth date passes its date. In chapter IV the clock line SHALL also show the year of the radio from Earth heard at that point.

#### Scenario: Exact clocks
- **GIVEN** a constant rapidity η
- **WHEN** the ship flies ℓ light-years
- **THEN** ship time equals ℓ / sinh η and Earth time equals ℓ / tanh η, within 1e-9 relative
- **AND** on any flight, Earth time on the leg is never less than the distance flown in light-years

#### Scenario: On Earth cards
- **WHEN** the Earth date passes a milestone's date
- **THEN** its "On Earth" card shows once; the asteroid card shows on leg 3 after 98 % of the leg

#### Scenario: Radio from home
- **GIVEN** chapter IV and today pinned to 13 October 2026
- **WHEN** the player flies the legs to Sirius and Alpha Centauri
- **THEN** the clock line reads `EARTH YYYY · RADIO YYYY`, and the radio year is 1885 ± 1 at Aldebaran (no radio yet), 2004 ± 1 at Sirius and 2018 ± 1 at Alpha Centauri

#### Scenario: Arrive today
- **GIVEN** the device clock reads 13 October 2026
- **WHEN** the player reaches Earth
- **THEN** the ending shows "TUESDAY", "13 OCTOBER 2026", "YOU ARE HOME", both clocks and the address rings
- **AND** the best save records `home: true`, and after a reload the title best line starts "BEST " and names the ship time

### Requirement: The light-speed view
The sky SHALL show relativistic aberration, Doppler colour and brightness change on every point. The picture SHALL use a view speed tied to the throttle, at most 0.986c, and the How it works page SHALL say so. HUD numbers SHALL use the ship's true speed. Rings, labels and picking SHALL use the same projection as the picture. A glow dead ahead SHALL brighten with the heat ratio.

#### Scenario: Full throttle crowds and blues the sky
- **GIVEN** the leg 1 flight at 1440×900
- **WHEN** a frame renders at throttle 1
- **THEN** at least 60 % of the light lies within 30° of straight ahead, against at most 25 % at throttle 0
- **AND** the blue-to-red ratio in the centre is at least 1.2 times its value at throttle 0

#### Scenario: The sky unfolds at drop-out
- **WHEN** the drop-out at the end of leg 1 finishes
- **THEN** the share of light ahead and the blue-to-red ratio are both within 10 % of their throttle 0 values

#### Scenario: Rings stay on their objects
- **GIVEN** a flight at throttle 1 at 1440×900
- **WHEN** a frame renders
- **THEN** every ring is within 2 px of its object's projected position

### Requirement: Art at each scale
Every scale SHALL be drawn in the reference video's look with procedural art only, no photos or network textures: crisp white points on black, the warm dusty galactic band, a magenta Orion Nebula, blue Pleiades, a white Sun, a blue Earth and a grey Moon. A visual test SHALL save screenshots at 1440×900, 390×844 and 844×390, build a contact sheet and assert pixel statistics, and a person SHALL review the contact sheet before merge.

#### Scenario: Title sky
- **WHEN** the title shows
- **THEN** between 0.2 % and 5 % of pixels are lit (luminance above 0.25) and fewer than 0.5 % are above luminance 0.9

#### Scenario: Milky Way reveal
- **WHEN** the Milky Way reveal shows
- **THEN** a barred spiral fills at least 30 % of the short side, at least 25 % of the pixels inside its ring are above luminance 0.08, and the centre 10 % of the ring is at least 3 times brighter than its outer 10 %

#### Scenario: Orion's colours
- **WHEN** the Orion Nebula scan and the Betelgeuse scan show
- **THEN** the Orion Nebula has red above 1.5 times green and blue above green, the Horsehead is under half its brightness, the Witch Head is bluer than red, Betelgeuse has red over blue of at least 1.3, and Bellatrix has blue over red of at least 1.0

#### Scenario: Home
- **WHEN** the Sun reveal, the approach to Earth and the ending show
- **THEN** the Sun's luminance is at least 0.8, Jupiter is redder than blue, Earth is bluer than red, the Moon's saturation is under 0.15, and the label "Home" is coloured `#f08a2c`

### Requirement: Scoring
The game SHALL score each find by lock (+1,000, +400 or +100), each first-try spot (+300), each leg's flight grade, each clean crossing (+50), the Sheet branch with no crack (+400), a gentle arrival (+500), each pane left at home (+1,000) and a perfect journey (+5,000), and SHALL take 400 for each crack. The end card SHALL show the score and a rank.

#### Scenario: Flight grade
- **WHEN** a leg ends
- **THEN** it grades round(500 × clamp(τ_par / τ, 0, 1.6)) points, where τ is the ship time the leg took and τ_par is the ship time at each zone's limit, so a leg flown at par grades 500 and a leg that took twice par grades 250

#### Scenario: Gentle arrival
- **WHEN** the player keeps the throttle at 0 for the last 1.0 second before the drop-out at Earth
- **THEN** the arrival scores 500

#### Scenario: Perfect journey
- **GIVEN** every landmark found on the first lock, both spots found on the first try, no crack and no retry
- **WHEN** the player reaches Earth
- **THEN** the journey scores a 5,000 bonus
- **AND** a journey that used Try chapter again gets no bonus

#### Scenario: End card
- **WHEN** a journey reaches home
- **THEN** the card shows the score; the rank (Drifter under 15,000, Wayfinder under 25,000, Navigator under 32,000, Lightkeeper from 32,000); NEW BEST when it beats the save; first-try finds out of 17; cracks; ship time; top speed; retries; and the straight line home against the landmark route

### Requirement: Failure, retry and saves
Losing the third pane SHALL end the journey with a lost ending that offers Try chapter again, New journey and Switch game. Each chapter start SHALL restore one pane (max 3) and save progress, and Continue on the title SHALL resume it. Junk saves and blocked storage SHALL read as no save. The best save SHALL keep the higher score, the further stop, and the shorter ship time among journeys that reached home.

#### Scenario: Title with no save or a bad save
- **GIVEN** a fresh browser, or a best save that holds junk, at 1440×900, 390×844 or 844×390
- **WHEN** the page loads
- **THEN** the title reads Light Years Home, Play, How it works and Switch game are visible and at least 44 px, the best line reads "No journey home yet", the cosmic web draws behind, and no error is logged

#### Scenario: Chapter checkpoint
- **WHEN** the last reveal of chapter I, II or III ends
- **THEN** a chapter card shows its line
- **AND** at the next chapter start one pane returns (max 3) and progress is saved

#### Scenario: Lost and retry
- **GIVEN** one pane left
- **WHEN** a pane cracks
- **THEN** the lost ending names the stop and the year on Earth
- **AND** Try chapter again restarts the chapter with 3 panes, the chapter-start score and one more retry

#### Scenario: Continue a saved journey
- **GIVEN** a valid progress save at chapter III
- **WHEN** the page loads and the player presses Continue
- **THEN** the button reads "Continue (Chapter III)", and play resumes at Orion's Belt with the saved score and panes

### Requirement: Controls per device
The game SHALL support keyboard and mouse on desktop and touch on phones in portrait and landscape, with one verb per phase: look and tap in the scan, hold and let go in flight. A tap SHALL be a press and release within 250 ms and 10 px. Anything longer SHALL be a look-drag in the scan or thrust in flight. Thrust SHALL stop whenever the pointer or the page lets go.

#### Scenario: Desktop keys
- **GIVEN** a scan at 1440×900
- **WHEN** the player presses Tab three times
- **THEN** the open card cycles A, B, C
- **AND** 1, 2 and 3 open A, B and C, Enter sets course, Esc closes the card before it pauses, and in flight holding Space, W, ↑ or the left mouse button pushes toward light

#### Scenario: Phone tap
- **GIVEN** the scan at stop 1 at 390×844 or 844×390 with touch
- **WHEN** the player taps within 22 px of a ring, or taps a chip
- **THEN** that candidate's card opens, and SET COURSE is at least 48 px tall and inside the viewport

#### Scenario: Look around and swing to a ring
- **GIVEN** a scan
- **WHEN** the player drags one finger or the mouse 200 px
- **THEN** the view turns, stays within ±60° of the stop's framing, and rings stay within 2 px of their objects
- **AND** tapping an edge chevron swings the view until that candidate's ring is on screen

#### Scenario: Thrust always stops
- **GIVEN** thrust is held
- **WHEN** a `pointerup`, `pointercancel`, `lostpointercapture` or `blur` event arrives, or the page is hidden
- **THEN** thrust stops at once

### Requirement: Access settings
The game SHALL offer three settings, saved in the browser, with unknown saved values falling back to the defaults: Thrust (Hold, or Tap to toggle), Captions (Normal, or Slow at 1.5 times the duration) and Hints (On pulses the target ring after 25 seconds idle in a scan; Off does not).

#### Scenario: Tap to toggle thrust
- **GIVEN** Thrust is set to Tap to toggle
- **WHEN** the player taps, waits 1 second, and taps again
- **THEN** the throttle rises after the first tap and falls after the second

#### Scenario: Slow captions
- **GIVEN** Captions is set to Slow
- **WHEN** a caption plays
- **THEN** each word and each chunk lasts 1.5 times as long as in Normal

#### Scenario: Hints
- **GIVEN** Hints is on
- **WHEN** a scan sits idle for 25 seconds
- **THEN** the target ring pulses
- **AND** with Hints off, it does not

#### Scenario: Bad settings save
- **GIVEN** the settings save holds unknown values
- **WHEN** the page loads
- **THEN** the game uses Hold, Normal and Hints on

### Requirement: Captions and HUD
Captions SHALL be page text in the reference video's style: bold uppercase white words, one short chunk at a time, with the current word in orange. Each full sentence SHALL also go once to a polite live region for screen readers. The words SHALL be our own, with no run of 6 words from the video's narration. The HUD SHALL show both clocks, the chapter and the stop, and in flight the speed shortfall, time rate, throttle, notch, heat and panes.

#### Scenario: Caption look
- **WHEN** any caption shows
- **THEN** its chunk has at most 3 words and 18 characters, the current word is `rgb(240, 138, 44)`, the other words are `rgb(255, 255, 255)`, and the caption box is at most 2 lines and inside the viewport

#### Scenario: Hurry a caption
- **GIVEN** the intro is playing
- **WHEN** the player taps, clicks or presses Enter
- **THEN** the current caption ends at once and the next one starts

#### Scenario: Coaching on the first run only
- **GIVEN** a first run
- **WHEN** the first waypoint galaxy is next on leg 1
- **THEN** the caption "Galaxy ahead. Let go!" plays
- **AND** on a later run the first two intro lines are skipped and no coaching shows

#### Scenario: Flight strip
- **WHEN** a flight runs
- **THEN** the strip shows `LIGHT − … PER SECOND` and `1 SECOND HERE = …` from the ship's true speed, for example `LIGHT − 2.5 NANOMETRES PER SECOND` at the open-space limit
- **AND** when the next zone is 1.5 seconds of screen time away, a hollow tick marks its notch on the throttle bar

### Requirement: Supported layouts
The game SHALL support desktop at 1440×900, phone portrait at 390×844 and phone landscape at 844×390. In every layout and phase, the caption box SHALL NOT overlap the top row, the flight strip, the card or the chips; every button SHALL be at least 44 px and inside the safe area; the page SHALL NOT scroll sideways; and the arcade link SHALL be at least 44×44 px with nothing over its centre.

#### Scenario: Desktop
- **GIVEN** a 1440×900 window
- **WHEN** the title, a scan with a card open, a flight, a chapter card, the ending and the lost card show in turn
- **THEN** the card is a right panel 360 px wide, captions sit at about 70 % of the height, nothing overlaps the caption box, and nothing scrolls sideways

#### Scenario: Phone portrait
- **GIVEN** a 390×844 touch screen
- **WHEN** the same phases show
- **THEN** the card is a bottom sheet with the caption above it, the chips sit in the bottom row, every button is at least 44 px inside the safe area, nothing overlaps, and nothing scrolls sideways

#### Scenario: Phone landscape
- **GIVEN** an 844×390 touch screen
- **WHEN** the same phases show
- **THEN** one 44 px top row holds the controls, the card is a 300 px right panel, captions take one line, the flight strip is 56 px high, nothing overlaps, and nothing scrolls sideways

#### Scenario: Turning the phone
- **GIVEN** a scan with card B open at 390×844
- **WHEN** the phone turns to 844×390
- **THEN** the game state is unchanged, card B is still open, and the landscape layout rules hold

### Requirement: Lifecycle, pause and sound
The game SHALL pause on Esc, P or the pause button, and when the window loses focus, the page is hidden or unloaded, or the game switcher opens. Only Resume SHALL resume play, and the game state SHALL NOT change while paused. Sound SHALL be synthesised in the browser, start on the Play tap, go silent while the page is hidden, and follow the shared `arcade.sound` mute.

#### Scenario: Pause
- **GIVEN** a journey in play at any supported layout
- **WHEN** the player presses Esc, P or the pause button
- **THEN** the game pauses, the ship clock, the phase and the rest of the state stay the same over 800 ms, and only Resume resumes play

#### Scenario: Leaving the page
- **WHEN** the window loses focus, the page is hidden, `pagehide` fires, or the player opens the game switcher
- **THEN** the game pauses and held inputs clear
- **AND** while the switcher is open, keys and pointers do nothing in the game

#### Scenario: Mute
- **GIVEN** sound is on
- **WHEN** the player presses M or the sound button
- **THEN** `arcade.sound` becomes `false`, and after a reload the game stays muted

#### Scenario: Silent while hidden
- **WHEN** the page is hidden in each of the four ways the arcade's quiet check uses
- **THEN** the game's audio goes silent and comes back when the page shows again

### Requirement: Graphics failure
When WebGL2 is not available, the WebGL context is lost, or the game script fails to load, the game SHALL show a "Graphics could not start" message with Try again, Back to the arcade and Switch game, and SHALL NOT raise a page error.

#### Scenario: No WebGL2
- **GIVEN** `getContext('webgl2')` returns null
- **WHEN** the page loads
- **THEN** "Graphics could not start" shows with Try again, a link to `/` and Switch game, and no page error is raised

#### Scenario: Context lost mid-flight
- **GIVEN** a flight in progress
- **WHEN** the WebGL context is lost
- **THEN** the game pauses and the graphics message shows

### Requirement: Reduced motion
When the player prefers reduced motion, the game SHALL replace camera sweeps with cuts, use crossfades only, keep the title backdrop still, and drop shake, twinkle, look inertia and vibration. Gameplay SHALL stay the same, and the word-by-word caption colour SHALL still run.

#### Scenario: Still title
- **GIVEN** reduced motion is set
- **WHEN** the title shows
- **THEN** two canvas screenshots taken 600 ms apart are identical

#### Scenario: Calm crack
- **GIVEN** reduced motion is set
- **WHEN** a pane cracks in flight
- **THEN** the view does not shake and the device does not vibrate, and the crack costs a pane and 400 points as usual

### Requirement: Performance budgets
The game SHALL pick a quality tier (high on desktop with a hardware GPU, mid on touch, low on a software renderer) and stay within that tier's budgets for points, draw calls, textures, sprite size and pixel ratio. Engine, camera, overlay and HUD work SHALL take at most 4 ms per frame at p95. Slow frames SHALL step the quality down. The game files SHALL download in at most 200 KB raw, with three.js shared from `/vr/lib/`.

#### Scenario: Budgets hold in software rendering
- **GIVEN** the high tier at 1440×900 and the mid tier at 390×844
- **WHEN** the title, the leg 1 flight at throttle 1, the Milky Way fly-in, the Orion Nebula scan, the leg 15 flight and the ending each run for 300 stepped frames
- **THEN** each frame draws at most 120k points and 45 draw calls at high, and at most 50k points and 35 draw calls at mid
- **AND** star sprites stay at most 32 CSS px at high and 24 at mid, textures at most 96 MB and 48 MB, the pixel ratio at most min(dpr, 2) and min(dpr, 1.5), and CPU time per frame at most 4 ms at p95

#### Scenario: Slow frames step down
- **GIVEN** 3.5 seconds of 40 ms frames
- **WHEN** the game adapts
- **THEN** the pixel ratio drops by 0.5
- **AND** more slow frames take the ratio to 1, then lower the point counts, then the nebula layers, while 5 seconds of 15 ms frames change nothing

#### Scenario: Software renderer
- **GIVEN** only a software WebGL renderer is available
- **WHEN** the game starts
- **THEN** it starts at the low tier (pixel ratio 1, at most 25k points, 25 draw calls, 16 CSS px sprites and 24 MB of textures) and sets `canvas.dataset.backend` to `software`

#### Scenario: Real hardware
- **GIVEN** a desktop with a hardware GPU at 1440×900, and a Pixel 6 or iPhone 12 class phone
- **WHEN** 600 frames of the leg 1 flight and of the Milky Way fly-in run on the desktop, and the chapter III flights and the fly-in run on the phone in portrait and landscape
- **THEN** the desktop median frame time is at most 16.7 ms with p95 at most 20 ms, and the phone p95 is at most 20 ms at the mid tier and at most 33 ms at the low tier

### Requirement: Arcade machine
The Cottage Arcade SHALL offer Light Years Home at `/light-years-home/` in the shared game switcher and as a cabinet, the seventh and last machine in the Action group. The cabinet SHALL show a best line from a valid save and its plain line otherwise. The game page SHALL load `/arcade/quiet.js` as its first script and report to analytics as `light-years-home`.

#### Scenario: Cabinet best line
- **GIVEN** the best save is `{"score":6800,"reached":3,"home":false}`
- **WHEN** the arcade loads
- **THEN** the cabinet line reads `BEST 6,800 · STOP 3 OF 15`
- **AND** with a junk save it reads `CROSS A BILLION LIGHT-YEARS`

#### Scenario: Launch from the arcade
- **WHEN** the player chooses LIGHT YEARS HOME in the machine picker and starts it
- **THEN** `/light-years-home/` loads

#### Scenario: Action group
- **WHEN** the Action group opens
- **THEN** it lists seven games, with Light Years Home last

#### Scenario: Page scripts
- **WHEN** the page source is read
- **THEN** the first script is `/arcade/quiet.js`, before the import map, and `analytics.js` has `data-game="light-years-home"`
