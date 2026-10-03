# Pathways and race design

## Rules that stay

Warming remains a stock with lag. Meters still pressure each other. `judge` still checks endings in the same order, and Hot Growth is still only the remainder. Effects and progress are clamped. Pathway rolls use the run RNG only when the player invests, so a run that never invests keeps the previous card and event sequence.

## Pathways

One pathway action is the turn. Progress is capped at 3: research, pilot, then scale. A stalled try still spends the cost. The breakthrough is a one-time meter change of at most 4 points, plus a bounded per-step effect:

- Aviation fuels and shipping fuels cut hard-to-abate emissions.
- Heavy industry lowers the industrial leak.
- Carbon removal cuts emissions and adds a small land-sink term inside `equilibrium`.
- Long-duration storage and grids raise how much owned clean supply counts. Either track alone leaves serve at 0.58. Both through pilot raise it, up to 1.

Quiet projections keep pathways already started. They do not buy future steps.

## Energy race

Each step computes a game index, not terawatt-hours. Demand rises with prosperity and with electrifying cards. Efficiency cards lower the new generation required. Clean cards add supply, multiplied by the serve factor. Fossil direction is demand minus clean additions, efficiency, and retirement from policy tags, political surplus, and cheaper energy. A won race trims emissions a little. Unmet demand is not added again on top of the existing growth push, so the no-investment ending mix stays put.

The Ember 2025 terawatt-hour line and the UNEP 2.8°C line are static context. They are not computed from the run.

## Motion and layout

Pathway rows use a ring and three stage pips. The ring uses the same settle curve as the meter fills. The breakthrough card uses the existing rise motion. `?fast=1` and `prefers-reduced-motion` skip the tween and still show the words. Portrait 390 keeps the race in the hud and the pathway list in the scrolling sheet.
