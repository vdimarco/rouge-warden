# Full-screen clear suppression: pending full measurements

Disable automatic clears only while drawing complete opaque full-screen bloom triangles. Scene clears and caller autoClear are preserved, including failure restoration. No resolution, image, art, physics, building-anchor or height changes.

Two30s/15inputfixedUVsixdrawprobes:GPU22.67→20.16ms and20.99→20.32ms; FPS32.72→36.10 and35.97→36.58,inputp9533.5→31.6ms and31.0→26.0ms. Preliminary isolated capacity only, not normalgame/affectedChrome acceptance. Full3matchednormal/pressurepairs60s35inputs running; not mergeable until evidence/review/CI/currentpreview/rebase gates.

Functional15checks pass:8same-frameRGBA comparisons across desktop/phone layouts with real variedpixels and active/inactive sun/effect modes, pathcoverage, fourautoClear true/false/error restoration cases andnoerrors. Initialfailureinjectionfixture left render target dirty and producedfeedbackwarning; correctedfixture restores its target between injections. This does not suppress errors. Hardware versions/fullbeforeafterimages pending.

No current aesthetic or performance score increase. AffectedChrome120Hzprofile unverified; response/stability scores andcurrenttotalwithheld.

## Decision: reject production change

All42full60s/35inputworkloads completed with no inactive frames/errors. Normal comparisons retain60FPS; original pressurepair2 regresses whilepairs1/3 improve. Same-browser counterbalanced follow-up baselineFPS26.08/25.15/24.66 versuscandidate25.44/25.24/26.15; median25.15→25.44(~1.2%), too small to establish a reliable capacity improvement under shared load. Medianinput40.8→37.4ms improves, but individual samples overlap andabsoluteFPS/tailtargets fail. This does not establish the initial pressure regression as causal, nor justify a performance release. Candidate is rejected, not merged to create activity.

Fullraw/manifests/tables and identical inspected cityimages retained here. All6CI/review/deployed15checks/exactbytes passed, but that does not replace performance evidence. Main retains originalclear behavior. No graphics, physics, anchor, height or quality change reachesproduction. No currentscoreincrease; userChrome report remainsopen.
