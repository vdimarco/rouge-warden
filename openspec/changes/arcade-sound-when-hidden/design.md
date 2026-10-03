# Design

**One script, loaded first.** `quiet.js` wraps `AudioContext` and `webkitAudioContext` before any game code runs, so every context a page makes is known. It also wraps `HTMLMediaElement.play`.

**On hide** (`visibilitychange`, `pagehide`, `freeze`) it suspends every running context, pauses every audible `<audio>` and `<video>`, cancels speech, and asks each SoundCloud player to pause. It remembers what it stopped. While the page is hidden, `resume()` and `play()` do nothing and return a resolved promise. A page that asks for sound while hidden gets it when the page is visible again.

**On show** (`visibilitychange`, `pageshow`, `resume`) it starts only what it stopped. A context that the game suspended on its own stays the game's. A context in the iOS `interrupted` state is resumed.

**Muted media is left alone.** The tutorial clips in Down the Drain, Get Plunger'd and Reel It In are muted, so pausing them would only start them again later.

**SoundCloud.** The songs play inside an iframe that no script of ours can reach. SoundCloud's own script, `SC.Widget(iframe)`, returns the page's own widget, so the guard pauses and plays it. A game can start a song again while hidden, and SoundCloud's script can load late on a slow phone. While the page is hidden the guard asks every second, from the first hide, even when the script is not there yet.

**The VR page.** A headset browser may report the page as hidden during an immersive session, so `quiet.js` stays out. In flat mode on a phone, the page's own `visibilitychange` handler suspends and resumes `audio`.

**Safe by design.** The script never throws and never logs. It works when `AudioContext` does not exist. A second copy does nothing. `window.__quiet` is read-only and exists for tests.

**Test.** `qa/arcade/quiet.mjs` has four parts: a scan of the pages, unit pages for the script, the game pages started the way a player starts them, and a silent-page check. It hides pages four ways: a page-level `visibilitychange`, `pagehide` then `pageshow`, a second tab on top (plain Chromium over CDP), and a page freeze.
