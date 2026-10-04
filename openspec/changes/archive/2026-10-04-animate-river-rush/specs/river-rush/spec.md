## ADDED Requirements

### Requirement: Animated river adventure
River Rush SHALL animate current foam, raft wakes, paddle strokes, raft rocking and transitions between paddling and reaching using the approved character art. Motion SHALL remain readable at 1536×1024 and 390×844 without hiding controls.

#### Scenario: Ride and reach
- **WHEN** the player steers into the fast current and then holds Reach
- **THEN** wakes and rocking respond to speed and the character smoothly transitions to the reaching pose

### Requirement: Animated action feedback
Key catches, treasure opening, collisions and falls SHALL have short visual feedback. Effects SHALL expire and be bounded per run, without changing race outcomes or input timing.

#### Scenario: Catch the key and open the chest
- **WHEN** a key is caught and the chest is unlocked
- **THEN** the key travels toward the raft and a gold burst marks the treasure reward

#### Scenario: Strike a rock
- **WHEN** the raft collides with a rock
- **THEN** a splash and brief raft recoil accompany the balance loss

### Requirement: Motion lifecycle and accessibility
Canvas animation SHALL use simulation time so pause and run completion freeze its frame. The game SHALL respond to live prefers-reduced-motion changes by disabling decorative movement and particles while preserving course scrolling, input and objective feedback.

#### Scenario: Pause mid-effect
- **WHEN** the player pauses during a splash or wake
- **THEN** the canvas remains unchanged until the run resumes

#### Scenario: Reduced motion
- **WHEN** the player enables reduced motion before or during a run
- **THEN** decorative water, rocking, pose blending and CSS animation stop, and gameplay remains functional

### Requirement: Higgsfield living title scene
The title scene SHALL use a Higgsfield-generated silent looping video based on the approved character art, with a still-image fallback. It SHALL preserve live readable menu controls, pause while hidden or covered by instructions, and use the still image for reduced motion or data-saving.

#### Scenario: Enter the menu
- **WHEN** the menu loads in a normal-motion browser
- **THEN** the river and character artwork animate behind working Start and Switch game controls

#### Scenario: Video unavailable
- **WHEN** video cannot load or motion/data preferences disable it
- **THEN** the approved still image and all menu actions remain usable

### Requirement: Surge and close-call rewards
The player SHALL be able to spend at least 35 charge points on a 1.8-second Surge using Shift or a dedicated touch control. Surge SHALL accelerate the raft and cost balance, and SHALL be blocked while falling. Clear near misses SHALL grant charge and increasing combo points; impacts SHALL break the combo. One held activation SHALL spend charge only once until released.

#### Scenario: Use Surge
- **WHEN** a player with sufficient charge presses and holds Shift
- **THEN** one Surge starts, its speed and balance cost apply, and a second charge is not spent without releasing and pressing again

#### Scenario: Skim a rock
- **WHEN** the raft passes close to an unhit rock with sufficient clearance
- **THEN** a close-call reward increments the combo and adds charge and score once for that rock
