# Shore of the Ancients hero selection

final result: passed

The final implementation at `c5c9fe2a6ea3b89a4dfcedf1eaf21ed15c89ec21` passed [browser run 60](https://github.com/vdimarco/rouge-warden/actions/runs/37136817782), including all six viewports, every native hero caption, touch scrolling and the unit/simulation suites. Source and runtime full views were inspected together at 1536 × 864, followed by focused roster/details comparisons and all five responsive captures. No P0, P1 or P2 findings remain open. Illustration differences and minor optical polish are recorded below.

## Comparison target and evidence

Source visual truth: `public/tidebreak/art/reference/reference-source.png`, the unmodified user-supplied screenshot (1536 × 864 pixels). The original attachment is `/workspace/scratch/cc0e3ad677cc/upload/01-1791037690586.png`.

Implementation: `/tidebreak/`, default Tidewarden selection, All role filter, Rising Current inspected, no modal. Reference comparison uses a 1536 × 864 CSS viewport, deviceScaleFactor 1 and a 1536 × 864 screenshot. Both images contain app content without browser chrome. No density normalization or resizing is needed.

Evidence files are `docs/shore-selection-desktop.webp`, `docs/shore-selection-phone.webp`, `docs/shore-selection-small-phone.webp`, `docs/shore-selection-landscape.webp`, `docs/shore-selection-compact-desktop.webp` and `docs/shore-selection-short-desktop.webp`. These are full-size browser captures from run 60 encoded as WebP for the review; original PNG captures remain in the CI artifact. Focused source/runtime checks use the same roster window (490 × 563 at x=0, y=180) and details window (430 × 420 at x=1100, y=330). The exact reference-size layout is compared to the supplied desktop image. The responsive views are checked for containment, readability and interaction; no mobile reference was supplied.

Live browser verification uses the [branch preview](https://warden-git-codex-shore-reference-selection-vdimarcos-projects.vercel.app/tidebreak/). The cloud browser was inspected at 1363 × 936. Its viewport differs from the supplied reference; it verifies interactions and responsive rendering rather than claiming a pixel-for-pixel comparison.

## Findings and comparison history

- P1, composition: the previous screen used a horizontal character selector and lacked the reference's sixteen-portrait panel, fixed navigation, full-body stage and footer. Replaced it with the measured desktop regions, a four-column native-button roster and the complete supplied identities. Post-fix desktop evidence retains the reference's 32% roster width and complete four-by-four grid.
- P2, source imagery: generic role glyphs and portrait backgrounds drifted from the source, and portrait windows could include the original caption or stretch the face. Reused source-image windows for the exact wordmark, portraits, role glyphs, Tidewarden abilities, profile, title trident and arcade branding. Container-based cover calculations preserve the portrait aspect ratio, keep the original caption outside the crop and supply one native caption. All sixteen cards were inspected and clicked.
- P2, typography: description text and mismatched icon windows weakened the reference hierarchy. Cinzel supplies display type; Arial supplies small UI and descriptions; source-like condensed Barlow ability labels avoid wrapping into the note; Georgia supplies the italic hero note. Softened the wordmark crop edge and corrected the title trident window and background treatment. Reference-size full-view and focused comparisons confirm the corrected crop, description hierarchy and retained condensed skill labels.
- P2, skill layout: ability icons and key labels overlapped the note on short layouts. Adjusted preview width, spacing, label height and note position. Browser geometry checks now cover all four skill buttons, key labels and the note separately. An Arial skill-label experiment wrapped into the note at landscape width; retaining the source-like condensed label face resolves that measured overlap.
- P2, touch browsing: inherited horizontal touch behavior prevented a portrait swipe from scrolling a short roster. Set the track and cards to `touch-action: pan-y`; real touch events scroll the small-phone and landscape grids, and Home restores the first row.
- P2, keyboard and dialog state: arrows could use the last selection rather than the focused card, and tapped skills could show the wrong active slot. Navigation now derives its starting card from focus, and dialogs preserve the inspected slot. Added a menu-only Enter shortcut from the roster or background; other native controls retain their own Enter behavior. The live browser started Embersong from a focused card and trained Ember Flight.
- P2, responsive footer: the CTA and footer shortcuts overlapped on phones or exceeded landscape bounds. Reduced the compact CTA type and height, gave landscape shortcuts separate space, and anchored desktop shortcuts from the bottom. All six final captures and separate CTA/shortcut geometry checks pass, including 1536 × 700.
- P2, intermediate desktop: long names and header controls could exceed 1000–1199px widths. Compact the navigation, title, sigil and CTA at that range. The final run checks every one of the sixteen names for viewport containment and text overflow at six sizes. The 1000 × 700 capture also exposed clipped card captions and dense role text. Use 9px condensed Barlow captions and 8px role labels below 1200px, hide competing decorative text at 1000–1199px, and check every native caption for overflow.

## Required fidelity surfaces

- Fonts and typography: source wordmark and arcade type remain in their original raster assets. Cinzel's serif capitals, optical weight, scale and tracking reproduce the hero-title and navigation hierarchy. Arial keeps desktop captions, keys and body text readable; condensed Barlow keeps ability labels and compact captions legible; Georgia matches the italic description. All hero names and compact wrapping receive explicit overflow checks.
- Spacing and layout rhythm: desktop roster begins at 20.7% height, fills 32% width and retains four rows; the stage, right-side hero details, four abilities, note, fixed top navigation and footer follow the measured source proportions. Square portrait and ability frames, fine borders and cyan selection glow replace the previous card treatment. Phones stack the stage and roster; short phones and landscape permit contained vertical roster scrolling.
- Colors and visual tokens: navy translucent surfaces, pale cream display text, blue-gray body text, fine steel-blue borders and bright cyan selected states match the supplied palette. The sunset environment balances warm sky with cyan water and weapons. Focus has a visible outline; reduced-motion settings disable transitions.
- Image quality and asset fidelity: all sixteen portrait subjects and source branding are present. The clean scene and separate full-body illustrations were generated from the supplied art direction and inspected before use. WebP encoding reduces the shipped art to about 6.8 MB, retains the original dimensions and preserves every transparency value. There are no placeholder portraits or code-drawn replacements for the target's illustrations, branding or icons.
- Copy and content: names, subtitles, hero flavor, tags and decorative phrases follow the reference. Skills show the actual Q/E/C/R controls, descriptions, mana costs and cooldowns; profile displays the real saved match record. The reference's fixed level 42 and invented skill statistics are not copied into working controls.

## Constraints and remaining polish

The supplied still is the visual target. Its hero pose, cape details and environment are reconstructed as separate assets so selection and battle can change heroes. Those illustrations are not pixel-identical to the still. Sixteen identities use the twelve existing tested combat kits; this change does not introduce sixteen independently balanced kits. Mobile composition adapts the desktop source to the available screen.

P3 follow-up: refine individual generated poses, environment details, the white title-sigil optical weight and source-window seams if layered originals become available. Actual game controls, truthful skill text and real profile data are intentional functional differences.

## Verification

The browser scenarios exercise all sixteen hero selections and decoded art, six filters, focused-card arrows and Home/End, hover and tap inspection, F details, navigation, profile, settings, sound toggle, match start, training, movement, pause and resume. Small-phone and landscape runs dispatch native CDP touch events over portraits, verify vertical roster scrolling and return to the first row with Home. Run 60 passes at 1536 × 864, 390 × 844, 320 × 568, 844 × 390, 1000 × 700 and 1536 × 700. Every viewport passes the required geometry and caption checks, with no console, page or asset failures. The small-phone and landscape rosters scroll to reach rows outside the visible panel; the other sizes display every card at once. The touch tests use emulated devices in Chromium.

The identity suite verifies deterministic assignment, truthful skill inspection and unchanged combat behavior. Existing creature, basic-attack and roster suites pass, and 36 complete seeded matches verify replay, objectives and match completion. OpenSpec CLI is unavailable; scenario and delta-structure review was performed directly in Markdown and the completed change was archived. No physical-device frame-rate or audio-output measurement is claimed.

## Implementation checklist

- [x] Replace the previous selection with the complete reference composition.
- [x] Integrate source branding, all sixteen portraits and separate scene/hero art.
- [x] Carry the chosen identity into real battle and spell training.
- [x] Resolve the identified focus, skill, touch and footer issues.
- [x] Inspect the final full-view and focused comparisons after the last changes.
- [x] Confirm six-viewport browser and console checks and publish the final evidence.
