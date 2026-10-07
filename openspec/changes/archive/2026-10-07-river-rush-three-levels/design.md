# Design

One levels.js contract supplies map names, lengths, seeded course identity,
speed curves, spacing and palette. Engine creates a finite seeded stage,
reserves a 90m finish approach, and stops exactly at its length. Distinct
sequence motifs vary jump/duck barriers, slalom, mixed hazards and coin routes
without creating an impossible row or a required action faster than its
existing duration. Stage clocks/local statistics reset; campaign totals carry
through nextLevel, and current-level retry preserves prior cleared totals.

App shows a map selection with local unlocks, HUD level/distance-to-finish,
level completion with Next level, and final victory after the third map.
Wipeout retries the current level. New versioned adventure records prevent old
endless scores from dominating finite results. Modal, hidden and completed
states stop simulation and inputs. Touch dragging remains screen-wide.

Renderers visibly distinguish lush canopy, red rocky canyon and moonlit ruins
using map composition, prepared panoramas, palette and bounded shared props.
A visible finish gate shares the level's distance. Prepare all map materials
and image fallbacks before play, reusing resources across stage changes.
Texture failures, reduced motion and WebGL loss retain playable map variants.

Verify bots finish every map with realistic delayed actions across seeds;
check fairness, variety, bounded counts, cumulative stats, one-time completion,
retry, save validation and absence of rows past finish. Browser-play a full
three-stage flow, a wipeout/retry, pause/drag and map-specific screenshots on
phone/desktop/landscape, plus fallback/reduced-motion and preparation counters.
Do not infer physical GPU/phone FPS from emulated Chromium.

The three distances are 1,400 / 1,800 / 2,200 m, with one-time finish bonuses
of 1,000 / 2,000 / 3,000 points. Speed profiles start at 42 / 50 / 58 and cap
at 56 / 64 / 72. Best records use river-rush-adventure-best version 3; unlocks
use river-rush-progress version 1. Completed progress requires all maps unlocked.

Save score image draws a 1,200×1,600 PNG with cumulative score, coins, distance
and map clears independently of retained WebGL pixels. Gesture graphics show
lane swipes, up to jump and down to duck; help/menu/opening guides respect
reduced motion and never own pointer input.

The public board uses the existing Uptick Supabase project and an isolated
river_rush_scores table with anonymous read and column-limited insert policies.
No guest update/delete privilege is granted; ID/timestamp defaults are owned
by the database. The Vercel API uses a publishable key, a six-second upstream
deadline, bounded names/statistics and stable run UUIDs for retry idempotency.
The UI shows the top ten and posts only when a finished player explicitly
chooses a public display name. Scores are guest-submitted, not replay-attested.
Modern publishable credentials are server environment variables, never built
into the game. Shared-service failure is visible and retryable.

New canyon/ruins panoramas were generated with fal-ai/nano-banana-pro and
packed locally as WebP; request inputs/IDs/hashes are recorded in
games/river-rush/docs/adventure-art-sources.json.
