# Design

## Two meanings of full screen

The request "make it fullscreen" can mean two things, and this change does both.

1. **The layout fills the window.** This is CSS only.
2. **The browser's full screen mode**, which hides the browser's bars. This is the Fullscreen API.

## The layout

The rule applies at 900 pixels wide or more and 560 pixels tall or more.

- `body` is a column as tall as the window (`100dvh`, with `100vh` first for older browsers) and does not scroll.
- `main` takes the rest of the height and the full width. The 1400 pixel cap is gone. The side column is `clamp(320px, 28vw, 560px)`, and the two side panes each get half of the height.
- Each pane has `overflow: auto` and `overscroll-behavior: contain`. The ruled-paper lines scroll with the text (`background-attachment: local`).
- The task list is a grid of columns at least 400 pixels wide: two columns at 1280, three at 1920, four at 2560.
- The actions row is `position: sticky` at the bottom of the board.
- At 900 to 1439 pixels wide the header's buttons have less padding, so the title, the wallet and five controls stay in one row at 1280.

A window under 560 pixels tall keeps the old scrolling page. With a fixed header the panes would be about 200 pixels tall there, which is too short to read a bid. A window under 900 pixels wide keeps the tabs and the scrolling page, as before.

When a delivery arrives, `deliverNext` sets the board's `scrollTop` to 0. The check shows at the top of the board, and the board can be scrolled down at that moment. On a narrow screen the board does not scroll by itself, so this line does nothing there.

## Full screen mode

Sources: the MDN Fullscreen API guide, and this repository's own `public/crimson/js/fullscreen.js` and `public/tidebreak/main.js`, which enter full screen on the first tap and keep an off switch. No rendering technique is added.

- A browser allows full screen only from a tap, a click or a key. The two Start buttons on the title sheet are the first such input, so they ask for it. A game opened with `?auto` has no such input and stays in the window until the player presses the button.
- The Full screen button (`#fs`) is in the header with `aria-pressed`. It saves the choice in `localStorage` as `ledger.fullscreen` (`on` or `off`). With `off`, Start stays in the window.
- Esc leaves full screen. That does not change the saved choice, so the next visit goes full screen again.
- The button is `hidden` unless the browser reports full screen for pages (`fullscreenEnabled` and `requestFullscreen`, or the `webkit` names). Safari on an iPhone reports none.
- The element is `document.documentElement`, so the title sheet, the summary sheet and the Switch game panel show in full screen.
- The On chain link opens another page, and a browser leaves full screen when the page changes.

## Esc on the summary

Esc closes a `<dialog>`. The summary's only control was Next day, so a summary closed with Esc left a closed day: no bid to hire, and both action buttons disabled. In full screen, Esc is also the key that leaves the mode, so a player is more likely to press it. The summary's `close` event now starts the next day when the day is still closed.

## Checks

`qa/ledger/smoke.e2e.mjs`:

- at 1280x800 and 1920x1080: the page does not scroll, the panes reach the window's edges within the 16 pixel margin, Next delivery is in view, the tasks sit in two columns (1280) or three or more (1920), and a delivery shows at the top of a board that was scrolled down
- at 1280x540: the page scrolls
- at 390 and 320: tabs, one pane, no sideways scroll, controls at least 44 pixels (as before)
- full screen: Start enters it, the button leaves it and saves `off`, Start then stays in the window, the button enters it and saves `on`; with no full screen in the browser the button is not shown and the game starts
- Esc on the summary starts the next day
