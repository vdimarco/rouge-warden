# Easier driving checkpoint — 2026-10-19 UTC

The isolated current-main candidate makes default driving more forgiving through gentler acceleration, steadier turn-in, faster steering release, stronger lift-off slowing and forward corner-speed assistance. Driving pedal and Exit drags retain their action without accidentally moving the camera. Existing floating driving controls, deliberate second-finger look and walking action-look remain available.

Both native targets build successfully. All **46 native tests pass** with zero errors, including six driving tests and the existing car-impact, fitted-hull, curb, wall, input-validation and disconnect checks. All 66 browser unit tests and the local browser UI/gesture suites pass. **Packaged rendering, multiplayer gameplay and public deployment are still pending at this checkpoint.** [Structured evidence](EasierDriving/Report.json) pins the underlying reports and records the remaining gates.

## Actual native observations

These values come from the fresh [native automation export](../Saved/Tests/EasierDriving-20261019/NativeTests-v1/Automation/index.json), not the preparatory CPU model.

| Scenario | Logged result |
| --- | --- |
| Forward Gas from rest for 1.5 seconds | 1,202.736 cm/s; 884.050 cm travelled |
| Full steering correction for 100 ms from 900 cm/s | 1.283° heading change; replicated steering 0.350 |
| Sustained steering for 350 ms from 900 cm/s | 13.499° heading change |
| Lift off from 2,000 cm/s for two seconds | 1,108.916 cm/s remaining; 3,069.360 cm travelled |
| Hold forward Gas and full steering for two seconds from 2,000 cm/s | 897.616 cm/s; 118.557° heading change |
| 30 / 120 Hz drive scenario | 1,552.749 / 1,549.452 cm/s; 24.019° / 23.899° heading change |
| Straight-line top speed | 3,000.000 cm/s |
| Brake to a full stop, then continue holding reverse | Stop observed before reverse; subsequent speed −804.351 cm/s |

The actual-world assertions also pass for partial versus full steering, complete neutral recentering within 150 ms, prompt countersteering, shallow turns, tiny corrections without corner assistance, deliberate reverse, unchanged traffic acceleration/steering, and handbrake recovery. The fitted-hull test retains its original contact assertions: the struck parked car reaches X=875.001 cm while the pushing car remains behind without overlap.

The native export classifies all 46 successes as successes with warnings. Every test includes the existing SDL initialization warning, and isolated-world cleanup warnings also remain. The [process receipt](../Saved/Tests/EasierDriving-20261019/NativeTests-v1/Result.json) confirms exit 0, restored settings, unchanged bytes for 6,927 source Content files and a closed owned process. It records no service operations.

## Scope of the tuning

Player acceleration uses 1,050→700 cm/s² power in both forward and reverse, with the same reverse cap and service-brake-before-reverse precedence. Lift-off base drag rises from 170 to 360 cm/s². Steering moves toward held input at 3.5 units/s and toward neutral or opposite input at 10 units/s.

While forward Gas is held with steering above 0.2, the corner target falls from 2,400 toward 900 cm/s as steering increases. Above that target, the car slows toward it at a bounded 1,200 cm/s². This is a soft target, not an instantaneous speed clamp or a guarantee of exact target speed. Manual braking, failsafe stopping, deliberate handbrake slides, traffic and impact resolution retain their existing branches. Releasing Gas uses lift-off drag instead of this forward-power assistance. The wheel still sends digital steering; no analog transport was added.

The [local browser summary](../Saved/Tests/EasierDriving-20261019/BrowserUI-Summary.json) covers 320×568, 390×844, 844×390 and 1280×720 layouts, adjacent pedals, targets of at least 44 px, menu/labels, native-key release, pedal/Exit camera isolation and preserved floating/second-finger/walking gestures. Its recording transport and fixture screenshots do not establish a live native stream or physical-phone comfort.

## Pending delivery and limits

The [candidate inventory](../Saved/Tests/EasierDriving-20261019/Candidate.json) contains 48 files and changes only the native executable; cooked content and dependencies match the installed package. This prepares a candidate and does not prove packaged gameplay or promotion. Root retains ownership of rendered/package/service operations, latest runtime Saved preservation, rollback, source/frontend publication and ordinary public HTTPS checks.

Full lift-off stopping distance was calculated during preparation; the fresh native evidence above measures a two-second slowing window. No fresh native before/after A/B, continuous rendered driving, physical iOS/Android, off-LAN, audible sound, full campaign or subjective handling acceptance is claimed here.
