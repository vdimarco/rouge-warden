# Design
Remove redundant back aliases from the camera toggle in photo context (keyboard and gamepad). Otherwise a held toggle creates a fresh back edge when the context changes. Ignore repeated keydown events for held keys so holding V cannot toggle repeatedly.
