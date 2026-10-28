# A shoulder the aim pose already had

No shading paper fits a gameplay camera. The offset is the one aiming already uses: 70 cm to the figure's right (`CombatAimSocketOffset`). Idle was centered, so entering aim slid the whole street sideways. Sharing that Y keeps aim as a push-in and a small lift.

The framing test projects the capsule ends, 96 cm above and below the actor, through a 90 degree horizontal view at 16:9 and 9:20. It requires each end in front of the camera and inside 0.95 of the frame, and it locks pitch to −25..−5. A Python port of that projection puts the 70 cm shoulder at 0.729. 90 cm reaches 0.937, against the 0.95 limit, so the offset stays at 70. The car socket stays `(0, 0, 80)`.
