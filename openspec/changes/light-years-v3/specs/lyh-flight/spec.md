## ADDED Requirements

### Requirement: Car-like flight on a level plane
The Tern SHALL drive like a car on an invisible road in each place's plane, where 1 u is one ship length. With no input it SHALL cruise at 24 u/s; the gas SHALL take it to 30 u/s, boost to 42 u/s, and nothing SHALL go faster than 48 u/s. Steering SHALL turn the ship about the plane's normal and the horizon SHALL never tilt. Pitch SHALL stay within 35° and level itself when let go. The ship SHALL stop only while the player brakes.

#### Scenario: Hands off
- **WHEN** the player lets go of every control in free drive
- **THEN** the ship eases to 24 u/s and keeps flying, and the horizon stays level while the hull banks through turns

#### Scenario: Gas and brake
- **WHEN** the player holds the gas from cruise
- **THEN** the speed passes 28.5 u/s within 2.5 s
- **AND** holding the brake instead slows the ship at 17 u/s² to a stop, where steering turns it on the spot, and letting go brings it back to 95% of cruise in about 1 s

#### Scenario: Climb and level
- **WHEN** a desktop player at 1440×900 holds R and then lets go
- **THEN** the nose rises to at most 35°, and within 1.0 s of letting go the pitch is under 3° and the ship holds its new height

### Requirement: Drift and drift-boost
Holding drift (Space, B, or BRAKE with a steer of 0.35 or more) at 12 u/s or more SHALL start a drift. With auto-drift on, the touch default, a hard turn (0.85 for 0.15 s at 18 u/s or more) SHALL start one by itself. The tail SHALL slide out, and sparks SHALL heat through red, white and blue tiers after about 0.88, 1.68 and 2.48 s of full in-turn steer. Letting go SHALL snap the ship forward with a drift-boost of 0.6, 1.2 or 2.0 s by tier.

#### Scenario: The first drift-boost on a phone
- **WHEN** a new player in portrait at 390×844 holds a hard turn round the giant galaxy in the Sloan Bend ring at cruise speed
- **THEN** sparks turn red within 1 s and white within 1.8 s, and lifting the thumb shoots the ship out above 37 u/s

#### Scenario: A drift on desktop
- **WHEN** a player at 1440×900 holds Space and D at cruise until the white sparks and then lets go of Space
- **THEN** a "kssh" hop starts the drift, a chime marks each tier, and the speed peaks at 37 u/s or more and stays above 30 u/s for 2.5 s

#### Scenario: Tiers fill the bar
- **WHEN** a drift reaches tiers 1, 2 and 3
- **THEN** the drift pips over the ship light one by one and the boost bar gains 0.08, 0.15 and 0.25

### Requirement: The boost bar pays for risk
The boost bar SHALL fill only from risk and discovery: near misses, hairlines, threads, skims, drafts, slingshots, takedowns, scans, sparks, pads and drift tiers. Boost SHALL work whenever the bar holds fuel, and a full bar SHALL last 3 s. A crash SHALL cost 0.25 of the bar. Risky events less than 3 s apart SHALL build a chain whose points multiply by 2, 3, 4 and 5 at 3, 6, 10 and 15 events and bank after 3 s.

#### Scenario: A near miss
- **WHEN** a traffic galaxy's core passes within 2.0 u of the ship at a closing speed of 10 u/s or more
- **THEN** a "zzip" plays panned to that side, an orange NEAR tick shows, the view shakes a little and the bar gains 0.06
- **AND** within 0.6 u it is a HAIRLINE with an octave sparkle and +0.12

#### Scenario: Boost on each device
- **WHEN** the player holds Shift at 1440×900, holds BOOST on a phone, or flicks the stick up 48 px within 150 ms
- **THEN** the speed reaches 95% of 42 u/s within 0.4 s, the view widens, the dust stretches into lines and the engines glow blue-white
- **AND** a flick gives a 1.0 s burst and does not pitch the ship

#### Scenario: A head-on loses the chain
- **WHEN** the chain stands at ×3 and the ship hits a galaxy head-on
- **THEN** the chain is lost without banking and the bar drops by 0.25

### Requirement: Crashes keep the flow
A hit SHALL never end a run or stop the ship. A scrape, meeting a surface at under 35°, SHALL keep 90% of the speed and turn the ship along it. A head-on SHALL bounce the ship off at 40% of its speed, never under 6 u/s, with steering halved for 0.4 s. A head-on above 32 u/s SHALL be a big crash: 0.5 s at 0.3 speed in which steering bends the rebound by up to 40°. The ship SHALL never pass through a collider, even at 48 u/s.

#### Scenario: A scrape
- **WHEN** the ship meets a galaxy's core at 20° at top speed
- **THEN** it keeps at least 88% of its speed, slides along, and a gritty scrape plays with a spray of sparks

#### Scenario: A head-on
- **WHEN** the ship flies straight into a giant's core at cruise
- **THEN** it bounces off at 6 u/s or more, flickers for 0.6 s, and is back to 95% of cruise within 1.6 s

#### Scenario: No tunnelling
- **WHEN** the ship flies at 48 u/s straight at a 0.6 u dwarf galaxy
- **THEN** the hit registers and the ship does not pass through it

### Requirement: Wells and the slingshot
Giants and black holes SHALL pull the ship with a force that falls with the square of distance and ends at 3 times the well radius. Drifting inside a well's sling ring SHALL charge the drift 1.5 times as fast. Releasing toward a marked exit within 8° SHALL be a PERFECT SLING worth one extra drift tier. An event or mission beat SHALL be able to switch named wells off, as Ride the Jet does for M87*.

#### Scenario: The Bend Giant makes the first drift easy
- **WHEN** a player who has never drifted drifts round the Bend Giant (well radius 14 u) at the Wall
- **THEN** the pull holds the ship on a circle round it and tier 2 comes on that first drift

#### Scenario: A perfect sling
- **WHEN** the player lets go of a drift round a giant within 8° of its marked exit
- **THEN** a rising whoosh and a bell play, PERFECT SLING shows, and the drift-boost is one tier higher

### Requirement: Towing, cargo and takedowns
The ship SHALL tow a load on a 6 u tether that swings wide on turns and never snaps. It SHALL hook on by itself after 0.5 s inside the tow ring behind a load and let go after a 1.0 s hold of the action control. While towing, top speed SHALL drop to 85%. Fragile cargo SHALL count each contact above 6 u/s. A side hit closing at 8 u/s or more on another ship SHALL be a takedown: the ship keeps 95% of its speed and gains 0.25 bar.

#### Scenario: Hook on
- **WHEN** the ship holds inside the tow ring 6 u behind a drifting load for 0.5 s
- **THEN** a clunk plays, the tether latches, and the load swings wide on the next turn

#### Scenario: A takedown
- **WHEN** the ship side-hits a Magpie closing at 8 u/s or more
- **THEN** a crunch and a falling whistle play, TAKEDOWN shows, the Magpie spins out for 1.2 s, and the Tern keeps 95% of its speed

#### Scenario: Soft touches do not count
- **WHEN** the ship carries fragile cargo and brushes traffic at 5 u/s
- **THEN** the contact count stays the same

### Requirement: Zone edges turn the ship round
Past a place's rim the ship SHALL turn back by itself over a 60 u band at up to 1.2 rad/s, with no crash and no loss of the run. Dot SHALL say "Turning back. Edge of the map." at most once every 20 s.

#### Scenario: Flying out
- **WHEN** the player boosts straight out past the rim and holds no steer
- **THEN** the ship heads back inward within 5 s, never goes more than 120 u past the rim, and a low warning tone plays

### Requirement: Chase camera and the feel of speed
The camera SHALL follow on a critically damped spring and widen with speed, from 90° vertical in portrait, 86° across in landscape and 82° across on desktop, with a kick of 10° to 12° on boost. Speed dust SHALL stretch into lines with speed, shake SHALL be trauma squared, and the aim SHALL lean into a drift (14° in portrait, 6° elsewhere) so the body the ship drifts round stays in view. There SHALL be no motion blur, and the target SHALL be 60 fps.

#### Scenario: The giant stays in view in portrait
- **WHEN** a player at 390×844 drifts a full lap round the Bend Giant
- **THEN** the giant's core is on screen for at least 80% of the lap

#### Scenario: The ship sits low on every screen
- **WHEN** the ship cruises at 390×844, 844×390 and 1440×900
- **THEN** it sits at 0.60 of the screen height from the top in portrait and 0.66 in landscape and on desktop, clear of every HUD element

#### Scenario: A boost kick
- **WHEN** a player at 1440×900 starts a boost from cruise
- **THEN** the view widens by up to 12° within 0.15 s, eases back over 0.6 s when the boost ends, and the shake fades within a second

### Requirement: Controls on every device
Phones SHALL default to a floating stick and pedals with auto-cruise in portrait and landscape: the stick steers and climbs, GAS, BRAKE/DRIFT and BOOST sit under the right thumb, and nothing but the stick needs pressing. One thumb SHALL be a setting. Desktop SHALL steer with A and D or the arrows, gas with W, brake with S, drift with Space, boost with Shift and act with E or Enter, with mouse steer as a setting. A standard gamepad SHALL work too.

#### Scenario: Stick and pedals in portrait
- **WHEN** a player at 390×844 puts a thumb down in the lower steer area and drags 56 px to the right
- **THEN** the ship turns right at full steer, a touch on GAS raises the speed toward 30 u/s, and a touch on a pedal never steers

#### Scenario: Two thumbs in landscape
- **WHEN** a player at 844×390 steers with the left thumb (x 47 to 380) and rolls the right thumb from GAS onto BRAKE while steering
- **THEN** the ship drifts without the right thumb lifting, and BOOST fires when that thumb slides onto it

#### Scenario: Keys and gamepad
- **WHEN** a player at 1440×900 presses W, A, D, S, Space and Shift, or moves a gamepad's left stick and presses A
- **THEN** the ship gasses, steers, brakes, drifts and boosts as labelled, and the gamepad takes over only on a button press

#### Scenario: One thumb
- **WHEN** the player picks one thumb in settings and plays in portrait
- **THEN** a touch held in the lower 62% steers with the gas on, lifting it returns to cruise, a second finger drifts, and the GAS and BRAKE pedals are gone
