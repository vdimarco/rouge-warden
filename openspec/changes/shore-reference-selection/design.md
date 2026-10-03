# Design

Source: user attachment 1791037690586.png, 1536x864. The left panel is 32% of the viewport width and begins at 20.7% of its height. Its four-column roster contains sixteen framed cards. The header is 67px high. Hero details occupy the rightmost 27%, starting near y331. The scene carries a large hero in the center. The lower right Play action is approximately 428x45 at x1088,y762. The footer begins near y771.

Build native DOM controls over clean source-matched artwork. Use the supplied portrait art as precisely positioned source assets and generate separate stage art as needed. Keep the gold wordmark distinct from cream display text, with thin pale-blue panel edges and cyan active glows.

Hero identity is separate from the numeric combat archetype. This avoids changing deterministic spell dispatch, mana arrays, warnings and bot logic for a visual request. The sixteen names use existing tested archetypes; display names and artwork follow the selected identity through play. Skill descriptions and numeric details come from the actual kit. Use the existing Q/E/C/R controls consistently in the screen and game.

At desktop, show the full four-by-four roster. On short landscape, retain the left roster and right detail with compact controls and roster-only scroll. On portrait phones, show selected hero/details above a compact four-column roster; allow contained roster travel while keeping the Play action visible. Respect safe areas and reduced motion.
