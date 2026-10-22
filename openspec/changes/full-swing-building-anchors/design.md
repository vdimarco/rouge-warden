# Design

Reuse playerEasy building search and canHang validation. Return no target when no real surface qualifies. All three callers already handle missing targets through existing dry-fire/no-building feedback. Physics easyAnchor remains a search primitive, and XR/phone aimed paths remain unchanged. No rendering technique introduced.

Use the visible building lock-on when the automatic samples miss. Where the existing assisted-clearance test cannot hang at true distance, retain the real surface and use ordinary rope physics (easy=false), avoiding a ground-clearance snap without forbidding real targets. No physics tuning or new ceiling.
