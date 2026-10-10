# Environment visual review — 2026-10-09

Independently inspected all seven final packaged 1600×900 screenshots and all seven fresh environment views at **each** supported size, after [EnvironmentRender1280.json](EnvironmentRender1280.json) and [EnvironmentRender1920.json](EnvironmentRender1920.json) reported `passed: true`. The seven package screenshots were re-inspected after the final post-atlas-fix [Package.json](Package.json) pass at 23:53 on October 9, Montréal time. Their environmental observations remain consistent with the earlier review. The fourteen environment PNGs independently match their reports' sizes, dimensions, signature and final IEND marker; both resolutions use the same seven camera definitions. Stale root-level `Preview/Environment*.png` files were excluded.

The result reads as a coherent mapped comic park district. Broad crowns and quiet pond shading are visible improvements. Montréal resemblance remains partial: the massing and arrangement carry more identity than the estimated façades, foliage and flat terrain. No checkerboard fallback, missing material or gross broken mesh was visible in these frames. This is a visual assessment, not a claim of exact Street View reconstruction or a new performance/physics test.

## Observations from both resolutions

| View | Observed result and remaining limit |
| --- | --- |
| Theatre | Open stage, slender frame, surrounding water and curved seating are readable. The broad plain canopy and repeated posts remain a simplified landmark illustration. A cyan gameplay beacon is visible. |
| Chalet | Continuous terrace-side glazing distinguishes the low pavilion from the surrounding houses. The large plain roof and uniform glazing still lack the building's detailed architectural identity. |
| Centre | Massing and a different window rhythm are legible, but walls and roof remain a generic simplified institutional building. |
| Courts | Court groups, markings, fences and surrounding open lawns read clearly. A shared green surface does not establish the documented carpet/acrylic distinction. |
| Pond | Water is subdued green-grey with soft directional ripple/highlight bands; the former synchronized grid is absent. Some regular bands remain visible in the bright reflection. The level bank and flat water do not reproduce the documented valley and cascade. |
| Overview | The two-pond arrangement, theatre island, sports groups, surrounding blocks and survey roof shapes provide the strongest geographic identity. Flat ground, dense repeated crown forms and the bounded map edge remain conspicuous. |
| Sherbrooke | Masonry variation, narrow windows, basement courses, tree-lined road and populated streets are clear. The nearest façades retain long blank basement stretches and repetitive windows. The selected decorative doors/stoops are poorly demonstrated by this camera; it does not prove convincing entrances throughout the street. |

Canopy silhouettes now vary in breadth and outline, with visible forks and sky gaps. They no longer read predominantly as single vertical eggs. Close views still show chunky opaque cloud-like lobes and repeated fork patterns; species-specific leaves, fine twigs and natural crown transparency are absent. Some crowns overlap into a continuous screen behind the landmarks. The palette is predominantly green/ochre with occasional russet, although comic shadows push foliage and trunks toward purple. Minor ink speckling and edge aliasing remain on fine geometry. These static frames do not establish water motion, absence of temporal shimmer or traversal clearance.

## Evidence and reference scope

Fresh view sets: `Preview/Environment1280/Environment{Theatre,Chalet,Centre,Courts,Pond,Overview,Sherbrooke}.png` and the corresponding files in `Preview/Environment1920/`.

[Package.json](Package.json) confirms seven rendered packaged captures but does not contain their paths. [verify_package.py](../Scripts/verify_package.py) identifies the reviewed files under `Builds/Linux/Quebec/Saved/Screenshots/Linux/`: `NordComic_East`, `NordComic_North`, `NordComic_West`, `NordRealistic_East`, `NordRealistic_North`, `NordComic_Jump` and `NordComic_Car`, all `.png`. These cover the spawn street, jump and car; they **do not show the pond**. The two realistic street shots show functioning materials without the comic treatment, but do not verify realistic-mode landmark views.

The [City's 2012 heritage guide](https://ville.montreal.qc.ca/pls/portal/docs/PAGE/CONS_PAT_MTL_FR/MEDIA/DOCUMENTS/GUIDE%20PARC%20LA%20FONTAINE_DEPT_CPM_15JUIN2012.PDF) documents varied mature trees, sloping landscape and two basins at different levels. [Lemay's theatre project](https://lemay.com/projects/theatre-de-verdure/) describes the open relationship between the modern theatre and park; [ékm's chalet project](https://www.ekmarchitecture.com/data-projects/1021-lafontaine-eng) provides renovation context. These support the character assessment, not a matched-camera comparison. No current Google Street View pixels were available for inspection. Known court, terrain, architectural and source-date limits remain as documented in [environment provenance](../Data/EnvironmentRefresh/README.md).

No production source, assets or editor state were changed for this review.
