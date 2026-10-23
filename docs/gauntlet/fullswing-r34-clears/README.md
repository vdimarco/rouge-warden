# Full-screen clear suppression: pending full measurements

Disable automatic clears only while drawing complete opaque full-screen bloom triangles. Scene clears and caller autoClear are preserved, including failure restoration. No resolution, image, art, physics, building-anchor or height changes.

Two30s/15inputfixedUVsixdrawprobes:GPU22.67→20.16ms and20.99→20.32ms; FPS32.72→36.10 and35.97→36.58,inputp9533.5→31.6ms and31.0→26.0ms. Preliminary isolated capacity only, not normalgame/affectedChrome acceptance. Full3matchednormal/pressurepairs60s35inputs running; not mergeable until evidence/review/CI/currentpreview/rebase gates.

Functional15checks pass:8same-frameRGBA comparisons across desktop/phone layouts with real variedpixels and active/inactive sun/effect modes, pathcoverage, fourautoClear true/false/error restoration cases andnoerrors. Initialfailureinjectionfixture left render target dirty and producedfeedbackwarning; correctedfixture restores its target between injections. This does not suppress errors. Hardware versions/fullbeforeafterimages pending.

No current aesthetic or performance score increase. AffectedChrome120Hzprofile unverified; response/stability scores andcurrenttotalwithheld.
