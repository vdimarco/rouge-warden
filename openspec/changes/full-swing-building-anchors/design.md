# Design

Reuse playerEasy building search and canHang validation. Return no target when no real surface qualifies. All three callers already handle missing targets through existing dry-fire/no-building feedback. Physics easyAnchor remains a search primitive, and XR/phone aimed paths remain unchanged. No rendering technique introduced.
