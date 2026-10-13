# Design

Use 72–88 px round buttons with monochrome SVG action icons, 12 px spacing and a pressed face. Size follows viewport height so short landscape screens retain native HUD clearance. Raise the portrait crew list by the action grid height. Preserve the game, streaming profiles, key bindings and left stick; no new dependencies or native rebuild.

Check the existing browser suite and live mobile tests in portrait, landscape and narrow landscape; inspect screenshots and keep native HUD overlap assertions. Browser plugin not available; use the installed Playwright workflow. Physical phone feel remains unverified.
