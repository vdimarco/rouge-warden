# Design

Reference: supplied image.png, 1536x1024. The panel occupies about 83% of width and 75% of height. A dark teal panel, fine gold frame, cream serif text, painted spell thumbnails and a large selected effect define the design. Desktop has four rows at left, detail at right and a footer. Match the illustrated effect inventory for every hero with a 2x2 atlas ordered Q/E/C/R. Render atlas quadrants through CSS without slicing assets. Body text and buttons use Georgia. Extra combo and upgrade notes remain available through a disclosure.

Use a bounded dialog grid with header and footer outside the scroll area. Short desktop viewports reduce artwork and spacing. Portrait phones stack choices over details and permit vertical scrolling inside the bounded panel. Safe areas and dynamic viewport height constrain the panel. Other sheets must clear the spellbook class when opened.

A separate 36px HUD plus button sits beside each cast button. It calls the same guarded trainSkill rule, spends exactly one eligible point, refreshes rank and point UI, and does not open a modal or cast. Hidden or unavailable plus controls cannot spend a point. Casting stays on Q/E/C/R; K opens the book.
