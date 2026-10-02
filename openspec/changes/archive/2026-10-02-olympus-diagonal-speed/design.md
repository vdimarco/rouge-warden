# Movement compensation

Normalize the screen vector to at most one, then inverse-project it. Multiply isometric input by sqrt(2) × 0.84 to preserve the existing horizontal screen speed. Vertical and diagonal world velocities increase to compensate for ground compression. Top-down scale stays one. Derive walking intensity from projected velocity with the same scale so animation and dust thresholds follow joystick strength.

Check all eight keyboard directions and analog joystick strengths through timed engine ticks in both views, with Hermes upgrades and portrait, landscape, and desktop canvas sizes. Check actual keyboard and pointer controls in the deployed browser preview. Device touch testing is unavailable. Validate Markdown structure directly if the OpenSpec CLI is unavailable.
