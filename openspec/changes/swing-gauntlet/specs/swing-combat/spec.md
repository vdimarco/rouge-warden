## ADDED Requirements

### Requirement: The brute
A brute SHALL have 6 points and stand about 1.4 times a goon's size, in a purple hoodie. A punch SHALL hurt him and not stop him,
and no blow SHALL stop his wind-up or his charge; other blows stagger him at other times. From 3.2 to 8 m he SHALL wind up for
0.85 s and then lunge at the hero; his blow SHALL take two hearts. A dodge SHALL make his charge miss only while it is still on
when he arrives; a dodge during his lunge is a perfect one. A rope SHALL stagger him and not yank him.

#### Scenario: Dodge the charge late
- **WHEN** a brute 6 m away winds up and the player dodges as he starts his lunge
- **THEN** he misses and the dodge is perfect

#### Scenario: Dodge the charge early
- **WHEN** the player dodges at the start of the brute's wind-up
- **THEN** the dodge is over when he arrives, and the hero loses two hearts

#### Scenario: Punch a brute
- **WHEN** the player punches a brute who winds up
- **THEN** he takes a point, shows a grey THUCK, and his wind-up goes on

### Requirement: Fight marks on the goons
In flat play, a goon on his way to a blow (a wind-up, or a swing that has not landed) SHALL show a red rim and a thicker red outline
that pulse. A goon hit by a blow SHALL flash white and his colour SHALL come back within 0.14 s. A brute's blow SHALL give a heavy
impact: a longer hit-stop, a bigger shake, an impact frame and a red THUCK.

#### Scenario: The red rim
- **WHEN** a goon in view starts his wind-up
- **THEN** at least 40 pixels round him turn red, four times more than turn red between two calm frames

#### Scenario: The flash
- **WHEN** the player punches a goon
- **THEN** he shows white at once, and his own colours 0.5 s later
