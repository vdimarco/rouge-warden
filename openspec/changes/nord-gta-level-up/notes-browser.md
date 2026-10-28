# Browser notes: graded wheel, Auto gas and combat buttons

Scope: `games/nord-unreal/Browser/` only. The phone sends input through the same data channel messages as before. The only new transport use is `MouseDown`/`MouseUp` for Aim. The browser does not change any native code.

## What changed

### Graded steering (`touch-controls.js`)
- The wheel sends three steering levels on each side instead of digital A/D. `gradedLevel(value, previous, edges)` turns a deflection into a signed level. `steerKeys` maps each level to a key:

  | Level | Deflection (share of the wheel's reach) | Key | JavaScript code | `MoveRight` |
  |---|---|---|---|---|
  | ±1 | 0.18 to 0.45 | NumPadOne / NumPadFour | 97 / 100 | ∓0.33 / +0.33 |
  | ±2 | 0.45 to 0.75 | NumPadTwo / NumPadFive | 98 / 101 | ∓0.66 / +0.66 |
  | ±3 | 0.75 and more | A / D | 65 / 68 | ∓1 / +1 |

- Hysteresis: a level stays engaged until the thumb comes back 0.06 below its edge (`holdMargin`). The pedals use the same rule: W or S engages at 0.28 and holds down to 0.22. Crossing the centre resets the level.
- Reach: drags are measured over 1.4× the drawn radius (`wheelReach`). On the 112 px wheel, level 1 starts about 14 px from the centre, level 2 about 35 px and full lock about 59 px. The old digital edge was 10 px. The centre of a drawn Left/Right button gives the 0.33 level; drag past the wheel's edge for full lock.
- At most one steering key is held at a time. `syncKeys` keeps the wheel's key and drops a keyboard-style Left/Right pulse while the wheel steers. Key-ups are sent before key-downs, so two steering keys are never held at once, even during a level change.
- Every existing release path clears steering and recentres the wheel: lift, cancel, lost capture, blur, resize, orientation change, pagehide, hidden tab, the menu, disconnect and changing mode. The wheel shows its current level in `data-steer`, which is removed on release.

### Key path through the Pixel Streaming frontend (checked in `node_modules/@epicgames-ps/lib-pixelstreamingfrontend-ue5.8` 0.1.2)
- `touch-controls.js` calls `stream.toStreamerHandlers.get('KeyDown')([code, 0])`. `WebRtcPlayer/WebRtcPlayerController.js:262-263` registers KeyDown and KeyUp as plain forwarders to `SendMessageController.sendMessageToStreamer`. That function only checks the payload length against the declared structure and does not filter key codes. `UeInstanceMessage/StreamMessageController.js:76-84` defines KeyDown as id 60 `['uint8','uint8']` and KeyUp as id 61 `['uint8']`, so codes 97–101 pass unchanged.
- The frontend's own desktop keyboard path (`Inputs/KeyboardController.js`) drops only falsy codes and 229 (IME). `Inputs/KeyCodes.js:89-93` maps `Numpad1`…`Numpad5` to 97…101, the same codes a real numpad sends. `SuppressBrowserKeys` affects only F1–F12 and Tab.
- The host filters only Tilde (`-PixelStreamingKeyFilter=Tilde`, `Scripts/browser_streaming.py:187`).
- **Unverified (engine source not in this repo):** the PS2 input handler's JavaScript key-code table maps 96–105 to `EKeys::NumPadZero…NumPadNine`. `Config/DefaultInput.ini` already has the four graded `MoveRight` mappings (DRIVE). The live `mobile.test.mjs` now waits for a 97 packet and then a 65 packet on the real data channel, but only a host run shows whether the car turns at a third of full lock.

### Auto gas
- `#touch-auto` is a small "Auto / Gas" toggle that appears only while driving, beside Gas: above it on an upright phone, to its left on a phone held sideways. It is off by default. While on, it holds W. Any brake input turns it off: the Brake button, pulling the wheel down, or a keyboard-style Brake click. Tapping Auto again also turns it off. Every release path turns it off as well (menu, blur, resize, rotation, pagehide, hidden tab, disconnect, leaving the car), and it never comes back by itself.
- The toggle reacts on `pointerdown`, so a second finger can flip it while the first one steers. A keyboard or switch click (`detail 0`) also toggles it, and the tap's own click does not toggle it a second time. `aria-pressed` shows its state, and Gas lights up as held.
- Side effect: browser `resize` events still call `releaseAll`. Outside fullscreen, a phone's address bar can fire them, which also turns Auto off. This was kept on purpose: releasing is the safe failure.

### Combat buttons (on foot)
- `.touch-combat` holds Weapon (`data-key="81"`, Q, taps cycle the weapon), Aim (`data-mouse="2"`, holds the right mouse button) and Fire (`data-key="70"`, F, held for automatic fire). The row is hidden while driving. It stays visible while swimming, because the server ignores fire there.
- Aim support: the frontend registers a `MouseDown`/`MouseUp` handler for the streamer whatever the input flags are (`WebRtcPlayerController.js:267-268`, id 72/73 `['uint8','uint16','uint16']`). Aim therefore sends `MouseEnter`, then `MouseDown [2, 32768, 32768]` (right button, at the centre of the view, where look drags also put the cursor), and `MouseUp [2, 32768, 32768]` on release. Button 2 follows the frontend's own `MouseButton.secondaryButton`.
- Dragging a held Fire or Aim turns the camera, like every other held action on foot. Fire, Aim and Weapon release on every release path. Menu, Exit, Jump/Stroke, Use (E) and the sprint latch behave as before.
- The footer keyboard legend now lists F Fire, Right-click Aim and Q Weapon.

### Layout (`styles.css`, `index.html`)
- The 2×2 action grid (Sprint/Gas, Jump/Brake, Use/Exit, Menu) is unchanged. `.touch-primary` still holds exactly four buttons.
- Upright phone: the combat row sits 10 px above the grid, against the right edge. Its size is `clamp(44px, 40dvh − grid − bottom inset − 10px, 56px)`, so its top stays inside the bottom 40% that the tall HUD keeps clear (`ControlsTop = .6H`). The size is 49 px at 320×568, 53 px at 375×667 and 56 px from 390×844 up.
- Sideways phone: the combat row and Auto sit left of the grid at 52 px (Auto 52×44). The row's bottom is at `14dvh + 8px`, above the speed and prompt text, whose tops are at most 100/720 of the frame height.
- `steering-layout.test.mjs` checks these positions against the native HUD rectangles copied from `mobile.test.mjs` (briefing, identity, radar and credits, objective, speed, prompt, completion) at 568×320, 667×375, 800×360, 844×390 and 1280×720, and against the 60% line at 320×568, 360×640, 375×667 and 390×844.

## Tests run in the container
- `cd games/nord-unreal/Browser && npm ci && npm test`: 66/66 passed before the change and **75/75** after. The 9 new tests cover level edges, hysteresis bands, stepping through levels with jitter and the single-key invariant, release on 12 interruption paths, a Left pulse while the wheel steers, Auto gas, Auto gas release paths, the combat buttons, and Aim/Fire release with keyboard pulses. Five existing wheel tests now expect graded keys.
- Browser tests use Chromium 1194 from `/opt/pw-browsers` and Playwright 1.51.1, installed in the session scratchpad. The repository's `qa/browser/node_modules` was not installed, so the shared checkout stays untouched.
  - `steering-layout.test.mjs` (run from a scratch copy whose only change is the Playwright import path; it now also loads `menu.css`, so opening the menu no longer scrolls the bare test page): **passed** at 9 viewports. It checks the graded drag `[97↓, 97↑, 100↓, 100↑]` across the drawn buttons, full lock `[68↓, 68↑, 65↓, 65↑]`, an Auto click pair, 44 px targets, labels fitting, no overlaps, HUD clearance and screenshots in `.qa/combat-*` and `.qa/steering-*`.
  - `NORD_PLAYWRIGHT_PATH=… NORD_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node browser.test.mjs`: **passed**. New assertions cover the combat row on a 390×844 phone and the install reminder and crew list clearing the row.
- `mobile.test.mjs` and `live.test.mjs` need the host and were **not run**. `mobile.test.mjs` now expects 97 at the Left button centre and 65 after a drag to full lock. It adds an Auto gas check (tap Auto, then W held; Brake, then W released and Auto off) and a combat check (Aim sends MouseDown with button 2, Fire sends F, Weapon tap sends Q). Its layout, fullscreen-HUD and portrait-42% checks include the new controls.

## Phone and host checks still needed
1. On the host, with DRIVE's ini and COMBAT's bindings built: a 97/98/100/101 packet turns the car at a third or two thirds of full lock, for Player 1 (listen server) and Player 2 (client via `ServerSetDrive`). Run `npm run test:mobile` against a free Friend slot.
2. A right-mouse `MouseDown` from Pixel Streaming reaches `RightMouseButton` → `Aim` under `CapturePermanently_IncludingInitialMouseDown`, without leaving the cursor captured or breaking look drags. If it does not, COMBAT can add a keyboard alias for Aim (for example G) and the browser can switch Aim to `data-key`.
3. F reaches `Fire` and Q reaches `NextWeapon`. COMBAT owns those mappings; they were not yet in `Config/DefaultInput.ini` when this was written.
4. On a physical phone (iOS Safari and Android Chrome) under real stream lag: whether the graded wheel is easier to drive than digital A/D, whether 1.4× reach and 0.06 hold feel right, whether Auto can be tapped with a second finger while steering, and whether the combat row is reachable and comfortable to hold while dragging to look. Also check the bottom safe area on devices with a home indicator.
5. In fullscreen landscape on a phone: the combat row and Auto leave the real HUD clear, including the new status column and banners that JOBS draws.

## For the lead
- `proposal.md` says "The phone wheel sends analog steering". `design.md` and this implementation use **graded** steering (three key levels per side, no analog transport). The proposal wording may need to match.
- `specs/nord-mobile-driving/` in this change is empty. Scenarios the browser now meets:
  - **Graded drag steering:** WHEN a driver drags the wheel 0.18, 0.45 or 0.75 of its reach to one side, THEN that side steers at a third, two thirds or full lock, with exactly one steering input held; a thumb resting within 0.06 below an edge keeps its level.
  - **Auto gas:** WHEN a driver turns Auto on, THEN Gas stays held without a finger until Brake is touched, the wheel is pulled down, Auto is tapped again, or any release path runs; Auto starts off and never turns itself back on.
  - **Combat buttons on foot:** WHEN a walking player holds Fire or Aim or taps Weapon, THEN the game receives F, the right mouse button or Q; the buttons hide in a car, fit 320/390 portrait and landscape at 44 px or more, stay in the bottom 40% upright, and clear the speed, prompt, objective and radar text sideways.
- The canonical `nord-camera-touch` requirement "Playable phone action buttons" still holds for the four grid buttons. It may want an added clause about the combat row beside the grid.
