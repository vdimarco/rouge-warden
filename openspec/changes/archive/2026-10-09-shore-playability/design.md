# Design

Separate manual target selection from pursuit. Movement ends pursuit but retains a visible living target; explicit stop, lost sight, death and Recall clear it. Existing automatic attacks remain the fallback without a selected target.

Use a compact contextual guide rather than opening the full spellbook at match start. The selected hero and chosen difficulty remain under player control. Default new players to Apprentice, remember their hero, and offer a direct start while keeping the full draft available.

Keep Recall reachable beside utility controls with progress and an explicit cancel action. Preserve its 2.5 second channel and movement/damage interruption. Show attack state and mana information on phones. Cast rejection feedback uses the existing status region and never blocks movement.

Derive lane guidance from distance to lane paths, with hysteresis near shared segments. Do not modify a hero's simulation lane assignment.

Telemetry uses anonymous match IDs and only transitions or explicit actions. It remains optional, does not block play, and distinguishes production from local/preview sessions. Replay access remains limited by the connected PostHog permissions; do not claim any recording was watched.

Verify simulation scenarios with Node and native pointer/keyboard interactions in SwiftShader Chromium at desktop, portrait and landscape sizes. Inspect screenshots. Physical phone testing is unavailable.
