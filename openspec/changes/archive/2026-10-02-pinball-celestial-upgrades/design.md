# Design direction

Dark celestial navigation deck: navy-black glass, cool starlight, cream serif headings, warm brass rules and mint focus cues. Generate a matching text-free observatory cockpit background from the UI concept; retain the existing nebula as a fallback. The three modules form equal instrument bays on desktop, compact rows on portrait phones and three short columns in landscape. Each whole bay installs its module and starts the jump; no new confirmation step.

Allowed copy: JUMP GATE REACHED; Choose your upgrade.; Fit one module before the next jump.; current sector name; next sector name; Quick pulse; Your gravity pulse recharges 20% faster.; Hull repair; Restore one life and extend the launch shield.; Comet drive; Stronger pulses and 20% more points from relays.; Install & jump; Each choice lasts for this voyage.; 1, 2, 3 shortcut labels. Route names come from the existing run. Original upgrade data is the source of truth.

Module emblems are precise code-native orbital UI diagrams: a pulse wave, protective shield and comet. Their line weight, framing and muted glow must match. The cockpit background supplies the brass window frame and deep starfield. No paid Fal retry is part of this UI change.

Check all three choices by pointer and keyboard; installation applies once and starts the normal jump. Check focus, pause/resume after installation, reduced motion, keyboard hints, screen-reader names, screenshot fit at desktop, portrait, landscape and a small phone. Keep temporary QA scripts and screenshots outside committed source.

# Accepted concept and tokens

Concept: generated_images/exec-49e84fe2-844e-4ed9-8b42-884ce071a5b1.png (review image outside source). One dark glass console with double brass outline and clipped corners; three equal instrument bays; title and route rail above; permanence note below. Navy-black #031017, ivory #f5ecd8, brass #b79259, starlight #b9eada, muted #a7b8be. Georgia headings and module names, existing Avenir/Segoe sans body, monospace shortcut numerals. Desktop console roughly 1080px wide with 24px inner gutters; 42px title, 26px module names, 14px descriptions, 16px actions. Each bay has a 150px celestial line diagram and thin brass dividers. Mint outline on focus/hover. Portrait adapts into three horizontal instrument rows; compact landscape reduces art before text. A faint idle glow supports the spacecraft feel; reduced motion removes transitions. All diagram emblems and text remain code-native.

Implementation intentionally reduces the concept's heavy outer hardware and planet clutter through a separate cockpit asset with a quiet central viewport, keeping the functional console and screen edges readable.
