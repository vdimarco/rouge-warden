# Reuse the rope target reconciliation map
The recurring action frame creates a temporary Map for desired rope targets every call. Reuse one private map, clearing it before each reconciliation; preserve target identity, chest positions and removal behavior.
