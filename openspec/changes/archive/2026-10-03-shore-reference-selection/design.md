# Design

Source: user attachment 1791037690586.png, 1536x864. The left panel is 32% of the viewport width and begins at 20.7% of its height. Its four-column roster contains sixteen framed cards. The header is 67px high. Hero details occupy the rightmost 27%, starting near y331. The scene carries a large hero in the center. The lower right Play action is approximately 428x45 at x1088,y762. The footer begins near y771.

Build native DOM controls over clean source-matched artwork. Use the supplied portrait art as precisely positioned source assets and generate separate stage art as needed. Keep the gold wordmark distinct from cream display text, with thin pale-blue panel edges and cyan active glows.

Hero identity is separate from the numeric combat archetype. This avoids changing deterministic spell dispatch, mana arrays, warnings and bot logic for a visual request. The sixteen names use existing tested archetypes; display names and artwork follow the selected identity through play. Skill descriptions and numeric details come from the actual kit. Use the existing Q/E/C/R controls consistently in the screen and game.

At desktop, show the full four-by-four roster. On short landscape, retain the left roster and right detail with compact controls and roster-only scroll. On portrait phones, show selected hero/details above a compact four-column roster; allow contained roster travel while keeping the Play action visible. Respect safe areas and reduced motion.

## Implemented assets and identity rules

The static source atlas is `public/tidebreak/art/reference/reference-source.png`. Its portrait and logo regions provide the source-matched frames and wordmark. The scene and sixteen transparent stage sprites use optimized WebP files. Selection uses native buttons over this artwork; filters, skills, navigation and Play remain interactive.

`hero-identities.js` defines sixteen named identities. Each entity keeps its numeric combat `hero` index and adds an `identity` index for names and art. Bot identities are chosen deterministically from profiles that use the same combat kit, without consuming combat randomness. New battle art can fall back to the original kit art on a load failure. The spellbook uses the identity name while training, mana, cooldowns and level gates use the original kit.

The six reference filters are All, Carry, Bruiser, Mage, Support and Initiator. Arrow keys travel one card horizontally or four cards vertically; Home and End reach the first and last card. Vertical touch scrolling begins on the portrait or its button and stays inside the roster. Hover and focus update the description. A tap opens a readable skill panel with a return action. Q/E/C/R labels describe the existing combat controls.

## Validation method

Browser QA captures the initial screen after the selected art and fonts load. It checks actual portrait backgrounds, four columns, sixteen reachable identities, source art, filters, keyboard travel, hover, tap, menu panels and Start. Essential controls must fit without overlap; the cinematic stage art can extend outside its layout box. Compact-layout checks use native touch events that begin on a portrait and require the roster to scroll.

The requested comparison sizes are 1536x864, 390x844, 320x568 and 844x390. Final checks also cover the 1000px title breakpoint and short desktop/footer cases. The verification record distinguishes the completed four-viewport run from the final expanded run.
