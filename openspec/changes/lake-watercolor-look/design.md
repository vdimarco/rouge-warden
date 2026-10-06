# Design

## One pass, one uniform

All watercolour stages live in the existing final pass, behind the uniform `uWash` (1 = Watercolor, 0 = Bright). No new render target or draw call is added. Bright with `uWash = 0` gives the same picture as before the change.

## Stages

1. **Wobble.** The brush samples the scene at an offset of up to 1.5 pixels along slow screen-space noise. The noise is fixed to the screen, so it does not crawl.
2. **Warm haze.** Far haze moves 55% of the way from cool blue to a warm grey.
3. **Wet edges.** Four colour reads at 1.5 pixels give a luma edge value. Colour edges get up to 30% darker. The grass writes alpha 0, so grass blades get no wet edge, the same rule as the ink lines.
4. **Softer vignette.** The old dark vignette is 12 points lighter, because the paper border now frames the screen.
5. **Paper (after the display transform).** Granulation darkens dark paint more in the paper hollows. Saturation drops by 10%. The paper colour tints the paint and lifts shadows to sepia. A thin ragged border of bare paper, under 1% of the short side on average, has a darker rim inside it. At night the paper dims to 14%.

The paper stages run after the tone curve, so the paper keeps its cream colour (#f3ead6 in display terms) and does not go grey.

## Choice and storage

`plungerd.wild.paint` in localStorage stores `watercolor` or `bright`. The address option `?paint=` wins for one visit. `G.setPaint(name)` is the hook for QA scripts.

## Cost

Each pixel gets 4 more texture reads and about 8 value-noise calls. On the Low setting in the phone profile (`PERF_PHONE=1 node perf.mjs low`), draw calls and triangles do not change. SwiftShader frame times vary by more than the difference between Watercolor and Bright.
