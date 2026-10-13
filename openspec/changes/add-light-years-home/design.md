# Light Years Home design

## Direction and source of truth

The user asked for a game about "traveling at the speed of light. on some kind of quest." The uploaded video is the art
reference. Its look is the direction for every screen:

- pure black space and small white points (galaxies, then stars);
- thin white rings around landmarks, each with a thin diagonal leader line and a small white label;
- small grey info boxes ("Every dot is a galaxy", "Every dot is a star");
- bold uppercase white captions, two or three words at a time, with the current word in orange (`#f08a2c`);
- the order of the journey: a wall of galaxies, clusters, Andromeda, the Milky Way, nebulae, stars, the Sun, Earth.

The words are our own. The person who speaks in the video is never named, shown, quoted or imitated. A route test fails
if any run of 6 words from the video's narration appears in game text.

The design was settled before the build, after three competing designs were scored (a navigation puzzle, an arcade
flight and a cinematic quest). The cinematic quest won: it fits the request and the video best and plays best on a
phone. This file records its decisions. When the build changes a decision, this file changes with it.

## Quest and narrator

You wake up a billion light-years from home, inside the Sloan Great Wall. The star map is gone. The ship's forward
shield, the Lens, is also its telescope. It locks only onto things it can recognise, so you travel landmark by landmark,
in the video's order. The Lens has three panes.

Nothing outruns light. The landmark route is 1,215,266,893 light-years long, so that many years pass on Earth while you
travel. Your own clock runs slow: about 14 years pass for a careful pilot and about 7 for one who rides the speed
limits. The journey is set up so that you arrive today. When you
wake, Earth's date is 1.2 billion years before today, and Earth's history plays out on small "On Earth" cards as you fly.
In the last chapter radio from home reaches you, oldest first.

- Goal: get home.
- Doing well: name each landmark on the first lock, fly close to each zone's speed limit, keep the panes.
- Failure: the third pane breaks.

Narrator rules: second person, present tense, plain words, one idea per line, numbers as digits. Route text is written
as plain sentences. `core/captions.js` splits them into chunks of at most 3 words and 18 characters, because a 390 px
phone leaves 358 px for a 26 px caption line.

## Core loop

One stop takes about 30 seconds. There are 15 stops in 4 chapters, plus 2 spots and one fork. A run takes about
8 minutes.

| Step | Time | What happens | Input |
|---|---|---|---|
| Reveal | 3 to 4 s | You drop out of light speed. The sky unfolds, a ring and leader draw onto the landmark, its label writes on, and the reveal line plays. | tap hurries |
| Clue | 3 to 5 s | The next clue. Three unnamed candidates get rings A, B and C (letters seeded per run). Off-screen rings get an edge chevron. | tap hurries |
| Scan | 5 to 20 s | Look around. Open a candidate's card: a telescope view and 3 short facts. SET COURSE locks it. A wrong lock names the decoy, says why not, greys its ring and adds heat to the next flight. The third lock is always right. | drag, tap |
| Flight | 7 to 15 s | Hold to push toward light, let go to ease off. Each zone has a speed limit (the notch). Over it heat builds; at full heat a pane cracks. Earth's clock races and "On Earth" cards appear. | hold, release |

- A spot after Andromeda (Triangulum) and after the Pleiades (Antares) is a short scan with no travel. A first-try find
  scores 300.
- A fork after the Andromeda lock offers the Local Sheet (busier, +400 with no crack) or the edge of the Local Void
  (empty and safe). Both branches have the same declared length.
- Each chapter start restores one pane (max 3) and saves progress, so a phone player can stop after any chapter.

| Chapter | Stops | Info box | Chapter card line |
|---|---|---|---|
| I · The Wall | Coma, Virgo, Fornax | Every dot is a galaxy | ON EARTH: THE DINOSAURS ARE GONE. |
| II · Neighbours | Andromeda (+ Triangulum spot), Milky Way, Carina | Every dot is a galaxy, then Every dot is a star | ON EARTH: THE ICE AGE ENDS. PEOPLE START TO FARM. |
| III · The Orion Arm | Orion's Belt, Orion Nebula, Betelgeuse, Pleiades (+ Antares spot) | Every dot is a star | ON EARTH: COPERNICUS PUTS THE SUN AT THE CENTRE. |
| IV · Home | Aldebaran, Sirius, Alpha Centauri, the Sun, Earth | Radio from home | the ending |

**The first 30 seconds.** On a first run, rings A, B and C appear by about 13 seconds and the first flight starts by
about 20 seconds. Any tap, click or key hurries a caption. The opening says you are a billion light-years from home, the map is
gone, and home is inside the Laniakea ring, too big to aim at. Then the first clue, rings A, B and C, and a pulsing hint
on one ring. In the first flight, coaching lines teach hold, the speed shortfall, and letting go before a galaxy. On later
runs the first two lines are skipped and coaching is off.

## Physics

All formulas live in pure modules (`core/physics.js`, `core/gas.js`, `core/timeline.js`) and are tested in node.

**Speed.** The engine stores rapidity η: γ = cosh η, γβ = sinh η, β = tanh η, and 1 − β = 2 / (e^(2η) + 1), never
1 − tanh η. The open-space limit is η = 20.01: γ = 2.448 × 10⁸ and 1 − β = 8.3 × 10⁻¹⁸ (17 nines). The HUD shows it as
`LIGHT − 2.5 NANOMETRES PER SECOND`.

**Clocks.** Integrated every tick from the true distance dℓ in light-years, in the galaxy frame:

```
ship time   dτ = dℓ / sinh η      (years)
Earth time  dt = dℓ / tanh η      (years)
```

η stays above 6.8 on every leg, so Earth time per leg equals the leg length to well under a day. The Earth date is
`today − (route light-years still ahead)`. `today` is injected, so tests pin it. Scans take no time on either clock.
Par ship time at each zone's limit is about 4 years 355 days.

**Heat: why each zone has a speed limit.** Two real sources heat the front of the ship. Only the Lens rating is made up.

```
gas impacts        q_gas = n · 4.5067×10⁴ · (γ − 1) · β        W/m², n in atoms per cm³
cosmic background  q_cmb = (u c)/(2 γ⁴ β²) · [1/6 + (1 − β)⁻³/3 − (1 − β)⁻²/2]
                   ≈ (4/3) u c γ² = 1.669×10⁻⁵ γ²  for γ > 30
                   u c = 4σT⁴ = 1.2516×10⁻⁵ W/m², T = 2.7255 K
Lens rating        P = 10¹² W/m²
ratio              r = (q_gas + q_cmb) / P
zone limit         η_lim(n) = the η where r = 1 (bisection)
```

Each proton arrives with (γ − 1) m_p c². The background term integrates the D⁴-boosted intensity over the forward
hemisphere. Checks: q_cmb → σT⁴ = 3.129×10⁻⁶ W/m² as β → 0; zoneLimit(3e-8) gives γ 2.448e8; zoneLimit(1) gives γ 2.20e7
(η 17.60); zoneLimit(1000) gives γ 2.2e4 (η 10.70).

| Zone | n (atoms/cm³) | η limit | Set by |
|---|---|---|---|
| Void | 3×10⁻⁸ | 20.01 | cosmic background |
| Filament, Local Sheet | 2.5×10⁻⁷ | 20.01 | cosmic background |
| Galaxy halo | 10⁻³ | 20.00 | cosmic background |
| Cluster gas | 3×10⁻³ | 19.99 | cosmic background |
| Local Bubble, superbubble | 0.005 | 19.98 | both |
| Magellanic Stream | 0.03 | 19.84 | both |
| Inter-arm gas | 0.1 | 19.48 | both |
| Local Interstellar Cloud, G-cloud | 0.2 | 19.06 | gas |
| Orion Arm | 0.5 | 18.27 | gas |
| Galaxy disc, spiral arm | 1 | 17.60 | gas |
| Solar wind near Earth | 5 | 16.00 | gas |
| Barnard's Loop, Gum Nebula | 10 | 15.31 | gas |
| Pleiades dust | 30 | 14.21 | gas |
| Nebula envelope, molecular cloud | 100 | 13.00 | gas |
| Orion Nebula core | 1,000 | 10.70 | gas |
| Asteroid belt (dust, an estimate) | effective 10⁴ | 8.4 | dust |

Every zone row in the data carries a source URL. Two lessons drive play: in empty space the cosmic background sets the
limit, and galaxies are the danger. Crossing a spiral disc at the open-space speed puts 11 times the rated power on the
Lens, so you let go before every galaxy.

**Throttle and heat.**

- Throttle x ∈ [0, 1]. Holding raises it 0.42 per second; releasing lowers it 0.9 per second.
- Per leg: η = η_lo + x (η_hi − η_lo), with η_hi = the highest zone limit on the leg + 0.8 and η_lo = the lowest limit
  − 1.6, lowered so the span is at least 4.8. Intergalactic legs run η 16.0 to 20.8: the open notch sits at x = 0.834 and
  a galaxy disc at x = 0.333.
- Heat H ∈ [0, 1], in wall-clock seconds: r > 1 gives dH/dt = min(1.5, 0.55 ln r); r < 0.8 gives −0.22; otherwise H
  holds. ln r is linear in the overshoot, so the bar reacts in proportion to what you see. Holding x = 1 in open space
  cracks a pane in 1.15 seconds.
- Crack at H ≥ 1: panes − 1, H = 0.4, x forced to the notch − 0.1, input locked 0.8 seconds, caption "SHIELD CRACKED."
- Carried heat: each wrong lock adds 0.25 to the next flight's starting heat, capped at 0.5.

**Zones and screen time.** A leg is a list of zones, each with a true length `ly` (one zone per leg takes the rest) and a
design screen time `screen` at its notch. Zone progress p advances as
`dp/dt = (1 / screen) · clamp(e^(0.35 (η − η_lim)), 0.3, 1.6)`. Distance follows an exponential approach, so each power
of ten takes the same screen time (the Powers of Ten pacing):

```
ℓ(p) = ly · (1 − e^(−λp)) / (1 − e^(−λ)),   λ = clamp(ln(ly / nextFeatureLy), 0, 12)
```

The clocks integrate the true dℓ. The last zone of each leg is a 1.2 second drop-out: throttle forced to 0, the view
eases to rest, and the ship stops exactly at the target.

**What you see.** The picture uses a view rapidity tied to the throttle, φ_view = acosh(1 + 5 x^1.5), so β_view ≤ 0.986.
At x = 1 the forward hemisphere squeezes into a cone 9.6° from the centre. At the ship's real speed the whole sky would
sit inside a dot far smaller than a pixel. Aberration uses the stereographic form, stable at any rapidity and shared by
the shader, the overlay, picking and tests:

```
t  = |n × v| / (1 + n·v)              (for n·v < −0.9: w = (1 + n·v)/|n × v| and t' = e^(−φ)/w)
t' = e^(−φ) t,   cos θ' = (1 − t'²)/(1 + t'²),   sin θ' = 2t'/(1 + t'²)
n' = cos θ' v + sin θ' (n − (n·v) v)/|n × v|     (n parallel to v: n' = n)
D  = (e^φ + t² e^(−φ)) / (1 + t²)                 (Doppler factor; > 1 is blueshift)
colour      T' = D T, from a 256×1 blackbody LUT over 500 K to 200,000 K
brightness  stars: exp(lnY(DT) − lnY(T)) · D⁻²;  diffuse band: exp(lnY(DT) − lnY(T))
            lnY(T) = −(x + ln(1 − e^(−x))),  x = 25924 K / T
```

There is no rainbow "starbow". The background headlight is a sprite dead ahead, coloured from the LUT at
2.7255 K × e^η and bright in step with r, so the heat warning is also in the scene. HUD numbers always use the true η.

**Radio (chapter IV).** A signal met at distance r from Earth left Earth r years before the Earth date at that moment:
`heard year = today − route years ahead − r`. The clock line becomes `EARTH 1970 · RADIO 1920`. Radio is silent before
1895. Its pitch scales by D_view^0.25, so letting go lets you hear it at true pitch.

**Earth history.** At most 30 milestones in `core/milestones.js`, each with a date, a source URL and "about" where the
date is uncertain. A card shows once when the Earth date passes its date. At 1.2 billion years ago the opening fact is
"life is mostly single cells".

**HUD formatters** (pure, tested): `LIGHT − 2.5 NANOMETRES PER SECOND`; `1 SECOND HERE = 7.8 YEARS AT HOME`; nines `17`;
ship clock `4 YR 355 D`; Earth date `1.22 BILLION YEARS AGO`, `478 MILLION YEARS AGO`, `67,800 YEARS AGO`, then calendar
years from 12,000 years ago (`8018 BC`, `413 AD`, `1969`), and `TODAY` at arrival.

## The route

Positions are heliocentric galactic Cartesian light-years, each object with a source URL. Exactly one candidate has
every tag the clue needs; each decoy lacks at least one (test). Star facts give colour as a number with a small swatch
("COLOUR 3,800 K"), so colour clues do not depend on colour vision.

| # | Stop | Leg (ly) | Target | Decoys (trap first) |
|---|---|---|---|---|
| 1 | Start → Coma | 737,321,302 | Coma Cluster | Leo (trap), Shapley, Hercules |
| 2 | Coma → Virgo | 271,909,334 | Virgo Cluster | Centaurus, Hydra |
| 3 | Virgo → Eridanus → Fornax | 141,648,564 | Fornax Cluster | Eridanus, Norma |
| 4 | Fornax → Andromeda, fork | 61,874,788 | M31 | M81, Centaurus A |
| 4s | Spot, no travel | 0 | Triangulum | M32, M110 |
| 5 | Andromeda → Milky Way entry | 2,445,098 | Milky Way | Triangulum, NGC 6822 |
| 6 | Entry → Carina | 57,763 | Carina Nebula | Galactic Centre (trap), Orion Nebula |
| 7 | Carina → Orion's Belt | 8,430 | Orion's Belt | Pleiades, Rigel |
| 8 | Belt → Orion Nebula | 94 | M42 | Horsehead, Witch Head |
| 9 | Orion Nebula → Betelgeuse | 748 | Betelgeuse | Bellatrix, Aldebaran |
| 10 | Betelgeuse → Pleiades | 315 | Pleiades | Hyades, Beehive |
| 10s | Spot, no travel | 0 | Antares | Spica, Arcturus |
| 11 | Pleiades → Hyades → Aldebaran | 383 | Aldebaran | Capella, Arcturus |
| 12 | Aldebaran → Sirius | 61 | Sirius | Procyon, Vega |
| 13 | Sirius → Alpha Centauri | 9.5 | Alpha Centauri | the Sun (trap), Barnard's Star, Vega |
| 14 | Alpha Centauri → the Sun (arrive at 40 AU) | 4.3 | the Sun | Capella, Sirius |
| 15 | Kuiper belt → Earth | 40 AU | Earth | Neptune (trap), Venus, Mars |

Total route: 1,215,266,893 ly. The straight line is 999,996,220 ly, so the end card says the landmark route cost 21.5 %
extra. Where a stop has three decoys, a run draws two and always includes the trap.

**Truth checks built into the data.**

- Intergalactic legs (1 to 5) use authored zones. The waypoint galaxies on them are unnamed and disclosed as made up.
  Cluster gas zones must lie within the cluster's radius of the path.
- Legs inside the Milky Way (6 to 15) use authored zones for pacing, but `core/gas.js` checks them against a simple
  density model: halo 1e-3; disc 0.1 between arms and 1 in an arm, falling as exp(−|z|/500 ly); the four Reid et al. 2019
  log-spiral arms; named clouds as spheres; the Local Bubble; the Local Interstellar Cloud; the solar wind falling as
  r⁻². The median model density over each zone's span must be within a factor of 3 of the zone's n.
- Leg 6 enters the Milky Way 18,383 ly below the disc, runs through the halo, and meets the gas layer only in its last
  ~1,270 ly. It never crosses the Perseus or Orion arms, and stays at least 25,700 ly from the Galactic Centre. The arms
  it passes over are overlay labels with their real height above the path, from `gas.js`.
- Leg 7 is in the disc all the way. "Into our own arm: the Orion Arm" is said on this leg, where it is true.

**The ending** (about 40 seconds, each beat skippable): the approach, with Earth growing and the Moon passing with its
ring; "Today", where Earth's label becomes **Home** (the only orange label in the game) and the device date shows; the two
clocks; a pull-back through Earth, the Sun, the Orion Arm, the Milky Way, the Local Group and Laniakea, each with one
ring; then the score card. The lost ending folds the sky into the point ahead and names where the shield gave out and the
year on Earth.

## What is real and what is made up

The How it works page (title and pause) lists both.

- **Real:** every named object, its position and distance; the route length; both clocks; the speed shortfall; the gas
  density of each zone; the two heat sources and their formulas; aberration, Doppler colour and brightness; radio delay;
  the dates of Earth's history.
- **Made up:** the Lens rating (1 terawatt per square metre); the drive starts and stops at once and needs no fuel; on the
  long intergalactic legs the autopilot threads unnamed waypoint galaxies to keep its lock (a real straight path would
  almost never meet one); the time-lapse rate on screen; the picture shows the sky at up to 0.986c, far slower than the
  ship; the sky between named objects is generated; scan time is not counted; the asteroid-belt dust density is an
  estimate; the universe's expansion is ignored (under 4 % error); objects are drawn where they are now.

## Scoring, failure and retry

| Event | Points |
|---|---|
| Landmark on the 1st, 2nd or 3rd lock | +1,000 / +400 / +100 |
| Spot on the first try | +300 |
| Flight grade per leg: `round(500 × clamp(τ_par / τ, 0, 1.6))` | 0 to 800 |
| Clean crossing: a zone with n ≥ 0.1, or a waypoint, passed while heat did not rise | +50 |
| Crack | −400 |
| Sheet branch with no crack | +400 |
| Gentle arrival at Earth (x = 0 for the last 1.0 s before the drop-out) | +500 |
| Panes left at home | +1,000 each |
| Perfect journey (every first lock, both spots, no crack, no retry) | +5,000 |

Ranks: under 15,000 Drifter; under 25,000 Wayfinder; under 32,000 Navigator; 32,000 or more Lightkeeper. The bot test
tunes these. A careful player who stays under the notches never cracks, so a first-time player can finish. Pushing is
where the score is.

Losing the third pane gives the lost ending. Try chapter again restores the chapter-start snapshot with 3 panes and
`retries + 1`, and voids the perfect bonus. New journey starts chapter I with a new seed. Continue on the title resumes
the last chapter start.

## Controls

One verb per phase: look and tap in the scan, hold and let go in flight.

| Action | Desktop 1440×900 | Phone portrait 390×844 | Phone landscape 844×390 |
|---|---|---|---|
| Push toward light | Hold Space, W, ↑ or the left mouse button on the scene | Press and hold anywhere on the scene | Same |
| Ease off | Release | Lift the thumb | Same |
| Look around | Mouse drag, or ← → ↑ ↓ | One-finger drag | Same |
| Open a candidate | Click a ring or chip; 1, 2, 3; Tab cycles | Tap a ring (hit radius at least 22 px) or chip A B C in the bottom row | Tap a ring, or a chip in the right panel |
| Swing to an off-screen ring | Click its chevron | Tap its chevron | Same |
| Set course | Enter, or the button | SET COURSE in the bottom sheet (48 px tall) | SET COURSE in the right panel |
| Close the card | Esc (a second Esc pauses) | Tap outside the card, or × | Same |
| Hurry a caption | Enter or click | Tap | Tap |
| Fork | 1 or 2, or the buttons | Two stacked buttons | Two side-by-side buttons |
| Pause | Esc or P, or the pause button | Pause button, top right (44×44) | Same |
| Mute | M, or the sound button | Sound button (44×44) | Same |

- A tap is a press and release within 250 ms and 10 px (`core/pick.js`). Anything longer is a look-drag in the scan or
  thrust in flight.
- Thrust stops on `pointerup`, `pointercancel`, `lostpointercapture`, `blur`, page hidden and pause. One `Map` keyed by
  `pointerId`, `setPointerCapture` on press, `touch-action: none` on the canvas, and no context menu.
- Look-drag is clamped to ±60° yaw and ±35° pitch around the stop's framing, with light inertia (none under reduced
  motion).
- Settings: Thrust Hold or Tap to toggle (for motor access); Captions Normal or Slow (×1.5); Hints On or Off (On pulses
  the target ring after 25 seconds idle in a scan).
- Input is ignored while `window.GameSwitch?.isOpen` is true. Opening the switcher pauses the game.
- `navigator.vibrate(40)` on a crack where supported, off under reduced motion. No gamepad, gyro, pointer lock or wake
  lock.

## HUD, captions and layouts

**Look.** Black space, white points, 1 CSS px rings at 80 % white with a diagonal leader and a short flat run, 11 px
labels (12 px on phones) in sentence case, grey info boxes (`rgba(60,60,60,0.75)`), and bold uppercase captions with the
current word in `#f08a2c`. Before a reveal a ring's label is its letter and distance ("A · 718 Mly"). Rings are at least
14 px in radius. At most 6 labels show at once, placed greedily.

**Captions** are DOM text, not canvas: `system-ui` weight 800, white, a 1 px dark shadow, and the current word in a
`span.now` coloured `rgb(240, 138, 44)`. One chunk at a time. Word time is 0.26 s + 0.03 s per letter, +0.15 s after
punctuation, and 0.12 s between chunks; Slow is ×1.5. A visually hidden `aria-live="polite"` element gets each full
sentence once.

**Desktop 1440×900.** A 44 px top row (Arcade link, chapter and stop, Pause, Sound), a clock line under it, the info box
at top left, captions at 70 % height in 34 px, the card as a right panel 360 px wide, chips above the flight strip, and a
flight strip at bottom centre (max 760 px): shortfall, time rate, throttle bar with an orange notch tick and a hollow tick
for the next notch, heat behind the bar with `HOT` above 0.7, three pane squares, and a route bar.

**Phone portrait 390×844.** Safe-area padding on every edge. The 44 px top row, an 11 px clock line, the info box,
candidates framed in the upper 60 %, captions at 62 % in 26 px (above the card when one is open), the card as a bottom
sheet with a 48 px SET COURSE, 44 px chips in the bottom row, and the flight strip with an 8 px throttle bar.

**Phone landscape 844×390.** One 44 px top row holds Arcade, chapter, clocks, Pause and Sound. Captions are one line at
74 % in 22 px, left of the card. The card is a right panel 300 px wide with the chips at its top. The flight strip is
56 px high. Under 420 px of height the info box hides behind the chapter label and shows for 3 seconds when it changes.

**Rule for every layout:** the caption box never overlaps the top row, the flight strip, the card or the chips; every
button is at least 44 px and inside the safe area; no sideways scroll; captions take at most 2 lines. Every scan frames
its three candidates inside the free content box for the layout.

**Menus.** Title (eyebrow COTTAGE ARCADE, the name, the lede "Wake up a billion light-years from home. Fly back by the
landmarks.", the best line, Play, Continue if saved, How it works, Switch game). Pause (Resume, Sound, Captions, Thrust,
Hints, How it works, Restart chapter, Switch game, Back to the arcade). Chapter card. Lost card. Graphics error (Try
again, Back to the arcade, Switch game).

**Reduced motion:** cuts instead of camera sweeps, no shake, no twinkle, a still title backdrop, crossfades only, no
vibration. Gameplay is the same. The word-by-word caption colour still runs, because it is not motion.

## Saves

`core/save.js` takes a `storage` argument. Every read and write runs in try/catch, and junk reads as none.

| Key | Shape | Validation |
|---|---|---|
| `light-years-home.best.v1` | `{"score":31250,"reached":15,"home":true,"shipYears":13.59,"firstTry":15,"rank":"Navigator","date":"2026-10-13"}` | score safe integer 0..100,000; reached 0..15; home boolean; shipYears finite 0..1,000; rank one of four; date `YYYY-MM-DD` |
| `light-years-home.progress.v1` | `{"v":1,"seed":7,"chapter":2,"stop":6,"score":14200,"panes":2,"stats":{...},"branch":"sheet","shown":[...]}` | v 1; chapter 1..3; stop is the chapter's first stop; panes 1..3 |
| `light-years-home.settings.v1` | `{"thrust":"hold","captions":"normal","hints":true}` | unknown values fall back to defaults |
| `light-years-home.seen.v1` | `true` | boolean |
| `arcade.sound` | JSON boolean, shared | as `public/lab/kit/sfx.js` |

`saveBest` keeps the higher score, the higher `reached`, and the lower `shipYears` among runs that reached home. The
title best line reads `BEST 31,250 · HOME IN 13.59 YEARS`, `BEST 6,800 · REACHED VIRGO`, or `No journey home yet`.

## Audio

Synthesised with Web Audio, no files, as in Moonwell. `/arcade/quiet.js` is the first script. The AudioContext starts on
the Play tap and the game suspends it on pause. Mute is the shared `arcade.sound`.

| Layer | Design |
|---|---|
| Chapter drone | Sine pad and low-passed noise. I D minor, II F, III A, IV D major. |
| Flight rush | Brown noise, low-pass 300 + 3,000·x Hz, and a shimmer of two detuned sines at 880 · D_view^0.25 Hz. |
| Heat | Sparse high-passed crackle, denser with heat; above 0.8 a two-tone pulse at 4 Hz. |
| Crack | A glass tink (2.6 kHz, fast inharmonic decay) and a 60 Hz thump. |
| Find | Right: three rising pentatonic notes. Wrong: two falling notes a minor second apart. |
| On Earth card | A soft wooden tok. |
| Drop-out | A falling whoosh as the sky unfolds. |
| Radio | Band-passed static and Morse pips at 600 Hz whose rate rises with the heard year; one D major chord at Earth. No recordings or voices. |
| Ending | A four-bar sine-and-decay melody over the drone. |

## Files

```
public/light-years-home/
  index.html  style.css  main.js
  core/       pure: no window, document, navigator, localStorage, three, timers, Date.now(); imports in plain node
    rng.js  physics.js  gas.js  objects.js  route.js  milestones.js  timeline.js  captions.js  geo.js  project.js
    labels.js  pick.js  save.js  bot.js  engine.js
    gen/web.js  gen/galaxy.js  gen/stars.js      generators take positions, counts and seed as parameters
  render/     view.js  points.js  sky.js  galaxy.js  nebula.js  planets.js  lens.js
  ui/         overlay.js  hud.js  input.js  audio.js  perf.js
  art/share.jpg
public/arcade/light-years-home.webp   cabinet art, 480×270, under 60 KB, from ?keyart=1
qa/light-years-home/
  physics, gas, route, timeline, engine, captions, save, geo, gen and pure .test.mjs; bot.mjs
  smoke, play, layout, visual and perf .e2e.mjs; arcade.mjs; keyart.mjs
```

- `core/engine.js` is a deterministic state machine. Its state is plain JSON, safe to `structuredClone`. Phases: title,
  intro, clue, scan, fork, flight, reveal, chapter, ending, lost.
- Earth history milestones live in `core/milestones.js`, not `route.js`; `timeline.js` imports them.
- `main.js` runs a fixed 1/60 s loop (at most 5 steps, dt at most 0.1 s), checks WebGL2, picks a quality tier, wires
  input and lifecycle, and exposes the QA hook `window.__lyh`. Gameplay never reads the hook.
- URL flags: `?seed=N`, `?qa=1` (skip the intro, no coaching, hints off), `?keyart=1`, `?perf`.

**Rendering.** Each scale (cosmic web, Local Group, galaxy, stars, solar system) is its own `THREE.Scene` with the camera
at the origin and a float64 floating origin. Layers draw back to front with `clearDepth()` between them and crossfade on
log10 of the view scale. No logarithmic or reversed depth buffer. Every aberrated object has `frustumCulled = false`. Big
meshes aberrate their centre and scale by 1/D. Faint points are culled in the vertex shader. Everything is procedural:
no photos and no network textures.

## Sources

AGENTS.md asks for the source of every rendering technique. These are the ones adapted.

| Technique | Source adapted | Notes |
|---|---|---|
| Aberration, Doppler colour, beaming | U. Kraus, "Brightness and color of rapidly moving objects", Am. J. Phys. 68(1):56-60 (2000); C. M. Savage, A. Searle, L. McCalman, "Real Time Relativity", Am. J. Phys. 75(9):791-798 (2007); R. Penrose, "The apparent shape of a relativistically moving sphere", Proc. Camb. Phil. Soc. 55:137-139 (1959), for the stereographic scaling; J. M. McKinley and P. Doherty, "In search of the starbow", Am. J. Phys. 47:309-316 (1979); Wikipedia "Relativistic aberration" and "Relativistic beaming" | MIT Game Lab OpenRelativity (MIT licence) read for shader structure, not copied. Point stars get D⁻² after aberration; the diffuse band gets no solid-angle term. |
| Per-pixel aberrated sky | Savage, Searle and McCalman 2007 (inverse Lorentz lookup into a cube map); D. Weiskopf et al., "Fast Visualization of Special Relativistic Effects on Geometry and Illumination", VisSym 2000 | The band stores temperature in alpha so it recolours correctly. |
| Blackbody colour LUT | C. Wyman, P.-P. Sloan, P. Shirley, "Simple Analytic Approximations to the CIE XYZ Color Matching Functions", JCGT 2(2) (2013), with Planck's law; M. Charity, "What color is a blackbody?" (vendian.org) as the check table | Brightness from Planck at 555 nm (`lnY`), checked against a full CIE integration during design. Tanner Helland's fit considered; it covers only 1,000 to 40,000 K. |
| Star glow | G. Spencer, P. Shirley, K. Zimmerman, D. Greenberg, "Physically-based glare effects for digital images", SIGGRAPH 1995; S. Schneegans, A. Kreskowski, A. Gerndt, "Smaller than Pixels", Eurographics 2025 short paper; Gaia Sky star rendering documentation | Energy-conserving sprite: 92 % narrow core, 8 % halo, per-sprite `1 − exp(−e·colour)`. |
| Cosmic web | R. van de Weygaert, "Voronoi Tessellations and the Cosmic Web", arXiv:0707.2877 (Voronoi kinematic model); J. Hidding et al., "Adhesion and the geometry of the cosmic web", arXiv:1211.5385 (why Voronoi is a fair stand-in); the look from R. B. Tully et al., "The Laniakea supercluster of galaxies", Nature 513:71 (2014) | Zel'dovich plane waves were tried during design and rejected. |
| Spiral and barred galaxies | Logarithmic-spiral particle generator (the Three.js Journey "Galaxy Generator" pattern) with an explicit bar; arm geometry from M. J. Reid et al., ApJ 885:131 (2019); bar from C. Wegg, O. Gerhard, M. Portail, MNRAS 450:4050 (2015) | I. Berg's density-wave renderer considered and reimplemented from the article only (its code has no licence). Dust as darkening points (`dst·(1 − src)`, slightly blue-biased); background from Hildebrand, Magnor and Fröhlich, WSCG 2006. |
| Nebulae | wwwtyro, space-3d (Unlicense), baked noise layers; I. Quilez, "Domain warping"; P. Decaudin and F. Neyret, "Volumetric Billboards" (2009), for the layering idea | Ray-marched nebulae (Duke's Shadertoy shaders, T. Sagristà's Gaia Sky write-up) considered and rejected for phones; their CC BY-NC-SA code is not used. |
| Earth, atmosphere, Moon, Sun, Jupiter | S. O'Neil, "Accurate Atmospheric Scattering", GPU Gems 2 ch. 16 (2005); E. Bruneton and F. Neyret, "Precomputed Atmospheric Scattering" (2008), Rayleigh coefficients; Wikipedia "Chapman function" (grazing column); Three.js Journey "Earth shaders" (structure only); the Lommel-Seeliger law for the Moon; linear limb darkening for the Sun; Quilez domain warping and domain rotation for Jupiter's bands and storm | Analytic back-faced atmosphere shell, τ0 = (3.3, 7.6, 18.7), scale height exaggerated to 2 % of R. |
| Scale changes | C. and R. Eames, *Powers of Ten* (1977), for the pacing; C. Thorne, "Using a Floating Origin to Improve Fidelity and Performance of Large, Distributed Virtual Worlds", Cyberworlds 2005 | Logarithmic depth (Cesium blog 2018; B. Kemen 2009) and reversed depth (N. Reed, "Depth Precision Visualized", 2015) considered and rejected for phones. |
| Ring and label overlay | J. Christensen, J. Marks, S. Shieber, "An Empirical Study of Algorithms for Point-Feature Label Placement", ACM TOG 14(3) (1995), greedy placement; three.js projection | three.js `CSS2DRenderer` considered and rejected: one DOM node per label costs more on phones. |
| Cosmic background headlight | Physics only: the boosted energy flux of isotropic radiation, (4/3)γ²β u c for γ ≫ 1, derived in the Physics section; Wikipedia "Cosmic microwave background" for T = 2.7255 K | Drawn with the star sprite. No outside rendering source fits. |
| Karaoke captions, crack lines, throttle bar, telescope view | None fit. The caption look follows the uploaded video (our own text). The telescope view is a plain three.js render target with a narrow camera. | |

## Validation

Spec structure: `openspec validate add-light-years-home --strict`. Code is tested separately against the scenarios.

**Node tests** (`for f in qa/light-years-home/*.test.mjs; do node $f || echo FAIL $f; done`):

| File | Checks |
|---|---|
| `physics.test.mjs` | γ, β and celerity identities to 1e-12; 1 − β at η 20; `aberrate` against the vector form to 1e-12 for φ ≤ 3, unit length and finite to φ = 25; D ahead × D behind = 1; LUT within 6/255 of Charity's table at 1,000 to 40,000 K; q_cmb limits; zone limits for n 3e-8, 1 and 1000; formatters; `zoneDistance` |
| `gas.test.mjs` | arm membership of the Sun and Carina; leg 6 stays ≥ 25,000 ly from the Galactic Centre and is in the gas layer only in its last 2,000 ly; `armsPassed` for leg 6 |
| `route.test.mjs` | stop and spot order; total length within 0.1 %; zone lengths sum to each leg; screen time 7 to 15 s per leg; equal fork branches; Milky Way zones within ×3 of the gas model; cluster gas within the cluster radius; one candidate has every needed tag; every object and milestone has a source URL; no 6-word run from the video narration |
| `timeline.test.mjs` | with today pinned to 2026-10-13: the start date text, the asteroid card on leg 3, heard years, arrival date |
| `engine.test.mjs` | scan, flight, heat, crack, clock, chapter, spot, fork, lost and retry scenarios; bot outcomes; pause freeze; determinism; actions outside their phase and bad input are ignored |
| `captions.test.mjs` | chunk limits, no lone last word, numbers never split, word order, rising start times, `wordAt`, Slow ×1.5 |
| `save.test.mjs` | junk values and a throwing storage read as none; best merge rules; progress round trip; settings fallback |
| `geo.test.mjs` | candidates inside the free content box for every stop and spot at all three aspects; `legPath` ends at the target |
| `gen.test.mjs` | same seed, same output; cosmic web stage fractions; points near Coma, Virgo and Fornax; tier counts |
| `pure.test.mjs` | every `core/**/*.js` imports in node and uses no browser or three.js globals |

`node qa/light-years-home/bot.mjs careful 5` prints score, rank, cracks, ship time and first tries per seed.

**Browser checks** need the server at http://127.0.0.1:8765/ and run Chromium with SwiftShader. They collect page
errors, console errors and same-origin 4xx/5xx responses and assert none.

- `smoke.e2e.mjs`: title, junk saves, graphics failure and context loss, script order, caption colours, HUD strings,
  pause, lifecycle, switcher, mute, reduced motion.
- `play.e2e.mjs`: Continue, the opening, caption hurry, later runs, scan controls, thrust controls, coaching, chapter
  cards, lost and retry, the ending with the clock fixed to 2026-10-13, and the best line after a home run.
- `layout.e2e.mjs`: caption limits, touch targets and the layout rules at 1440×900, 390×844 and 844×390, and turning
  the phone mid-scan.
- `arcade.mjs`: the cabinet best line and launch. `qa/arcade/groups.e2e.mjs` checks the Action group.

**Visual check** (`visual.e2e.mjs`). It drives the game with `jump` and `step`, saves screenshots at the three sizes to
`$SHOTS` (default `/tmp/light-years-home-qa`), builds `contact.png` with ImageMagick `montage`, and asserts pixel
statistics at the low tier in SwiftShader. These check colour and layout, not beauty.

| Shot | Assertion |
|---|---|
| `title` | lit fraction (lum > 0.25) between 0.2 % and 5 %; under 0.5 % of pixels above lum 0.9 |
| `scan-coma` | 3 on-screen rings with hit radius ≥ 22 px; a "Laniakea Supercluster" label; ring pixels non-black on ≥ 70 % of 32 samples |
| `card-coma` | the telescope view has ≥ 50 lit pixels |
| `flight-x0`, `flight-x1` | share of light within 30° of ahead ≥ 0.6 at x = 1 and ≤ 0.25 at x = 0; blue-to-red ratio in the centre at x = 1 ≥ 1.2 × its value at x = 0; both back within 10 % of x = 0 after the drop-out |
| flight at x = 1 | every ring within 2 px of its projected object; the hollow next-notch tick shows; the drop-out ends at the target |
| `crack` | crack strokes in the overlay; the caption reads "SHIELD CRACKED." |
| `reveal-milky-way` | ≥ 25 % of pixels inside the ring above lum 0.08; the centre 10 % of the ring ≥ 3 × brighter than its outer 10 % |
| `scan-orion-nebula` | Orion Nebula R > 1.5 G and B > G; Horsehead lum < 0.5 × the Orion Nebula; Witch Head B > R |
| `scan-betelgeuse` | Betelgeuse R/B ≥ 1.3; Bellatrix B/R ≥ 1.0 |
| `reveal-sun`, `approach-earth` | Sun lum ≥ 0.8; Jupiter R > B |
| `ending-home` | Earth B > R; Moon saturation < 0.15; a "Home" label coloured `#f08a2c` |
| `chapter-card`, `lost` | card text and buttons |

A person reviews `contact.png` before merge, and the PR links it.

**Performance check.** Budgets per tier:

| Budget | High (desktop, hardware GPU) | Mid (default on touch) | Low (software, or after step-down) |
|---|---|---|---|
| Pixel ratio | min(dpr, 2) | min(dpr, 1.5) | 1 |
| Points per frame, all layers | ≤ 120k | ≤ 50k | ≤ 25k |
| Draw calls | ≤ 45 | ≤ 35 | ≤ 25 |
| Star sprite cap | 32 CSS px | 24 | 16 |
| GPU textures (own accounting) | ≤ 96 MB | ≤ 48 MB | ≤ 24 MB |
| CPU per frame (engine, camera, overlay, HUD) | p95 ≤ 4 ms | same | same |
| Bake work | ≤ 120 ms per slice, behind scans and reveals | same | same |
| Game files download | ≤ 200 KB raw; three.js shared from `/vr/lib/` | same | same |

1. `ui/perf.js` records frame deltas, CPU time, draw calls and points. `?perf` shows median and p95 frame time, CPU p95,
   draw calls, tier, pixel ratio and GPU name, with a Copy button for JSON.
2. `perf.e2e.mjs` runs in SwiftShader, so it checks structure, not speed. For high at 1440×900 and mid at 390×844, at six
   checkpoints (title, leg 1 at x = 1, the Milky Way fly-in, the Orion Nebula scan, leg 15, the ending), it asserts
   calls, points, sprite cap and texture bytes within the tier, and CPU p95 ≤ 4 ms over 300 stepped frames.
   `simulateSlow(40, 3.5)` must lower the pixel ratio by 0.5; repeated calls step in order: ratio to 1, then point
   counts, then nebula layers. `simulateSlow(15, 5)` changes nothing. A software renderer starts at low and sets
   `canvas.dataset.backend = 'software'`.
3. Manual, on real hardware, reported in the PR with the copied JSON. Desktop at 1440×900 on a hardware GPU: median
   ≤ 16.7 ms and p95 ≤ 20 ms over 600 frames of the leg 1 flight and the Milky Way fly-in. A Pixel 6 or iPhone 12 class
   phone in portrait and landscape at the mid tier: p95 ≤ 20 ms over the chapter III flights and the Milky Way fly-in;
   low tier p95 ≤ 33 ms.

**Checks that cannot run in this container,** to state plainly in the PR: real GPU frame times on a desktop or phone
(step 3 above), real phones, touch feel and thumb reach, iOS Safari audio unlock, vibration, and listening to the audio.

**Arcade reruns:** `analytics.test.cjs`, `launch-counts.test.cjs`, `ascii-front/arcade.test.mjs`, `lab/links.mjs`,
`groups.e2e.mjs`, `machines.mjs` (only the known switcher failures allowed) and `quiet.mjs`, both the full scan and
`--only=light-years-home`.

## Arcade

- `public/arcade/switch.js`: an entry after River Rush with id `light-years-home`, name Light Years Home, sub "A billion
  light-years home at light speed", art `/arcade/light-years-home.webp` and colour `#f08a2c`.
- `public/index.html`: a cabinet after Last Light with class `extra`, the marquee "LIGHT YEARS HOME / A QUEST AT LIGHT
  SPEED", the default high-score line `CROSS A BILLION LIGHT-YEARS`, and a best line from a valid save
  (`BEST 31,250 · HOME IN 13.59 YRS` or `BEST 6,800 · STOP 3 OF 15`). `light-years-home` is appended to the Action group.
- `arcade-groups` pins the Lab group (17 machines) and the ASCII Scenes group, not the Action group, so this change adds
  no delta to it.

## Cut order

If time runs short, cut in this order. Each cut keeps the game whole: telescope views in cards (use an icon per object
kind); third decoys and seeded draws; the Milky Way particle fly-in (keep the impostor); the fork (keep the Sheet); radio
audio (keep the clock line and the final chord); the address pull-back; milestones beyond 15.

Never cut: the landmark order and the Earth ending with today's date and both clocks; hold-and-release flight with heat
and cracks; the karaoke captions; rings, leaders and labels; aberration and Doppler on every point; portrait and
landscape phone layouts; pause and lifecycle; saves and the cabinet line; the arcade registration; the tests.

Already cut from the cinematic design: a true-sky setting, a narration voice, gamepad, wake lock, film and photo sights,
the album, the radio waltz and babble, Saturn's rings, desktop bloom and a daily route.
