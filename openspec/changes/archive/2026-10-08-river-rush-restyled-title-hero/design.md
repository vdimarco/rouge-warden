# Design

Use wide generated illustration with the character and raft on the right and quieter dark jungle on the left. Supply a local versioned WebP, eagerly loaded through the Vite base URL. Desktop puts live title and controls on the left; phones show a right-biased crop above controls. A dark base and gradients keep controls readable even if the art cannot load.

Menu stops mounting the old looping video, which could cover the new art. Gameplay preload/readiness, controls, rendering and audio remain unchanged. The still works with reduced-motion and data-saving preferences.

Initial layout review accepted all hero crops but found landscape Start just below the viewport. A landscape-only compact heading and tighter spacing bring the whole Start button into the initial screen; phone and desktop styling remain unchanged.

Verify the built route at 1365×900, 390×844 and 844×390, then use real Start, Help and Leaderboard actions and an image-load failure. Build the arcade copy, publish exact committed files and compare production HTML, bundles and hero bytes. Review canonical spec and archive after publication. OpenSpec CLI is unavailable; inspect Markdown delta structure manually.
