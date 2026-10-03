# Design

Reference: supplied image.png, 1536x1024. The panel occupies about 83% of width and 75% of height. A dark teal panel, fine gold frame, cream serif text, painted spell thumbnails and a large selected effect define the design. Desktop has four rows at left, detail at right and a footer. Match the illustrated effect inventory for every hero with a 2x2 atlas ordered Q/E/C/R. Render atlas quadrants through CSS without slicing assets. Body text and buttons use Georgia. Extra combo and upgrade notes remain available through a disclosure.

Use a bounded dialog grid with header and footer outside the scroll area. Short desktop viewports reduce artwork and spacing. Portrait phones stack choices over details and permit vertical scrolling inside the bounded panel. Safe areas and dynamic viewport height constrain the panel. Other sheets must clear the spellbook class when opened.

A separate 36px HUD plus button sits beside each cast button. It calls the same guarded trainSkill rule, spends exactly one eligible point, refreshes rank and point UI, and does not open a modal or cast. Hidden or unavailable plus controls cannot spend a point. Casting stays on Q/E/C/R; K opens the book.

## Verification and reference review

Both skills.test.mjs and legends.test.mjs pass for twelve heroes and 48 spells. main.js and spellbook.js parse; git diff --check passes. All twelve atlases were visually reviewed for hero identity and four action scenes.

Cloud Chrome preview at 1363x936: panel bounds x109 y66, width1145 height805, close control, learn action and footer all inside viewport; body scrollWidth1363; detail clientHeight519 and scrollHeight519 in the first spell state. Back to hunt then Tailbreaker HUD plus gives rank1, spends the sole point, hides all plus controls, keeps the hunt visible and leaves the learned move off cooldown. Earlier Undertow plus check also passed. Inspecting the ultimate keeps the point and shows level6 lock. Market opens with class market after the spellbook and is within viewport. No game-origin console warnings/errors or framework overlays. Browser plugin unavailable; supported CUA browser used. Phone viewports and physical touch remain untested because this browser exposes no resize API. OpenSpec CLI unavailable; Markdown requirement/scenario structure reviewed directly.

Five-point fidelity review against supplied image:
- Layout: four left rows, selected detail right, pinned header/footer. Taller desktop panel deliberately keeps rank track and action visible at 1363x936.
- Typography: cream Georgia headings/body, title-case gold action.
- Color/frame: ink teal background, thin gold outline, teal selected row.
- Artwork: painted tiles and selected effect plus Nessie side-profile portrait. Effect is square with a fading edge rather than the reference wide illustration so all hero atlases remain reusable.
- Controls: skill point star, rank pips and level track, locked ultimate, learn action and hunt footer. Extra rank/combo details are available in a disclosure to preserve space.
