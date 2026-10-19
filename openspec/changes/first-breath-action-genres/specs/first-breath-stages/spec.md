## ADDED Requirements

### Requirement: Each stage is its own action genre
Each stage SHALL play as the genre the user chose: 1 a kart race with battle royale knockouts, 2 a radial brick breaker with bullet-hell patterns, 3 a roguelike, 4 an action-adventure, 5 a twin-stick style shooter, 6 a rhythm game, 7 a survivor-style auto-shooter, 8 an endless runner. Stage 6 SHALL be the only stage with timed targets. The ending SHALL stay calm and unchanged.

#### Scenario: Timed targets only in stage 6
- **WHEN** every stage's targets are listed over 20 seeds
- **THEN** only stage 6 has timed targets, and every other stage's `targets()` is empty
- **CHECK** `qa/first-breath/track.test.mjs`

#### Scenario: Auto-fire in the shooting stages
- **GIVEN** stages 3, 4, 5 and 7 in node with the stick held still and no press
- **WHEN** a foe comes within the stage's fire range
- **THEN** your shots fly at the nearest foe by themselves, and in stages 1, 2 and 8 nothing is fired by itself
- **CHECK** `qa/first-breath/stage-<id>.test.mjs`

### Requirement: Telegraphs before every attack
In every action stage, every foe SHALL show a spawn tell for 0.6 s before it can move, shoot or be hit, and every bullet pattern SHALL show its telegraph at least 0.35 s before its first bullet.

#### Scenario: Telegraphs come first
- **WHEN** stages 2, 3, 4, 5 and 7 run over 20 seeds with the reference bot and with no input
- **THEN** every foe's first move, shot or hit comes at least 0.6 s after its spawn, and every pattern's first bullet at least 0.35 s after its telegraph
- **CHECK** `qa/first-breath/stage-<id>.test.mjs`

### Requirement: Fair fights
Where you move, your hitbox SHALL be about 40% of your drawn body. No foe SHALL spawn within 24 u of you, nor any foe bullet be made within 14 u of you; in stage 2 these count from the egg's centre. Foe bullets on screen SHALL stay under the stage's cap. A hit SHALL clear foe bullets within 9 u of you (in stage 2, of the shell) and give 1.0 s of i-frames. In portrait no foe SHALL spawn in the bottom 40% of the screen, except stage 2's formations, which sit all round the egg.

#### Scenario: No spawn on you
- **WHEN** stages 2, 3, 4, 5 and 7 run over 20 seeds with the reference bot and with no input
- **THEN** no foe spawns within 24 u of you, no foe bullet is made within 14 u of you, and the stage's bullet cap is never passed
- **CHECK** `qa/first-breath/stage-<id>.test.mjs`

#### Scenario: One mistake costs one pip
- **WHEN** you are hit inside a ring of foe bullets
- **THEN** you lose one pip, the foe bullets within 9 u are cleared, and no further hit lands for 1.0 s
- **CHECK** `qa/first-breath/stage-grow.test.mjs`

### Requirement: Stage 1, The Race as a kart race
Stage 1 SHALL keep the race as built: the pack of 20, the analog steering, the waves, the gate, the fork and cool loop, the tube's current and warm lane, the glow walls, the place slot and the catch-up. Its tube SHALL now bend six times, a hairpin among them, with the warm lane on the inside of each bend, 4,600 u to the meeting place. The camera SHALL turn with the track. Stage 1 SHALL have no auto-fire.

#### Scenario: The steering is the same
- **WHEN** a sperm in node steers on a straight with the same stick as in the v1 race model, with no drift, item, slipstream or wave
- **THEN** its speed, heading and progress match `qa/first-breath/race-sim.mjs` step for step
- **CHECK** `qa/first-breath/stage-swim.test.mjs`

#### Scenario: Portrait drag
- **GIVEN** stage 1 at 390 × 844 with touch
- **WHEN** the player drags up from a touch-down near the bottom of the screen
- **THEN** the sperm cell swims forward, which is up, and stays above 60% of the screen height
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Landscape drag
- **GIVEN** stage 1 at 844 × 390 with touch
- **WHEN** the player drags right with either thumb
- **THEN** the sperm cell swims forward, which is right, and the place slot changes as it passes rivals
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Desktop keys
- **GIVEN** stage 1 at 1440 × 900
- **WHEN** the player steers with the arrows or WASD
- **THEN** the cell steers in 8 directions with smoothing, and no mouse is needed to finish the race
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Desktop mouse drag
- **GIVEN** stage 1 at 1440 × 900
- **WHEN** the player holds the left mouse button and drags to the right of the press point
- **THEN** the drag acts as the floating stick and the cell swims forward, which is right
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: The next bend in view
- **GIVEN** stage 1 at 390 × 844, 844 × 390 and 1440 × 900 with the reference bot
- **WHEN** the cell nears each bend, each gate and the fork
- **THEN** it is on screen, under no HUD, prompt or caption box, at least 1.5 s before the cell reaches it
- **CHECK** `qa/first-breath/layout.e2e.mjs`

#### Scenario: One-button race
- **GIVEN** one-button mode
- **WHEN** the player holds the button
- **THEN** the cell steers the racing line, drifts, uses items and reaches the meeting place in the top 3 in at least 18 of 20 seeds
- **CHECK** `qa/first-breath/input.e2e.mjs`, `qa/first-breath/sim.test.mjs`

### Requirement: Drift boosts
The turn rate SHALL stay as before, with no grip limit. A press while turning at 30 u/s or more SHALL start a drift that charges while the stick stays turned, while the sperm's path slides: blue at 0.6 s, orange at 1.2 s and pink at 2.0 s. Its release SHALL give a boost of 25, 30 or 35 u/s for 0.5, 0.9 or 1.3 s. The same rules SHALL hold for every sperm.

#### Scenario: A drift on a phone
- **GIVEN** the hairpin at 390 × 844
- **WHEN** the player drags to turn, taps, holds the turn for 1.3 s, then straightens the drag
- **THEN** the drift reaches orange, and the cell boosts by 30 u/s for 0.9 s
- **CHECK** `qa/first-breath/stage-swim.test.mjs`, `qa/first-breath/input.e2e.mjs`

#### Scenario: A drift with keys
- **GIVEN** a bend at 1440 × 900
- **WHEN** the player holds the right arrow and Space for 2.1 s, then lets go of Space
- **THEN** the drift reaches pink and the cell boosts by 35 u/s for 1.3 s
- **CHECK** `qa/first-breath/input.e2e.mjs`

### Requirement: Items and the slipstream
Item boxes in three rows SHALL give one item at a time from a table weighted by place (Spark, Shield, Rush, Warm glow, Goo), used by a press while swimming straight. A sperm within 30 u behind another and within 15° of its heading SHALL draft, +10 u/s after 0.5 s, and slingshot on pulling out, +20 u/s for 0.6 s. The same rules SHALL hold for every sperm.

#### Scenario: Items by place
- **WHEN** item boxes are rolled 2,000 times in node at places 2, 7 and 15
- **THEN** each place's shares match its row of the design's table within 3 points, and only places 11 to 20 ever roll a Warm glow
- **CHECK** `qa/first-breath/stage-swim.test.mjs`

#### Scenario: A warm glow
- **WHEN** you use a Warm glow
- **THEN** you are ready at once, as on a glow wall: "Now you are ready." shows, your own swim is 1.6 times as fast to the finish, and the carried `sperm.glow` is 1
- **CHECK** `qa/first-breath/stage-swim.test.mjs`

### Requirement: Knockout gates and the cool tide
Three knockout gates SHALL close behind the pack: Gate 1 at 1,300 u after 14 sperm or at 30 s, Gate 2 at 2,800 u after 8 or at 60 s, Gate 3 at 4,000 u after 5 or at 85 s. Every sperm behind a closed gate SHALL rest, and so SHALL a sperm the cool tide reaches (from 12 s, 25 to 50 u/s) and every sperm still racing when the third reaches the meeting place. Nothing SHALL be killed.

#### Scenario: A gate closes
- **WHEN** the 8th sperm passes Gate 2
- **THEN** the gate closes, the tide floods up to it, and every sperm behind it rests and ranks behind every racer
- **CHECK** `qa/first-breath/stage-swim.test.mjs`

#### Scenario: The gate in the HUD
- **GIVEN** stage 1 at 390 × 844, 844 × 390 and 1440 × 900 with `?inset=47,0,34,0`
- **WHEN** a gate is 3 s from closing
- **THEN** a tag such as "Gate 2: first 8" shows under the place slot, inside the safe area, overlapping no HUD, prompt or caption box
- **CHECK** `qa/first-breath/layout.e2e.mjs`

### Requirement: The glow and the arc
In stage 2's guard a glow SHALL bounce between the arc and the rim at 54 u. Off the arc it SHALL leave along the radius turned by k × 55°, k being the hit's offset over the arc's half-width. Off the rim it SHALL head within 14° of the egg's centre, so it always comes back to the arc. It SHALL pass through the gold sperm and through enzyme sparks. When the last glow crosses 16 u where the arc is not, the shell SHALL lose one pip and a new glow SHALL serve 1.0 s later.

#### Scenario: The return angle
- **WHEN** the glow meets the arc at its centre, at its left end and at its right end
- **THEN** it leaves straight out, 55° to the left of straight out, and 55° to the right
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

#### Scenario: It comes back to the arc
- **WHEN** the guard runs over 20 seeds with the reference bot and with random arc turns
- **THEN** after every rim bounce the glow's straight path passes within 13 u of the egg's centre
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

#### Scenario: The last glow lost
- **WHEN** the only glow crosses 16 u from the centre where the arc is not
- **THEN** it fades into the shell, the shell loses one pip, the combo ends, and a new glow serves from the arc's centre 1.0 s later
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

### Requirement: Formations of rivals are the bricks
Rival sperm SHALL come in formations, W1 to W4 and the swarm, each at its time or sooner when 3 or fewer bricks are left. Plain ones SHALL take 1 hit, tough 2 and capped 3, with hits left shown as 1 to 3 dots. A brick with no hits left SHALL bounce off and drift away. A re-forming ring SHALL close its gaps within 2 s. From W2, divers SHALL leave their formation and swim in under the v1 sticking rules. Nothing SHALL be killed.

#### Scenario: Hits by kind
- **WHEN** the glow hits a plain, a tough and a capped rival
- **THEN** the plain one drifts off after 1 hit, the tough one after 2 and the capped one after 3, each bouncing away and gone by 80 u
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

#### Scenario: The waves come in time
- **WHEN** the guard runs over 20 seeds with the reference bot and with the mid bot
- **THEN** each wave comes at its time or sooner, never within 4 s of the last, and no more than 36 rivals are in formation at once
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

### Requirement: Enzyme spark patterns
From W2 the formations SHALL fire enzyme sparks at the shell in patterns that build over the waves (aimed streams, fans, curtains, rings and a turning stream), each after its telegraph, at 24 u/s at most, with at most 50 on screen. A spark that meets the arc SHALL turn back outward as yours and take one hit off the first brick it meets. A spark that reaches the shell where the arc is not SHALL cost one pip.

#### Scenario: A blocked spark
- **WHEN** the arc is over a spark's path as it reaches 16 u from the egg's centre
- **THEN** the spark turns back outward at 1.3 times its speed, and the first rival it meets loses one hit
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

#### Scenario: A spark on the shell
- **WHEN** a spark reaches the shell where the arc is not
- **THEN** the shell loses one pip, a short crack shows, the egg blinks by brightness only with no red flash, the sparks within 20 u of the centre are cleared, and no pip goes for 1.0 s
- **CHECK** `qa/first-breath/stage-egg.test.mjs`, `qa/first-breath/visual.e2e.mjs`

#### Scenario: Sparks start at W2
- **WHEN** the guard runs with any input
- **THEN** no enzyme spark is made before W2, and each wave and swarm phase fires the patterns the design lists for it
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

### Requirement: Shell pips
The shell SHALL have 6 pips (9 with Assist), plus shield sparks. A pip SHALL go for an enzyme spark on the shell, for the last glow lost, and for a rival held after burrowing. At 0 pips the guard SHALL end with "Your shell needs a rest." and the Almost card.

#### Scenario: Three ways to lose a pip
- **WHEN** a spark reaches the shell, the last glow is lost, and a rival finishes burrowing, each more than 1.0 s apart
- **THEN** the shell loses three pips, a crack shows each time, and the combo ends each time
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

### Requirement: Power-ups fall to the arc
A rival that drifts off SHALL sometimes drop a power-up, by kind as the design lists, and one SHALL be sure after 10 drift-offs with none. It SHALL fall inward at 12 u/s, and only the arc SHALL catch it, as it reaches 16 u within the arc's span. Multi SHALL split every glow into 3, Wide SHALL widen the arc to 55° for 10 s, Pierce SHALL let glows pass through rivals for 6 s, Slow SHALL slow all but the arc to 0.6 for 5 s, and Mend SHALL add a pip.

#### Scenario: Catch Multi
- **WHEN** a Multi power-up falls and the arc is under it as it reaches 16 u
- **THEN** every glow in play splits into 3, 20° apart, up to 6 in all
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

#### Scenario: A missed power-up
- **WHEN** a power-up reaches 16 u outside the arc's span
- **THEN** it fades at the shell, and nothing is lost
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

### Requirement: The seal charge clears the sparks
The seal charge SHALL fill by 1 for each rival that drifts off and 0.5 for each spark blocked, be full at 12, and keep up to 2 charges. A press (a second finger, a quick second tap, Space, Enter or Z) SHALL release one: a wave from 11 to 70 u in 0.5 s that turns every enzyme spark on screen into a gold sparkle, takes one hit off each rival inside and never touches the gold sperm.

#### Scenario: A second finger on a phone
- **GIVEN** the guard at 390 × 844 with a full charge and one thumb dragging the arc
- **WHEN** a second finger taps the screen
- **THEN** every enzyme spark on screen becomes a gold sparkle, and the arc does not move
- **CHECK** `qa/first-breath/input.e2e.mjs`, `qa/first-breath/stage-egg.test.mjs`

#### Scenario: Space on desktop
- **GIVEN** the guard at 1440 × 900 with two full charges, turning the arc with the arrow keys
- **WHEN** the player presses Space
- **THEN** one charge goes, the sparks on screen become gold sparkles, and one charge is kept
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Nothing to release
- **WHEN** the player presses with the charge not yet full
- **THEN** nothing happens, and nothing is lost
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

### Requirement: The swarm
At 28 s into the guard at the latest, a swarm of 20 rivals SHALL come with a boss bar and three phases, changing at a third and at two thirds of its hits, each change after a 0.8 s pause with a tell. It SHALL drift off with "The swarm drifts off." when 4 or fewer are left, or 14 s after it came, and every other rival in formation SHALL drift off with it.

#### Scenario: The phases
- **WHEN** the swarm loses a third and then two thirds of its hits
- **THEN** it splits into two rings turning opposite ways, then draws in to one ring at 32 u and fires the turning stream, each change after a 0.8 s pause with no new sparks
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

#### Scenario: It always leaves
- **WHEN** the swarm takes no hits
- **THEN** it drifts off 14 s after it came, with every other rival in formation, and no new spark is fired after that
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

### Requirement: The rush
Your gold sperm SHALL come in with 4 rivals, each at least 60° from it and from each other, all reaching the shell within 1.5 s of it, with "Only one may enter. Let yours in." Bouncing or popping the 4 while never nudging the gold sperm SHALL be a clean pick. The gold sperm SHALL still enter whatever the input.

#### Scenario: The rush comes
- **WHEN** stage 2 runs over 20 seeds with the reference bot and with the mid bot
- **THEN** four rivals reach the shell within 1.5 s of the gold sperm, at least 60° apart, and exactly one sperm enters, the gold one
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

#### Scenario: A clean pick
- **WHEN** the player bounces or pops all four and never nudges the gold sperm
- **THEN** the pick is clean, and 500 Flourish points are earned
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

### Requirement: Stage 3, first cells room by room
Stage 3 SHALL be named "The Embryo: first cells" and SHALL be a run of four day rooms (Days 1 to 4), a boss room (Day 5) and the hatch (Day 6). Each day room's germs SHALL be shot by your cells by themselves, and its exit SHALL open when it is clear or at its 10 s timer. At each room's end you SHALL split, from 2 cells to 4, 8 and 16, each split adding a shot, while the ball keeps its size. You SHALL hatch by yourself after the boss room.

#### Scenario: Splits on schedule
- **WHEN** the player touches nothing during the four days
- **THEN** each room's timer opens its exit, each split still plays, and the ball's drawn size never changes
- **CHECK** `qa/first-breath/stage-split.test.mjs`

#### Scenario: Shots follow the cells
- **WHEN** the cell count is 2, 4, 8 and 16
- **THEN** each volley has 1, 2, 3 and 4 shots before gifts
- **CHECK** `qa/first-breath/stage-split.test.mjs`

#### Scenario: The hatch
- **WHEN** the boss room ends, in portrait, landscape or desktop
- **THEN** your shell cracks into paper pieces, "You hatch." shows, and the clock reads Day 6 after fertilization
- **CHECK** `qa/first-breath/stage-split.test.mjs`

### Requirement: Gifts at each split
In stage 3, after each day room, three gift bubbles SHALL appear round you: distinct, seeded, and never one already at its top level. Swimming into a bubble SHALL take that gift, and after 3.0 s the middle one SHALL be taken by itself. Gifts SHALL stack up to their levels and SHALL not carry into the next stage.

#### Scenario: Pick by swimming
- **GIVEN** a gift pick in stage 3 at 390 × 844
- **WHEN** the player drags toward the left bubble until you touch it
- **THEN** that gift is taken, its effect applies from the next room, and its tag shows inside the safe area
- **CHECK** `qa/first-breath/stage-split.test.mjs`, `qa/first-breath/layout.e2e.mjs`

#### Scenario: A pick left alone
- **WHEN** the player touches nothing at a pick
- **THEN** the middle gift is taken after 3.0 s with "It picks itself."
- **CHECK** `qa/first-breath/stage-split.test.mjs`

### Requirement: The Knot
Stage 3's Day 5 room SHALL hold the Knot, a big clump at the tube's end, with a boss bar and three phases by its hp. At 18 s into the room it SHALL loosen and drift off by itself. While the room plays, the hollow SHALL fill inside your ball.

#### Scenario: The phases
- **WHEN** the reference bot plays the Knot
- **THEN** its patterns change at 30 and 12 hp, each change with a charge tell, and it pops or drifts off by 18 s
- **CHECK** `qa/first-breath/stage-split.test.mjs`

### Requirement: Tunnels, the grapple and the compass
In stage 4's lining map, soft tissue SHALL slow you and leave a tunnel, firm tissue SHALL block you until 5 pools are linked, and the dash SHALL be a grapple that snaps to the nearest knot or pool rim within a 30° cone and its reach (60 u, 90 u after 3 pools) and pulls you there. Every 4 of her beats the nearest unlinked pool SHALL ping, with an edge arrow when it is off screen. Every pool SHALL be reachable.

#### Scenario: Grapple on a phone
- **GIVEN** the lining map at 390 × 844 with a knot 50 u ahead
- **WHEN** the player drags toward it and taps
- **THEN** a root tendril snaps to the knot and pulls you there, and you stay above 60% of the screen height
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Firm tissue opens at 5 pools
- **WHEN** you swim into firm tissue with 4 pools linked, and again with 5
- **THEN** it blocks you the first time and you dig through it the second time
- **CHECK** `qa/first-breath/stage-root.test.mjs`

### Requirement: Stage 5, First Trimester as germ waves
Stage 5 SHALL run weeks 7 to 13 as a twin-stick style shooter in the round sac, tied by the cord to the placenta disc where you nestled. Weeks 7 to 12 SHALL each bring one telegraphed wave of germs and blobs through the sac's wall, and your sparks SHALL fire by themselves at the nearest germ. The week 10 fetus line SHALL show as the clock reaches week 10.

#### Scenario: Move and dash on desktop
- **GIVEN** stage 5 at 1440 × 900
- **WHEN** the player holds the left arrow, then presses Space
- **THEN** you move left and dash, and your sparks keep firing at the nearest germ
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: A move in landscape
- **GIVEN** stage 5 at 844 × 390 with touch
- **WHEN** the player drags up past half deflection
- **THEN** you move up, and you stay inside the sac
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: The fetus line
- **WHEN** the clock reaches week 10
- **THEN** the caption shows the label "Week 10" and "From about now you are called a fetus. Sources differ, from week 8 to week 10."
- **CHECK** `qa/first-breath/facts.test.mjs`

### Requirement: Food grows your sparks
In stage 5 cleared germs SHALL drop food that grows your sparks, and each wave SHALL end with a short rest in which the food is drawn in and the cord brings a heal.

#### Scenario: The rest after a wave
- **WHEN** a wave of stage 5 ends with food on the floor and you down one pip
- **THEN** the food is drawn to you, your sparks grow, and the cord heals you before the next wave
- **CHECK** `qa/first-breath/stage-grow.test.mjs`

### Requirement: The big germ
Stage 5 SHALL end at week 13 with the big germ, a boss with a boss bar and three phases.

#### Scenario: Waves, rests and the boss
- **WHEN** the reference bot plays stage 5
- **THEN** six waves come with a rest after each, the big germ follows at week 13 in three phases, and the clock runs from week 7 to week 13
- **CHECK** `qa/first-breath/stage-grow.test.mjs`

### Requirement: Stage 7, Third Trimester as survivor waves
Stage 7 SHALL be a 60 s survivor wave from week 28 in a round arena that eases from radius 54 u to 38 u as the space gets snug. Germs SHALL come in a wave table that ramps with time, with swarmer rings and the Big Germ at 48 s. The dash SHALL be a kick that knocks germs back.

#### Scenario: It gets snug
- **WHEN** the waves run from 20 to 55 s, with any input
- **THEN** the arena's radius eases from 54 u to 38 u, and you and every germ stay inside it
- **CHECK** `qa/first-breath/stage-turn.test.mjs`

#### Scenario: The kick
- **WHEN** the player taps with 3 germs within 14 u
- **THEN** each is knocked back 20 u and takes 1 damage, and the kick waits 1.4 s to come back
- **CHECK** `qa/first-breath/stage-turn.test.mjs`

### Requirement: The turn head-down and the rest
After the waves of stage 7 the baby SHALL turn head-down: a drag down for 1.0 s turns you, and if the turn is not done 6 s into it the baby SHALL turn by itself with "Most babies turn head-down by 36 to 37 weeks. You turn now." Weeks 37 to 40 SHALL be an unscored 10 s rest with "Rest. Keep your thumb on the screen." while the song is hummed.

#### Scenario: Turn on a phone
- **GIVEN** the turn at 390 × 844
- **WHEN** the player drags down past half deflection for 1.0 s
- **THEN** the baby turns head-down and the turn counts as yours
- **CHECK** `qa/first-breath/stage-turn.test.mjs`

#### Scenario: Turn with keys
- **GIVEN** the turn at 1440 × 900
- **WHEN** the player holds S or the down arrow for 1.0 s
- **THEN** the baby turns head-down before the 6 s limit
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: The turn by itself
- **WHEN** the player does nothing at the turn
- **THEN** the baby turns head-down by itself 6 s into it, with its line
- **CHECK** `qa/first-breath/stage-turn.test.mjs`

#### Scenario: The rest
- **WHEN** the rest starts
- **THEN** nothing is judged, the score does not change, and the stage ends after it with "Week 40. You are ready."
- **CHECK** `qa/first-breath/stage-turn.test.mjs`

### Requirement: Antibodies from your mother
In stage 7 your weapons SHALL be {carer}'s antibodies, drawn as small paper Ys that stream from the placenta disc. Popped germs SHALL drop sparkles that fill a grow meter; at 8, 20, 36, 56, 80 and 108 sparkles you SHALL level up and pick 1 of 3 antibody gifts by swimming into a bubble. At 60 s every germ left SHALL pop with "{Carer}'s antibodies clear them all."

#### Scenario: Level up
- **WHEN** you collect the 8th sparkle
- **THEN** time slows, three distinct gift bubbles show, and the one you swim into applies at once
- **CHECK** `qa/first-breath/stage-turn.test.mjs`

#### Scenario: The clear
- **WHEN** the waves reach 60 s, with any input
- **THEN** every germ on screen pops, every sparkle is pulled to you, and the turn starts
- **CHECK** `qa/first-breath/stage-turn.test.mjs`

### Requirement: The gates of birth
Waves 2, 4, 6 and 8 of stage 8 SHALL each bring a gate for a birth move: Tuck (a tight gate across all lanes, passed tucked), Turn (a turn gate in the left or right lane, marked by an arrow), Lift (a lift gate in the middle lane, passed tucked) and Turn back (a turn gate on the other side from wave 4). Each move SHALL play on its wave either way.

#### Scenario: Tuck on a phone
- **GIVEN** the Tuck gate at 390 × 844
- **WHEN** the player taps just before reaching it
- **THEN** you tuck, pass the gate, the chin tucks, and the move counts as yours
- **CHECK** `qa/first-breath/stage-birth.test.mjs`

#### Scenario: Turn with keys
- **GIVEN** the Turn gate in the right lane at 1440 × 900
- **WHEN** the player presses D or the right arrow to reach that lane before the gate
- **THEN** you pass through the gate, turn right, and `turnDir` is right for the Turn back gate
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: One-button birth
- **GIVEN** one-button mode
- **WHEN** the player holds the button through every wave
- **THEN** every gate is passed, and the birth completes
- **CHECK** `qa/first-breath/input.e2e.mjs`

### Requirement: The runner always reaches the light
Stage 8 SHALL end at 65.5 s for every input: 8 contraction waves from 2.0 s, one every 7.5 s, then the 3.5 s light. A bump SHALL only slow you for 0.6 s and SHALL never change hp, the waves or the end time. Every fold pattern SHALL leave an open lane or a tight gap, and folds SHALL stop when wave 8 ends.

#### Scenario: Bumps only slow you
- **WHEN** a bot runs into every fold
- **THEN** the light still starts at 62.0 s and the stage ends at 65.5 s
- **CHECK** `qa/first-breath/stage-birth.test.mjs`

#### Scenario: Always passable
- **WHEN** the folds of 20 seeds are generated
- **THEN** each leaves at least one open lane or a tight gap, and no two folds are closer than 0.7 s of travel
- **CHECK** `qa/first-breath/stage-birth.test.mjs`

### Requirement: A miss or a hit only adds less
In stage 6 a missed or late kick SHALL never reset progress, stall development or take points away; it SHALL only earn less, and an Off press SHALL show only a faint dotted ring. In the action stages a hit SHALL cost a pip and never points already earned, a bump in stage 8 SHALL only slow you, and no hit SHALL stall development.

#### Scenario: Off kicks in stage 6
- **WHEN** the player kicks 300 ms early on every note
- **THEN** every phrase still plays on time, no count resets, and only a faint dotted ring shows
- **CHECK** `qa/first-breath/stage-answer.test.mjs`

#### Scenario: A hit keeps your points
- **WHEN** you are hit in any action stage
- **THEN** the stage score does not go down
- **CHECK** `qa/first-breath/stage-<id>.test.mjs`

## MODIFIED Requirements

### Requirement: The place in the HUD
In stage 1 the HUD SHALL show the player's place among the 20, such as "3rd of 20", ranked by progress along the course, with sperm that are out ranked behind every racer, the later out ahead of the earlier. The shown place SHALL change only after a new place has held for 0.25 s. A small tag under it SHALL show how many still race, such as "14 racing", and the item you hold.

#### Scenario: The place changes
- **WHEN** a rival passes the player in the tube and stays ahead
- **THEN** a `place` event moves the slot from "3rd of 20" to "4th of 20" within 0.3 s, once the new place has held for 0.25 s
- **CHECK** `qa/first-breath/stage-swim.test.mjs`, `qa/first-breath/layout.e2e.mjs`

### Requirement: The top-3 goal
Stage 1's goal SHALL be to reach the meeting place in the top 3 before the 117 s cap; there the game SHALL show "Wait here. The egg is coming." With the wait at the meeting place, or the 3 s carry after Go on, stage 1 SHALL never run past 120 s. The score SHALL count the place, wave and drift boosts, the warm lane, being ready, and sparks that hit, slingshots and goo, with 1st place as the Flourish.

#### Scenario: A mid player
- **WHEN** the skill 0.7 bot races 20 seeds
- **THEN** it reaches the meeting place in the top 3 in at least 18 of them
- **CHECK** `qa/first-breath/stage-swim.test.mjs`

#### Scenario: First place
- **WHEN** the reference bot races 20 seeds
- **THEN** it is 1st in at least 16 of them, arriving 46 to 54 s into the stage, and grades Great or better in at least 18
- **CHECK** `qa/first-breath/stage-swim.test.mjs`

#### Scenario: An idle player
- **WHEN** the player touches nothing in stage 1
- **THEN** the cool tide reaches the cell by about 14 s, it rests, and the Almost card shows its place
- **CHECK** `qa/first-breath/stage-swim.test.mjs`

### Requirement: Rivals race, and nobody is harmed
The 19 rivals SHALL race by the same rules as you, by a seeded policy with a spread of skill: they follow the racing line, drift, use items and draft as their skill allows. Contact SHALL be a soft bump, a spark SHALL only spin a sperm out for 0.8 s, and goo SHALL only make it slip. A sperm left behind by a gate or the tide SHALL rest. The catch-up SHALL stay as before (rivals ahead of you ease by up to 10% and rivals behind gain up to 6%, over 400 u), with the item table on top. Nothing SHALL be killed.

#### Scenario: The same race for the same seed
- **WHEN** stage 1 runs twice in node with the same seed and the same input
- **THEN** every rival is at the same spot at every step, the items rolled are the same, and the places are equal
- **CHECK** `qa/first-breath/stage-swim.test.mjs`

#### Scenario: A soft bump
- **WHEN** two swimming sperm touch
- **THEN** they are pushed apart, each keeps 0.7 of its speed, and each is back to its full top speed 0.6 s later
- **CHECK** `qa/first-breath/stage-swim.test.mjs`

#### Scenario: Falling behind
- **WHEN** a gate closes on a rival
- **THEN** it slows to a stop over 1 s, dims, stays drawn by the wall, still counts in the places, and "Some sperm rest here." shows the first time
- **CHECK** `qa/first-breath/stage-swim.test.mjs`

### Requirement: Stage 2, The Egg: the opening
Stage 2 SHALL switch the view to the egg, with "Now you are the egg." on its card, or as its first caption when there is no card. A gold wave, the hormone surge, SHALL wash over the follicle on the mother's first two beats, the follicle SHALL open by itself on her third beat with "It opens.", and the fimbriae SHALL sweep the egg into the tube in 2.0 s. The opening SHALL need no input and SHALL end by 4.7 s.

#### Scenario: The first payoff
- **WHEN** stage 2 starts
- **THEN** the follicle opens on her third beat, by 3.0 s into the stage
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

#### Scenario: The surge comes first
- **WHEN** stage 2 starts
- **THEN** the gold surge plays on beats 1 and 2 with the prompt showing no gesture, and no target is ever laid in the stage
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

#### Scenario: Tap on any layout
- **WHEN** the player taps anywhere on a phone in portrait or landscape, or presses Space, Enter or Z on desktop, during the opening
- **THEN** nothing is judged, and the opening plays the same as with no input
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: A short opening
- **WHEN** the player does nothing in the opening
- **THEN** the follicle opens on beat 3, the sweep plays, and the guard starts by 4.7 s
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

### Requirement: Guard your shell
In stage 2's guard a glowing arc SHALL follow one drag round the shell as the paddle of a brick breaker: it bounces the glow, blocks enzyme sparks and catches power-ups. A rival that swims in under it SHALL bounce away. A rival that reaches an open part of the shell SHALL stick and burrow, with a progress ring, and the arc over it SHALL pop it loose. A rival that finishes burrowing SHALL be held, still, in the egg's cloud and SHALL never enter.

#### Scenario: Guard in portrait
- **GIVEN** the guard at 390 × 844 with touch
- **WHEN** the player touches down near the bottom of the screen and drags toward the upper left
- **THEN** the arc turns to the upper left of the shell, within 10° of the drag's angle, and the egg stays above 60% of the screen height
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Guard in landscape
- **GIVEN** the guard at 844 × 390 with touch
- **WHEN** the player drags right with either thumb
- **THEN** the arc moves to the right side of the shell
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Guard on desktop
- **GIVEN** the guard at 1440 × 900
- **WHEN** the mouse moves above the egg with no button down, then the right arrow is held, then released with the cursor still over the page
- **THEN** the arc first faces the pointer, then turns clockwise as seen, then stays where the arrow left it
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Pop a stuck sperm loose
- **WHEN** a diver or a rush rival sticks to the shell and the player moves the arc over it before 4.0 s pass
- **THEN** it comes loose and drifts off, and a rush rival counts half in the rush credit
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

#### Scenario: A held rival never enters
- **WHEN** a rival finishes burrowing
- **THEN** it is held, still, in the cloud, the shell loses one pip, the guard goes on, and it never enters
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

#### Scenario: One-button guard
- **GIVEN** one-button mode in the guard
- **WHEN** the player holds the button, and then lets go
- **THEN** while held the arc turns to the bot's target (the glow or enzyme spark due soonest, else a falling power-up, else the rival due soonest), never onto the gold sperm, and after the release it stays still
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: The arc bot keeps off the gold sperm
- **WHEN** the reference bot guards over 20 seeds
- **THEN** it never nudges the player's gold sperm
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

### Requirement: Only your sperm enters
The player's sperm from stage 1 SHALL come to the egg in gold, with "Let it in." The arc SHALL only nudge it back, at most 3 times; the glow and enzyme sparks SHALL pass through it; and it SHALL always return, burrow and enter by itself, by 60 s into the guard. Exactly one sperm SHALL enter in stage 2, the player's, also after a knock-out and Go on. As it comes in and works its way through the shell, a caption SHALL say that Izumo1 meets Juno, done by the time it enters.

#### Scenario: It always gets in
- **WHEN** the player holds the arc on the gold sperm the whole time
- **THEN** it is nudged back 3 times, slips under the arc and enters by 60 s into the guard
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

#### Scenario: Exactly one enters
- **WHEN** stage 2 runs over 20 seeds with no input, with the reference bot, with random drags, and with a knock-out followed by Go on
- **THEN** every run has exactly one `enter` event, and it is the gold sperm's
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

### Requirement: The gold sperm's way in
The gold sperm SHALL come in 1.0 s after the swarm drifts off when you placed 1st in stage 1, and 0.3 s later for each place lower. Its seeded angle SHALL always exist and SHALL keep clear of the arc, of the thumb side and of the portrait caption band.

#### Scenario: Earlier when placed higher
- **WHEN** stage 2 runs with a stage 1 place of 1, 3 and 20, and the swarm drifts off at time S
- **THEN** the gold sperm comes in at S + 1.0, S + 1.6 and S + 6.7 s
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

#### Scenario: A place to come in from
- **WHEN** stage 2 runs over 20 seeds with the reference bot, and with the arc parked at each of 72 angles
- **THEN** the gold sperm always finds an angle, at least the arc's half-width plus 30° from it, never from straight below or under the portrait caption band
- **CHECK** `qa/first-breath/stage-egg.test.mjs`, `qa/first-breath/layout.e2e.mjs`

### Requirement: Seal your shell
When the player's sperm has entered, stage 2 SHALL ask "Tap to seal your shell." A press, or 2.0 s with none, SHALL send a shimmering wave round the shell from the entry point and out to the screen edge, turning every enzyme spark into a gold sparkle and sending every other sperm drifting off. Each seal charge still kept SHALL add 250 Flourish points. The seal SHALL not be timed to a beat.

#### Scenario: Seal on a phone
- **GIVEN** the seal at 390 × 844
- **WHEN** the player taps after the prompt
- **THEN** the wave runs round the shell from the entry point and out to the screen edge, no enzyme spark is left, and the other sperm drift off
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

#### Scenario: Seal in landscape
- **GIVEN** the seal at 844 × 390 with touch
- **WHEN** the player taps with either thumb
- **THEN** the shell seals
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Seal with Space
- **GIVEN** the seal at 1440 × 900 with two seal charges kept
- **WHEN** the player presses Space
- **THEN** the shell seals, and 500 Flourish points are earned
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: No input at the seal
- **WHEN** the player does nothing at the seal
- **THEN** "Your shell seals itself." shows 2.0 s after the prompt, and fusion follows
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

### Requirement: A fresh press seals the shell
Only a press made after the seal prompt SHALL seal the shell. A thumb or button still down from the guard SHALL have to lift and press again, and lifting it SHALL do nothing. With no fresh press by 2.0 s after the prompt, the shell SHALL seal by itself.

#### Scenario: A thumb still down from the guard
- **GIVEN** the guard at 390 × 844 with the thumb still down from its drag when the seal prompt shows, and one-button mode at 1440 × 900 with Space still held from the guard
- **WHEN** the player lifts the thumb, or lets go of Space, right after the prompt
- **THEN** nothing seals, and a new press seals the shell
- **CHECK** `qa/first-breath/input.e2e.mjs`, `qa/first-breath/stage-egg.test.mjs`

### Requirement: Stage 4, The Placenta
Stage 4 SHALL let the player drift to any of 3 soft spots to nestle (the nearest spot draws the embryo in after 5 s idle), then explore a lining map to find 8 gland pools that swell on the mother's beat: 3 in open fluid, 3 behind soft tissue and 2 behind firm walls. Entering a pool SHALL link it, and a glow SHALL run back along your roots. From 30 s into the roots, the nearest unlinked pool SHALL link by itself every 4 s, so all 8 link by 58 s. No nutrient count, drain or fail clock SHALL exist.

#### Scenario: Steer roots on a phone
- **GIVEN** the roots at 390 × 844
- **WHEN** the player swims into a pool
- **THEN** the pool links, a glow runs back along the roots, and the link counts as yours
- **CHECK** `qa/first-breath/stage-root.test.mjs`

#### Scenario: Grow roots in landscape
- **GIVEN** the roots at 844 × 390 with touch
- **WHEN** the player drags right
- **THEN** you move forward, which is right in landscape, and the roots grow behind you
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Idle roots
- **WHEN** the player touches nothing during the roots and is not knocked out
- **THEN** every pool links by itself by 58 s with "The roots reach it anyway." for each
- **CHECK** `qa/first-breath/stage-root.test.mjs`

#### Scenario: Gland pools first
- **WHEN** stage 4 is drawn at any moment
- **THEN** the pools are milk-white with dotted rims and none is red
- **CHECK** `qa/first-breath/stage-root.test.mjs`

### Requirement: The first heartbeat
On Day 22 after fertilization the world SHALL hush for 1.5 s and the embryo's own heart SHALL start beating by itself at 110 bpm. The game SHALL show the label "Day 22 after fertilization (week 5)" with "Your heart beats for the first time." and then "This beat is yours." Each of the first 8 beats SHALL send a pulse down the root tree that pops every germ within 40 u of it. The moment SHALL need no input. After it both hearts SHALL play together.

#### Scenario: The hinge
- **WHEN** the hinge starts
- **THEN** the mother's heart drops 8 dB for 1.5 s, a quick pulse glows in the embryo's chest, and both hearts play after the 8 beats
- **CHECK** `qa/first-breath/stage-root.test.mjs`

#### Scenario: The heart beats without taps
- **WHEN** the player taps nothing
- **THEN** the heart still beats at 110 bpm, its pulses still run down the roots, and the stage goes on
- **CHECK** `qa/first-breath/stage-root.test.mjs`

#### Scenario: The pulse clears the map
- **WHEN** the heart beats with germs near the tree
- **THEN** each pulse pops the germs within 40 u of the tree, and no germ near the tree is left after the 8th beat
- **CHECK** `qa/first-breath/stage-root.test.mjs`

### Requirement: Stage 6, Second Trimester
Stage 6 SHALL be the one rhythm stage, at the mother's 78 bpm, with three lanes. It SHALL turn the mother's heartbeat from felt to heard at week 15 and ask for 6 kicks with it, in the middle lane, in weeks 15 to 18. From week 19 it SHALL play 6 hummed phrases, each a 4-beat call with its notes in lanes and a 4-beat answer echoed in the same lanes, then the sing-along: the 16 call notes back to back and a jump note across all lanes. No phrase SHALL start before week 19. A kick SHALL count when it is in time and in the note's lane. The eyes SHALL open by themselves at week 26.

#### Scenario: Phrases start at week 19
- **WHEN** stage 6 runs with any input
- **THEN** no phrase starts before gaDay 133, and the first phrase opens with "In one study, the first response to sound was to a low tone."
- **CHECK** `qa/first-breath/stage-answer.test.mjs`

#### Scenario: Lanes on a phone
- **GIVEN** a phrase answer at 390 × 844
- **WHEN** the player drags right past 24 px, lifts, and taps on the next answer beat
- **THEN** you are in the right lane, and the tap is graded on its touch-down time
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Arrow on the beat
- **GIVEN** stage 6 at 1440 × 900
- **WHEN** the player presses the left arrow on a beat whose note is in the left lane
- **THEN** you move a lane left and the keydown counts as the kick, in time
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Stage 6 facts read between the hum lines
- **WHEN** stage 6 runs in real time with the reference bot or the mid bot, in portrait, landscape or desktop
- **THEN** every caption fact the stage sends shows whole, coming back after each hum line and "{Carer} feels you." until it has had its reading time
- **AND** "By week 21, you can hear voices outside the womb." and "You can get hiccups by about week 19." are listed in "What was real"
- **CHECK** `qa/first-breath/pacing.test.mjs`, `qa/first-breath/stage-answer.test.mjs`

#### Scenario: Sound off
- **GIVEN** the sound muted
- **WHEN** a phrase is hummed
- **THEN** each note shows as a gold ripple in its lane with a caption, and each answer slot has a ghost ripple and a DOM ring in `svg#rings` at least its preview time before it
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: The fever
- **WHEN** the player kicks 8 notes in a row In time in the sing-along
- **THEN** the hand glow lights round your ring, each note counts 1.5 times toward the song part until a miss, and the part never passes its max
- **CHECK** `qa/first-breath/stage-answer.test.mjs`

### Requirement: Answers bring a warm reply
A phrase answered with at least 75% of its notes Close or better, each in its lane, SHALL bring "{Carer} feels you." with the carer word, and from phrase 2 a warm hand glow on the wall. A phrase under 75% SHALL lead on to the next phrase on time, and the voice SHALL never stop as a result of a miss. The notes answered in the phrases or the sing-along SHALL be lit in the song carried to stage 7 and the ending.

#### Scenario: Answer a phrase
- **WHEN** the mother hums `LM.R` in phrase 3 and the player kicks the same pattern in the same lanes in the answer bar
- **THEN** the phrase matches, the hand glow presses on the wall, and the notes are lit in the song
- **CHECK** `qa/first-breath/stage-answer.test.mjs`

#### Scenario: A missed phrase
- **WHEN** the player kicks nothing in an answer bar
- **THEN** the next phrase is hummed on time, the stage goes on, and those notes stay unlit unless the sing-along lights them
- **CHECK** `qa/first-breath/stage-answer.test.mjs`

### Requirement: Stage 8, Birth
Stage 8 SHALL be an endless-runner escape down a channel of three lanes. Each of 8 contraction waves SHALL be a 5.0 s surge of speed, from 50 u/s on wave 1 up to 78 u/s on wave 8, between short rests. The player SHALL slide between lanes to pass soft folds and SHALL tuck, the dash, to slip through tight gaps. The opening SHALL be drawn only as light, as a full-width glow at the bottom of the screen. After wave 8 the light SHALL rise to white over 3.5 s.

#### Scenario: Nothing held
- **WHEN** the player touches nothing during the waves
- **THEN** you bump the folds in your lane and slow, each wave still carries you on, and the light comes after wave 8
- **CHECK** `qa/first-breath/stage-birth.test.mjs`

#### Scenario: Lanes in landscape
- **GIVEN** stage 8 at 844 × 390 with touch
- **WHEN** the player drags right and lets go
- **THEN** you slide right and settle on the next lane
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: The light
- **WHEN** wave 8 ends
- **THEN** the draw list's only light is a full-width mark at the bottom, and its exposure rises to 6 and its white to 1 within 3.5 s
- **CHECK** `qa/first-breath/stage-birth.test.mjs`

## REMOVED Requirements

### Requirement: Stage 1, The Race
**Reason**: The straight course gains bends, drifts, items and knockout gates; the race model stays.
**Migration**: Stage 1, The Race as a kart race; Drift, items and the slipstream; Knockout gates and the cool tide.

### Requirement: Stage 3, The Embryo: first cells
**Reason**: Tap targets and hold-release moments become rooms, splits and gifts.
**Migration**: Stage 3, first cells room by room; Gifts at each split; The Knot.

### Requirement: Stage 5, First Trimester
**Reason**: Heartbeat taps and drag moves become a twin-stick style shooter.
**Migration**: Stage 5, First Trimester as germ waves; The big germ.

### Requirement: Your heart sets the peak tempo
**Reason**: Stage 5 has no timed targets now.
**Migration**: The heart curve stays in `clock.bpmYou` for the sound and the heart ring; the timing windows apply in stage 6 (first-breath-input).

### Requirement: Stage 7, Third Trimester
**Reason**: The breaths and the roomy turn become survivor waves and a short turn.
**Migration**: Stage 7, Third Trimester as survivor waves; Antibodies from your mother.

### Requirement: The prompted moves of birth
**Reason**: The drag-and-hold waves become runner gates.
**Migration**: The gates of birth.

### Requirement: A miss only adds less
**Reason**: Stage 3 has no taps now, and the action stages have hits.
**Migration**: A miss or a hit only adds less.
