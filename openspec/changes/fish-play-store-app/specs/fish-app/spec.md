## ADDED Requirements

### Requirement: Reel It In is self-contained
Everything that Reel It In loads SHALL come from `/fish/`, except `/arcade/quiet.js`. The page SHALL NOT request a CDN, a font service, or any other origin. The game SHALL look the same as before: the same fonts at the same weights, and the same three.js r170.

#### Scenario: First visit with no CDN
- **WHEN** a player opens `/fish/` and the browser can reach only the site's own host
- **THEN** the title shows, the lake draws, and no request goes to another origin

#### Scenario: Fonts
- **WHEN** the title, a card with a heading, and the reel canvas draw
- **THEN** the text uses Nunito at weights 600, 800 and 900 and Alfa Slab One at weight 400, loaded from `/fish/fonts/`

### Requirement: Installable identity
The page SHALL have a web manifest with the id `/fish/`, the scope `/fish/`, the start URL `/fish/?source=pwa`, `display` standalone, `orientation` portrait, the colour `#0d2f38`, the category games, and icons of 192 and 512 pixels and a maskable icon of 512 pixels. The icons SHALL read at 48 pixels. The maskable art SHALL stay inside the central 80 % of the icon.

#### Scenario: Install on Android
- **WHEN** a player installs the page from Chrome on an Android phone
- **THEN** the home screen shows a fish and bobber icon named "Reel It In", and it opens full-window in portrait

#### Scenario: Icon at launcher size
- **WHEN** the icon shows at 48 pixels, round or square
- **THEN** a fish and a red and white bobber on a dark teal lake are still plain to see

### Requirement: App mode
The page SHALL run in app mode when its address has `source=play`, `source=pwa` or `app=1`, when the display mode is standalone, fullscreen or minimal-ui, or when the referrer starts with `android-app://`. `app=0` SHALL turn it off. In app mode the page SHALL show no control that leaves the game: the Switch game buttons, the Back to the arcade link, and both Fullscreen buttons. The page SHALL NOT load `/arcade/switch.js`. The title SHALL show the name of the place alone, without "GET PLUNGER'D". The answer SHALL be kept in `sessionStorage` and never in `localStorage`.

#### Scenario: The Play app starts
- **WHEN** the app opens `/fish/?source=play` on a 390 by 844 phone
- **THEN** the title shows "LOON LAKE" above REEL IT IN, and the menu has Derby, Free fishing, Places, Journal, How to play, and Settings, with no Switch game, no Back to the arcade, and no Fullscreen

#### Scenario: The pause menu in the app
- **WHEN** the player pauses a cast in app mode
- **THEN** the pause menu shows Resume, How to play, Journal, Settings, and Quit to the title, and no Switch game and no Fullscreen

#### Scenario: The website keeps its links
- **WHEN** a player opens `/fish/` in a browser tab with no app query
- **THEN** the title shows "GET PLUNGER'D · LOON LAKE", Switch game, Back to the arcade, and the Fullscreen buttons where the browser allows them, as before

#### Scenario: Forced off
- **WHEN** the address has `source=play&app=0`, or `app=0` in an app window
- **THEN** the page is in plain mode

### Requirement: Words for a phone
In app mode the notes SHALL name the phone and Android, not the browser and Safari. Outside app mode every text SHALL stay as it was.

#### Scenario: Sensors are off
- **WHEN** the player taps Use motion and the sensors are denied, in app mode
- **THEN** the note says the sensors are off for this app and tells the player to touch and hold the app icon, tap App info, open Storage, tap Manage space and allow Motion sensors, and offers touch play

#### Scenario: The lake cannot draw
- **WHEN** WebGL is not available, in app mode
- **THEN** the page says "This phone cannot draw the lake." and shows a Try again button that loads the page again

#### Scenario: A touch is cut off
- **WHEN** the system takes the touch away while the thumb holds the line, in app mode
- **THEN** the toast says "The touch was cut off. Try the cast again." and the cast starts over

### Requirement: Offline play
After a first visit that finished, the game SHALL start with no network. A service worker with the scope `/fish/` SHALL keep the page, the styles, every script, three.js, the fonts, the icons, the manifest, the privacy page, `/arcade/quiet.js`, and the art in a versioned cache, and answer from it first. The worker SHALL register after the title shows and SHALL NOT register when the address has `nosw`. Other origins and other methods SHALL go to the network untouched. The worker SHALL answer a Range request for a cached file with a 206 cut from the cached body, and SHALL NOT store a 206.

#### Scenario: Start with no network
- **WHEN** a player who has played once turns on airplane mode and opens the app
- **THEN** the title shows with the lake behind it, Free fishing starts, and the first cast screen shows, with no failed request and no error

#### Scenario: A video seeks offline
- **WHEN** the guide asks for a part of `clips/guide-motion.mp4` with no network
- **THEN** the answer is a 206 with the right `Content-Range` and the right bytes, and a start past the end gets a 416

#### Scenario: First install takes control
- **WHEN** the worker installs for the first time
- **THEN** the open page is controlled at once, and the caches of other pages on the origin stay

### Requirement: Updates
`VERSION` in `sw.js` SHALL be the app version, a plus sign, and ten hex digits of a hash of the cached files. A change to a cached file SHALL change the hash, and the check SHALL fail until `node play/fish/stamp-sw.mjs` has run. A new version SHALL install into its own cache, SHALL wait until the app closes, and SHALL take over at the next launch. It SHALL delete only caches that start with `reelitin-` and are not its own.

#### Scenario: A new version
- **WHEN** the server has a new `sw.js` and the player keeps playing
- **THEN** the page keeps its old files until the app closes, and the next launch shows the new files and only the new cache

#### Scenario: A forgotten stamp
- **WHEN** a script, an image or a font in the cached files changes and `VERSION` does not
- **THEN** `node qa/fish/pwa.mjs --static` fails and says "run node play/fish/stamp-sw.mjs"

### Requirement: Back button
In app mode, after the first tap, Back SHALL NOT close the app in the middle of play. Back SHALL close an open card, pause a running cast or fight, and resume a paused game. Back SHALL do nothing on the catch card, on the unlock card, and while the game travels. Back SHALL take the results to the title. On the title the first Back SHALL show "Press Back again to leave", and the second Back SHALL close the app. Outside app mode the page SHALL NOT change the history.

#### Scenario: Back in a fight
- **WHEN** the player presses Back during a fight
- **THEN** the game pauses with the same fish on the line, and a second Back resumes it

#### Scenario: Back over a card
- **WHEN** the player opens Settings from the pause menu, then Privacy, and presses Back twice
- **THEN** the first Back shows Settings, the second Back shows the pause menu, and the game is still paused

#### Scenario: Back on the title
- **WHEN** the player presses Back on the title, and then presses Back again within two seconds
- **THEN** the first press shows "Press Back again to leave", and the second press closes the app

#### Scenario: Back after a catch
- **WHEN** the catch card shows and the player presses Back
- **THEN** the card stays, and no pause menu opens

### Requirement: Privacy and data control
The page SHALL have a privacy page and a short privacy card in the game. The card SHALL open from Settings and SHALL NOT leave the page. The privacy page SHALL be linked from the title only. Both SHALL say that there is no account, no ads and no analytics, that progress stays on the phone, that the motion sensors work on the phone only, that the game can buzz and keep the screen on, and how to delete the data. The privacy page SHALL name what the web host logs, SHALL say that the game is not for children under 13, and SHALL give a contact. Settings SHALL have Reset progress, which asks first, removes `fish.v1`, `fish.haptics` and `reel-it-in-guide-v1`, keeps `arcade.sound`, and loads the title. In app mode the page SHALL ask the browser to keep its storage once, after the first tap.

#### Scenario: Read the card in a fight
- **WHEN** the player pauses a fight, opens Settings, opens Privacy, and presses Done twice
- **THEN** the pause menu shows with the same fight, and the page did not navigate

#### Scenario: Reset progress
- **WHEN** the player taps Reset progress, taps Keep them, then taps Reset progress and Delete
- **THEN** Keep them changes nothing, Delete clears the fish, the records and the settings, the sound switch stays as it was, and the title shows with a new save

#### Scenario: The full policy
- **WHEN** the player taps Privacy on the title
- **THEN** `privacy.html` opens, with a link back to the game and no link to the arcade

#### Scenario: Contact placeholder
- **WHEN** `privacy.html` still has `OWNER_CONTACT_EMAIL`
- **THEN** `node qa/fish/pwa.mjs` prints a warning and does not fail

### Requirement: Screen layouts
The new controls SHALL fit the layouts that the game supports: a phone in portrait at 375 by 667 and at 390 by 844, with the notch and the home bar, and a short wide window. The new rows SHALL have a touch target of 48 pixels.

#### Scenario: Short phone
- **WHEN** the title and Settings show at 375 by 667
- **THEN** every button, the Privacy link, and the Reset progress question are reachable, by scrolling if they do not fit
