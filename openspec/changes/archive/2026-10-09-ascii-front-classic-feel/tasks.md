# Tasks
- [x] Tune enemy pacing, roster, firing and targeting with meaningful regression checks
- [x] Make stars reliably available nearby and preserve the three weapon benefits
- [x] Implement cardinal default controls and classic campaign continuation
- [x] Update help, upgrade feedback and musical rank cue
- [x] Verify engine/audio/rendering, browser flows and packaged build
- [x] Validate/archive specifications and prepare the verified Warden release

Validation: all 35 source tests and both production builds pass. Static Arcade integration covers all 33 cabinet/catalog pairs. Browser checks cover keyboard and quick touch input, all three rank notices, campaign continuation/armor repair and Endless choices in the actual-component fixture, plus packaged co-op and Arcade/music pause with no console errors. Independent checks cover 140 early-star placements and 105 map/lane siege routes. Idle HQ loss median improved from 5.90 to 22.06 seconds across 50 seeds. Physical phone audio/performance and full human campaign balance remain unchecked.
