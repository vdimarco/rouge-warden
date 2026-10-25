# Original 1970s-inspired fleet

Three silhouettes share the existing vehicle footprint and running gear: a fastback coupe, notchback sedan and long-roof wagon. Shaped fenders, open wheel arches, painted pillars, crowned roofs, four round sealed-beam lamps, inset grilles, wraparound chrome bumpers, mirrors, door seams, marker lamps and steel wheels replace the primitive car assembly. Each car carries one licence plate, at the rear: Quebec has required only a rear plate since 1979. Four enamel colours retain the comic city's palette.

These are original procedural designs, not licensed replicas of a particular manufacturer. No extracted game assets, Google imagery or third-party vehicle models are used. Dark opaque glass preserves the existing exterior-only approach; the cars have no detailed interiors.

Prepare and check using the existing geographic Python environment:

```bash
/home/von/.cache/nord-geo-venv/bin/python Scripts/prepare_seventies_cars.py
/home/von/.cache/nord-geo-venv/bin/python Scripts/test_seventies_cars.py
```

Run `Scripts/build_seventies_cars.py` with UnrealEditor-Cmd's Python commandlet and `-NullRHI` to import only the eleven `SM_Car70*` meshes and `M_Car70_*` materials in `/Game/ParkComic`. This importer never saves a level or changes actors. `AQuebecCar::ApplyPaint` selects the profile on spawn and replicated profile/paint changes, for parked, traffic, mission and possessed cars. Existing collision, tire centres, rolling/steering animation and driving simulation are retained. The old artwork remains a fallback if the new body asset is absent.

Rendered acceptance uses `Scripts/capture_seventies_cars.py` in temporary PIE with `-NordNoCampaignSave -saveddirsuffix=CarArtQA`. It records front, rear and side views of all three profiles at 1280×720 and 1920×1080 under the browser rendering preset, and checks actual component meshes, materials and non-colliding visual parts. Coordinate GPU ownership and use the unchanged resource preflight before launching it. Rebuild the browser package and restart its existing lifecycle to deliver native assets; no static player deployment is needed.
