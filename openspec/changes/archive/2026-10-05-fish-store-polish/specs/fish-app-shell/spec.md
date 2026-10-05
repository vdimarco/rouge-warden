## ADDED Requirements

### Requirement: Store build
A store build SHALL show only the parts of the game that belong to the app. The build sets `data-build="store"` on the page, and a page inside a Capacitor app SHALL act the same way. In a store build there is no "Switch game" button, no link to the arcade, no Fullscreen button, no "GET PLUNGER'D" kicker, and no arcade script. The web arcade SHALL keep all of these.

#### Scenario: Title in the app
- **WHEN** the store build shows the title at 390x844
- **THEN** the title has six controls: Go fishing, Derby: 10 casts, Places, Journal, How to play, and Settings.

#### Scenario: Pause in the app
- **WHEN** the player pauses in the store build
- **THEN** the pause card shows Resume, How to play, Journal, Settings, and Quit to the title.

#### Scenario: The web game
- **WHEN** the game opens at `/fish/` on the web
- **THEN** "Switch game" and "Back to the arcade" still show and work.

### Requirement: App copy
The store build SHALL use copy that fits an app. It SHALL NOT tell the player about Safari, site settings, a browser, or "free in your browser".

#### Scenario: Motion unavailable in the app
- **WHEN** the motion sensors give no data in the store build
- **THEN** the game says "Motion is off. You can play with touch." and touch play starts. The app grants motion itself, so the copy never sends the player to a settings screen.

### Requirement: Android back button
The back button SHALL close the top screen or pause the game. It SHALL NOT close the app during play.

#### Scenario: Back on each screen
- **WHEN** the player presses back on Help, Settings, the Journal, or the Places
- **THEN** that screen closes.
- **WHEN** the player presses back while casting, reeling, or fighting
- **THEN** the game pauses, and a second back resumes it.
- **WHEN** the player presses back on the catch card or the results
- **THEN** the game goes on as if the main button was pressed.
- **WHEN** the player presses back on the title
- **THEN** the app goes to the background.
- **WHEN** the player presses back while a place loads
- **THEN** nothing happens.

### Requirement: Native bridge
When the game runs in a Capacitor app, it SHALL use the native plugins that exist, and it SHALL run without error when a plugin is missing. The bridge SHALL hide the splash screen when the title is ready, keep the screen awake while the player fishes, pause on app pause, and resume sound on app resume. The app SHALL keep the status bar hidden through its native code, without hiding the iPhone home indicator.

#### Scenario: App goes to the background in a fight
- **WHEN** the app goes to the background in a fight and comes back
- **THEN** the game shows the pause screen, and sound plays again after Resume.

#### Scenario: Web page
- **WHEN** the game runs in a browser with no Capacitor
- **THEN** the bridge does nothing and the game behaves as it does today.

### Requirement: Durable save
In the app, the save SHALL also go to native storage. When web storage is empty at boot, the game SHALL restore the save from native storage.

#### Scenario: Web storage cleared
- **WHEN** the phone clears web storage and the player opens the app
- **THEN** the journal, the places, and the settings are back.
