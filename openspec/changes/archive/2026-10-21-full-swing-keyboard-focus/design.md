# Design
Use one CSS override in the existing shared flat UI stylesheet for `.fs-menu .btn:focus-visible`. Reuse `--ink` and the existing 4px outline/3px offset. The title keeps its light outline on a dark background. No rendering technique or new dependency is involved.

Verify with real Tab input at desktop and narrow portrait widths. Check that focus moves, the focused control has a visible outline with at least 3:1 contrast against the panel paper, and the outline remains inside the viewport. Capture before/after states. Existing layout checks cover panel geometry.
