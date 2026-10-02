# Design

Dark ink surfaces, cream text, muted gold rules and a hero accent preserve the painted folklore arena. Skill selection uses a four-row list next to a selected spell detail on desktop; phones stack the list and detail with a reachable footer. Rank steps show level requirements, current state and the next cooldown. The ultimate has a distinct lock and level 6/12/18 gates. Selection never spends a point; the explicit Learn or Upgrade button does.

Hero data and spell definitions drive roster, training, HUD and bots. New deterministic spells use shared cone, area, status and zone rules with hero-specific combinations. New hero art uses generated transparent cutouts and motion transforms; original heroes retain their directional attack art. Reuse the four existing item builds by assigning a suitable build to each hero.

Validation: all twelve hero starts, finite coordinates, rank rules, each new hero combination, full seeded matches, existing game suites, screenshot and browser flow. Native touch and audio testing are separate checks.

Concept: generated_images/exec-8b138ff8-e088-43de-b203-144f6235e3bb.png (outside source). Implement its wide two-column spellbook, gold point count, selected mint row, rank track, explicit gold action and footer. Use Georgia for display headings and the game's Barlow for labels and body. Keep existing crisp SVG spell glyphs as requested in the brief; use hero art and the glyph in the move preview instead of generating four raster spell icons for each kit. Mobile stacks these components and keeps the action reachable.
