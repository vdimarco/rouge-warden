## ADDED Requirements

### Requirement: Every fact is sourced and checked
Every fact shown in the game SHALL be one entry with an id, a stage, a gaDay (and a gaEnd for a span), its text, one or more source keys from an allow-list built from the research in this change, and an access tag of R (the page was read) or A (the abstract was read). A fact with only search-result access SHALL NOT ship. A fact marked `checked: false`, such as the WHO weights until the 2017 and 2021 corrections are reviewed, SHALL NOT be shown.

#### Scenario: The facts test
- **WHEN** the facts test runs
- **THEN** every fact has a gaDay, a computed clock label, allow-listed sources and an access tag of R or A
- **CHECK** `qa/first-breath/facts.test.mjs`

#### Scenario: An unchecked fact
- **WHEN** a whole run is played and the shown fact ids are listed
- **THEN** `turn.weight` is not among them while it is marked `checked: false`
- **CHECK** `qa/first-breath/facts.test.mjs`

### Requirement: Labels come from the clock
No fact text SHALL start with a clock label such as "Week" or "Day". The label SHALL be computed from the fact's gaDay, or from its gaDay and gaEnd for a span, and shown once in front of the text on cards, captions, overlays, the Sources screen and "What was real". A span SHALL NOT cross gaDay 42, where the label changes form.

#### Scenario: No written labels
- **WHEN** the facts test reads every fact
- **THEN** no text starts with "Week", "Weeks", "Day" or "Days", and every span stays on one side of gaDay 42
- **CHECK** `qa/first-breath/facts.test.mjs`

#### Scenario: A span label
- **WHEN** the card for The Placenta shows `root.bury`
- **THEN** it reads "Days 6 to 9 after fertilization (weeks 2 to 3)" and then "You bury yourself in the soft lining of the womb."
- **CHECK** `qa/first-breath/clock.test.mjs`

### Requirement: Clear wording about the two clocks
Facts and labels SHALL say which clock they use. Every "Day" label SHALL say "after fertilization". The fertilization overlay SHALL say "Midwives and doctors already call this week 2. Weeks count from the first day of the last period." The word "fetus" SHALL appear only from week 10, with "Sources differ, from week 8 to week 10."

#### Scenario: Day labels
- **WHEN** every shown string is scanned
- **THEN** every label that starts with "Day" contains "after fertilization"
- **CHECK** `qa/first-breath/clock.test.mjs`

#### Scenario: The fetus word
- **WHEN** the strings are scanned with their gaDay
- **THEN** no string before gaDay 70 says "fetus"
- **CHECK** `qa/first-breath/clock.test.mjs`

### Requirement: Trimester borders and sizes are not exact
Trimester cards SHALL state their borders with "about": "First trimester: up to about week 13.", "Second trimester: about weeks 14 to 27." and "Third trimester: about week 28 to birth." Size comparisons SHALL quote the NHS object and say so, and cells SHALL get no comparison.

#### Scenario: Trimester borders
- **WHEN** the cards for stages 5, 6 and 7 are read
- **THEN** each states its trimester's border with "about"
- **CHECK** `qa/first-breath/facts.test.mjs`

#### Scenario: Size comparisons
- **WHEN** a fact names a fruit or a vegetable
- **THEN** the same fact says "the NHS says" or "The NHS compares this to"
- **CHECK** `qa/first-breath/facts.test.mjs`

### Requirement: The word for the person carrying the baby
The game SHALL call the person carrying the baby "your mother" by default, and Settings SHALL offer mother, mum, mom and parent under "Word for the one who carries you". Strings SHALL use the carer word as a noun only, and no shown string SHALL contain she, her, hers, herself, he, him, his, himself, they, them, their, theirs or themselves. The setting SHALL apply at once to every string, and SHALL NOT be cut.

#### Scenario: Change the word
- **GIVEN** stage 6 with the word set to "mum"
- **WHEN** a phrase is answered
- **THEN** the caption reads "Your mum feels you."
- **CHECK** `qa/first-breath/text.test.mjs`

#### Scenario: No pronouns
- **WHEN** every string is rendered with each of the four words
- **THEN** none contains a banned pronoun as a whole word, and every sentence still has 16 words or fewer
- **CHECK** `qa/first-breath/text.test.mjs`

### Requirement: Banned words
No shown string SHALL contain the words die, dies, died, dying, dead, death, lose, loses, losing, lost, loser or NICU, or any word that starts with kill, fail, miscarr, abort, sex, pain, hurt, danger, sick, viab, prematur, invad, invas, attack, destroy, defeat, conquer, enem, fight or battle, in any of the four carer settings. No stage 1 or stage 2 string SHALL contain "fastest" or "winner", the whole words win, wins or won, or the phrases "beat the" or "beats the".

#### Scenario: The word scan
- **WHEN** the text test scans every string, fact, caption, card and screen text
- **THEN** no banned word is found
- **CHECK** `qa/first-breath/text.test.mjs`

#### Scenario: Race and guard words
- **WHEN** the text test scans the strings of stages 1 and 2
- **THEN** none says "kill", "invade", "invasion", "attack", "destroy", "defeat", "conquer" or "enemy" in any form, none contains "fastest" or "winner", none has the whole word "win", "wins" or "won", and none says "beat the" or "beats the"
- **CHECK** `qa/first-breath/text.test.mjs`

### Requirement: Gentle words for the race and the guard
The race and the guard SHALL be game framing told in gentle words: "race", "place", "bump", "rest", "bounce", "drift off", "Guard your shell", "Only one may enter" and "Let it in". Rivals SHALL bump, fall behind, bounce away, drift off and rest, and nobody SHALL be harmed. No string SHALL say that the fastest sperm wins. The run result SHALL say what is real: in life a sperm must be ready at the right time and place, and the shell changes only after one sperm joins.

#### Scenario: The guard's lines
- **WHEN** stage 2's guard starts and the player's sperm comes in
- **THEN** the captions read "Guard your shell. Only one may enter." and "Let it in."
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

#### Scenario: The egg's fluid is a general fact
- **WHEN** stage 2 runs with any input
- **THEN** `egg.choice` shows in the guard before the gold sperm comes in, and no string says that the egg picks the player's sperm
- **CHECK** `qa/first-breath/stage-egg.test.mjs`, the human read of every string

#### Scenario: What was real after the race
- **WHEN** a whole run reaches the run result
- **THEN** "What was real" lists `swim.frame` and `egg.frame` with their labels and sources, after the stage 2 facts
- **CHECK** `qa/first-breath/facts.test.mjs`

### Requirement: Tender tone
The game SHALL start inside the body with cells and SHALL NOT show or suggest intercourse or sexual anatomy, or label anatomy. It SHALL NOT show or imply miscarriage, injury, distress or death. Rivals in the race and the sperm at the egg SHALL only bump, bounce, drift off and rest, and nothing SHALL be killed.

#### Scenario: Stage events
- **WHEN** every stage runs with the reference bot and with no input
- **THEN** no event or string names harm, and every sperm in stages 1 and 2 ends swimming, resting, held still in the cloud, or drifting off
- **CHECK** `qa/first-breath/stage-swim.test.mjs`, `qa/first-breath/stage-egg.test.mjs`, `qa/first-breath/text.test.mjs`

#### Scenario: A human read
- **WHEN** the pull request is ready
- **THEN** a person has read every string in the game against these rules
- **CHECK** the pull request description

### Requirement: The body and the birth are shown gently
The mother's body SHALL never be an obstacle, and no hazard SHALL be tied to the mother. The birth opening SHALL be drawn only as light, with no blood, no people until the ending and no sign of pain. In stage 8 the renderer's own frames SHALL be straight side flats with no closed aperture, so no ring of paper edges frames the light. No drop or drip shapes SHALL be drawn, and the stage 5 pools SHALL be rose, not crimson. The game SHALL give no medical advice and no viability or prematurity facts.

#### Scenario: No hazards from the mother
- **WHEN** stage 1 runs with any seed
- **THEN** only the gentle current, wall contact (which keeps 0.9 of the speed) and soft bumps with other sperm slow the cell, the course has no immune cells or hazards, and nothing harms it
- **CHECK** `qa/first-breath/stage-swim.test.mjs`

#### Scenario: The birth frame
- **WHEN** a frozen frame of the last birth wave is read
- **THEN** the opening is a full-width band of light at the bottom, and no splat or mark of an anatomy kind is in the draw list
- **CHECK** `qa/first-breath/visual.e2e.mjs`

#### Scenario: The light is not framed
- **WHEN** the first frame of the birth light and a frame 1 s into it are read, in both tiers
- **THEN** the brightest region touches the bottom edge across at least 90% of the width, a flood fill over the brightest 10% of pixels from the brightest pixel reaches the bottom row, and the stage 8 frames touch only the left or the right edge of the screen
- **CHECK** `qa/first-breath/visual.e2e.mjs`

### Requirement: A content note on the title
The title SHALL show the note "A gentle story of growing before birth. Cells, the womb and birth are shown simply." under the tagline.

#### Scenario: The title note
- **WHEN** the title shows at any of the three layouts
- **THEN** the content note shows under the tagline
- **CHECK** `qa/first-breath/smoke.e2e.mjs`

### Requirement: No Apgar framing
The score, the grades, the cabinet line and the run result SHALL NOT be named after or shaped like the Apgar score. The word "Apgar" SHALL appear only in the sourced fact "One minute after birth, a midwife or doctor checks five things. This is the Apgar score." at the end of "What was real", and on the Sources screen.

#### Scenario: Where Apgar appears
- **WHEN** every string and the cabinet line rule are scanned
- **THEN** "Apgar" appears only in the `end.apgar` fact
- **CHECK** `qa/first-breath/text.test.mjs`

### Requirement: The Sources screen
The Sources screen SHALL list every fact in the game with its clock label and its source links. The run result's "What was real" SHALL list every fact shown in that run in the same way.

#### Scenario: Open Sources
- **WHEN** the player opens Sources from the title
- **THEN** every fact shows once with its label and a link that opens its source
- **CHECK** `qa/first-breath/smoke.e2e.mjs`

### Requirement: Plain short sentences
Every shown string SHALL use short, plain words with one idea per sentence. Each sentence SHALL have 16 words or fewer, and each fact 20 words or fewer, not counting its label, with every carer word put in.

#### Scenario: Sentence length
- **WHEN** the text test splits every string into sentences
- **THEN** none is longer than 16 words, and no fact is longer than 20
- **CHECK** `qa/first-breath/text.test.mjs`
