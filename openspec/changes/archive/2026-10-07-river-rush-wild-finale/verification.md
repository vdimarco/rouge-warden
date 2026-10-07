Three 50% longer maps now escalate through open water, bends, whitewater chutes
and wild rapids. Substantial themed navigation gates mark the exact finish.
Every coin requires actual lateral and jump-height contact, including Rush and
Gold Boost. Gold Boost doubles touched coin points for eight seconds. Immediate
HUD rewards and small white score tokens distinguish collected coins from
coins still in the river.

The [verification record](../../../../games/river-rush/docs/wild-finale-verification.json)
contains the source, graphics, public deployment and storage evidence.

- All 88 source tests passed. At 30/60/120 Hz, 240 delayed-input campaigns cleared
  720 stages without required shield rescues, covering 3,888,000 m.
- A real App 3D campaign used normal controls to clear exactly 16,200 m, earning
  79,560 points and 528 coins, with 16 Rush activations and no state/clock edits
  or shield rescues. Its engine source matches the final presentation build.
- Final presentation checks separately covered all three actual App layouts,
  57 isolated contact cases, nine map/layout renderer combinations, four acts,
  120/45/0 m finish approaches, valid rich/simple/ground shaders, exact pause and
  reduced pixels, and unchanged GPU preparation. Act/gate samples stayed at
  or below 30 draw calls and 92,159 triangles in software rendering.
- White-token framebuffer measurements confirmed that score feedback shrinks
  as it approaches the HUD. No awarded coin remains in the golden world batch.
- All 36 isolated Hud label/map/layout states remained readable and separate
  from score capture, including a late distance goal.
- Production deployment `dpl_6JRS8uvexTFxZeLthtsHRcsfSB7W` served exact commit
  `d33cd0a4aea6a219a8620bf3c8e1c2f2154e97e7`; public HTML, JavaScript and CSS
  hashes matched the tested assets. Live phone, desktop and landscape controls,
  coin contact, immediate HUD updates, layouts and shaders passed.
- Public storage accepted the real 16,200 m score, deduplicated its UUID retry
  and rejected 16,201 m. An independent browser saw the public entry. Exactly
  that temporary QA row was removed; owner SQL and an independent public read
  verified cleanup. Historical score bounds/guest rights remain supported.

Physical device frame rates were not measured. Chromium/SwiftShader supplied
browser graphics checks; the rich water material was compiled separately.
The OpenSpec CLI was unavailable, so Markdown requirements/scenarios and
canonical reconciliation were checked directly. The completed change adds two
requirements and modifies five, leaving 43 unique canonical requirements.
