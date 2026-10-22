# Freeze flat gameplay while its page is hidden

A controlled visibility probe showed the hero moving while document.hidden was true: flat input always reports visible, bypassing the existing hidden-session simulation guard. Reproduce a deterministic physics freeze/resume regression before applying the smallest visibility correction. Scope: flat input visibility, focused browser regression/CI, evidence and round log. No graphics expansion, saved-data change or claim that this fixes the affected Chrome session.
