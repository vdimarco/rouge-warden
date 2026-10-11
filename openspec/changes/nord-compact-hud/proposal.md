# Compact GTA-inspired NORD HUD

The user rejects the current HUD and asks for a more GTA-inspired presentation. The native game currently reserves large permanent panels for the mission, story briefing, title and keyboard legend. Replace that visual bulk with an original compact layout that leaves the action visible and reports only implemented game state.

## Scope

- Restyle the shared native HUD for the integrated Warden game: a compact player-centered road radar, small crew/online identity, concise objective and status, contextual actions, corner speed readout and a brief centered gold completion banner.
- Show story briefing briefly on initial presentation and when its phase changes; keep active private dialogue, interaction errors and save warnings readable.
- Retain brief jump, acceleration and handbrake sound words in comic view only, using the existing local comic-style getter.
- Preserve campaign and legacy objective presentation, car interaction priority, both geographic credits, controls and shared progress. Keep the existing R recovery control discoverable during an unfinished campaign even when alignment feedback or a save warning occupies the status row.
- Check actual native presentation at 1280×720 and 1920×1080 and decoded browser video in phone-emulated layouts.

No map, character, car, gameplay progression, input binding or project configuration changes are required. This change adds no health, armour, currency, wanted level or unsupported mission features. Existing trailer footage and Arcade navigation are outside this HUD change.

## Acceptance

The implemented HUD must keep the player and immediate action unobstructed, preserve the existing feedback priorities and render without overlapping text, controls or credits in the tested states. Source checks and screenshot creation alone do not establish readability. Physical phone use, audible sound and handling enjoyment remain separate manual checks.
