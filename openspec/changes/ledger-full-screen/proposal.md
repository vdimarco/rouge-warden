# Warden's Ledger uses the whole screen

## Why

On a wide monitor Warden's Ledger sat in a 1400 pixel column with empty leather on each side, and the page scrolled for two or three screens. The player asked for the game to be full screen.

## What changes

- On a wide window the ledger fills the window, edge to edge. The header stays at the top. The board, the receipts and the agents share the rest of the window, and each scrolls by itself.
- A wide board shows the day's tasks side by side.
- Next delivery and Close the day stay in reach at the bottom of the board. A delivery brings the board back to its top, where the check shows.
- The two Start buttons put the browser in its full screen mode. A Full screen button in the header turns the mode on and off, and the game keeps that choice.
- Esc on the day's summary starts the next day. Before, it closed the summary and left the closed day with no way forward.

## Not in this change

- The phone layout. On a narrow screen the page keeps its tabs and its scrolling page.
- Safari on an iPhone has no full screen mode for pages. The button stays hidden there.

## Impact

`public/ledger/style.css`, `public/ledger/app.js`, `public/ledger/index.html`, `qa/ledger/smoke.e2e.mjs`.
