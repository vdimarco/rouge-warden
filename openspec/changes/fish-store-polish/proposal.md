# Reel It In: polish and store release

## Why

The owner asked for a last pass on Reel It In: easier to play, more fun, more polish, and ready for the Apple App Store and Google Play. An audit of eight areas (first run and menus, the cast, the fight, progression, feedback, loading and performance, accessibility, store readiness) found these problems:

- The game does not start with no network. three.js and the fonts come from CDNs, and the screen stays blank blue. Nothing shows while the game loads.
- The game carries the web arcade: "Switch game", "Back to the arcade", the "GET PLUNGER'D" kicker, the arcade icon, and copy about Safari and site settings. The Android back button would close the app from any screen. All progress lives in web storage that the phone can clear.
- Touch casts depend on things the player cannot see: the exact lift height and the gap before the finger lifts. A natural flick often slams the lure 3 to 5 m out. Presses on the visible rod do nothing.
- In a fight, cranking can snap the line 0.07 s after the drag starts to slip. Jumps throw the hook after the player lowers the rod. Legends are lost after TIRED shows. A head shake hides slack. The gauge words are 7 px, and the gauge uses colour alone.
- Nothing changes by day. After about 30 minutes at a place, almost no catch earns a reward. After the trail, the title names no next goal.
- The hook set, the jump, the new place, and the derby end feel flat. iPhone players get no buzz.
- The animated guide is off for a new player. The title has 10 controls, and its main button starts a scored derby. How to play is a 16-step scroll.

## What changes

- **Boot:** three.js and the fonts ship with the game. A loading screen shows progress, and a clear card shows when the game cannot start. The render scale recovers after a hitch. A lost GL context pauses the game and recovers.
- **App shell:** a store build hides the arcade parts and uses app copy. Android back closes the top screen or pauses. A native bridge uses Capacitor plugins when they exist: haptics, app lifecycle, status bar, splash screen, keep awake, and a mirror of the save in native storage.
- **Casting:** touch and mouse casts are graded where the finger lifts. A flick that goes past the press point is forgiven. The touch area covers the whole lake, to its bottom edge. The early side of the motion window has no cliff. The cast gives feedback at the release and a preview of the distance.
- **Fight:** the drag gives before the line can break. Easy mode gives more time on a jump. A beaten fish stops making new moves. Slack shows on the gauge and in the prompt. Prompts do not flicker. Toasts do not sit under the reeling thumb. Gauge text is larger and has patterns as well as colours.
- **Goals:** a sure first bite, a goal assist for short casters, six goals at each place, a daily goal with a streak, a next-goal line, a rank ladder, and a sweet-cast streak.
- **Feedback:** a hook-set hit, a camera punch on jumps, tiered fanfares, a new-place stinger, a count-up on the derby total, splashes you can see at range, and fixes to two buzz bugs.
- **Menus and access:** "Go fishing" is the first button. The art picker moves to Settings, and the "Ghibli" style becomes "Painted". The guide shows for new players. How to play is short and opens on the right tab. Text size, calm effects, and a full left-handed mode are in Settings, with fixes for clipped and hard-to-reach controls.
- **Cutscenes:** four short, skippable cutscenes drawn in the game's own scene: the opening at Loon Lake, the arrival at each new place, a legend's first reveal, and a legend landed, with a finale after the last legend. The owner asked for these during the work.
- **Store package:** `apps/fish/` holds a Capacitor 8 project, a build script that makes a self-contained `www/`, the iOS and Android projects with portrait lock, icons, a splash screen, a privacy policy, and the store listing text.

## Scope

In scope: `public/fish/`, `qa/fish/`, the new `apps/fish/`, and the Reel It In part of `README.md`. The web arcade keeps its switcher and links. The art direction stays the same, and the motion rod stays the main control, with touch as the other choice.

Out of scope: new species, new places, lure or gear choices (they change the balance of every sim and need new art), online features, accounts, and ads. Signing, uploads, and store submissions need the owner's developer accounts.

## Owner decisions, with the default this change uses

- Store name and bundle ID. "Reel It In" is already taken on both stores. Default: the store name "Reel It In: Lake Fishing", the name "Reel It In" under the icon, and the placeholder ID `com.cottagearcade.reelitin`. Change the ID to a domain the owner controls before the first upload, because it cannot change later.
- Devices. Default: iPhone only from iOS 16.4, Android from version 7 (API 24), portrait only, free, with no ads and no purchases.
- The "Ghibli" art style. Default: it becomes "Painted" on screen, in its stored value, and in its file names, because a store app must not use another studio's trademark. Old saves keep their look.
- Touch play. Default: the crank goes on the left, so the right thumb works the rod.
- Gentle music. Default: none. The game keeps its sound beds and adds short stingers.
