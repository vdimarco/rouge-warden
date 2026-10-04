## ADDED Requirements

### Requirement: First visit
The explainer SHALL open by itself on a player's first visit when the address has no seed. After the player closes it, it SHALL NOT open by itself again in that browser.

#### Scenario: First visit
- **WHEN** a player opens the game for the first time
- **THEN** the explainer plays before the start screen

#### Scenario: Seed link
- **WHEN** a player opens the game from an address with `?seed=`
- **THEN** the stop intro of that run opens, and the explainer does not

#### Scenario: Later visits
- **WHEN** a player who has closed the explainer opens the game again
- **THEN** the start screen opens

### Requirement: Scenes
The explainer SHALL play 7 scenes in this order: build a chain, follow by suit or by rank, 8s are wild, Value and Mult, close a ring, beat the target, and win the run. Each scene SHALL show a title, one or two short sentences, and an animation with the game's cards. An end card SHALL follow, with a short list of the rules.

#### Scenario: Watch it through
- **WHEN** the player watches without a tap
- **THEN** the 7 scenes play in about 50 seconds, and the end card shows Play and Watch again

#### Scenario: Progress
- **WHEN** a scene plays
- **THEN** a bar for each scene shows which scenes are done and how far the current scene is

### Requirement: Controls
The player SHALL be able to go to the next scene, go back one scene, pause while holding a finger on the animation, and skip the explainer. On a keyboard, the right and left arrows SHALL go forward and back, Space SHALL pause and play, and Escape SHALL skip.

#### Scenario: Next and back
- **WHEN** the player taps Next in scene 2 and then Back
- **THEN** scene 3 starts, and then scene 2 starts again

#### Scenario: Hold to pause
- **WHEN** the player holds a finger on the animation
- **THEN** the animation and the scene bar stop until the finger lifts

#### Scenario: Skip
- **WHEN** the player taps Skip
- **THEN** the explainer closes

### Requirement: True to the game
The explainer SHALL take its card points, switches, ring and score from the game engine, and SHALL play the game's switch notes and ring chord, unless the sound is off. Every chain that it shows SHALL follow the rules.

#### Scenario: The scoring scenes
- **WHEN** the Value and Mult scene ends
- **THEN** it shows Value 45 and Mult 4 for 6♣ 6♦ 7♦ 7♠ 8♠ (clubs) A♣

#### Scenario: The ring
- **WHEN** the ring scene ends
- **THEN** Mult shows 8, and the target scene shows a chain score of 360 against a target of 150

#### Scenario: Sound
- **WHEN** the sound is on and the Value and Mult scene plays
- **THEN** each change of suit plays the next note of the scale, and the ring scene plays the ring chord

### Requirement: Ways in and out
The start screen and every stop intro SHALL have a How to play button. On the end card, Play SHALL start a new run when no run is in progress. When the player opened the explainer from a stop intro, the end card SHALL offer Back to the game, which returns to that stop intro.

#### Scenario: From the start screen
- **WHEN** the player taps How to play on the start screen and then Play on the end card
- **THEN** a new run starts at its first stop intro

#### Scenario: From a stop intro
- **WHEN** the player opens the explainer from the stop intro of stop 2 and taps Back to the game
- **THEN** the stop intro of stop 2 shows again, with the same run

### Requirement: Phone layout and motion
The explainer SHALL fit a phone in portrait at 360 by 740, 375 by 667, 390 by 844 and 430 by 932, with every button at least 44 by 44 px, no page scroll, and every card inside the animation area. With reduced motion, cards SHALL fade in at their new place and SHALL NOT travel.

#### Scenario: Small phone
- **WHEN** the explainer plays on a 375 by 667 screen
- **THEN** the animation, the caption and the buttons fit without scrolling

#### Scenario: Reduced motion
- **WHEN** the device asks for reduced motion and a card joins the chain
- **THEN** the card appears at its place in the chain with a fade, and it is never seen between the hand and the chain
