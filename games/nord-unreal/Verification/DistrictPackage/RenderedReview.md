# Independent packaged render review

**PASS for bounded package rendering and HUD readability.** All fourteen actual native 1280×720 PNGs were independently viewed. No new missing/checkerboard assets, blank viewport or unreadable HUD were observed. This supports the district-package QA merge; it does not accept finished graphics or promote the private higher-detail body.

Montréal loads its brick/window/stair frontage, trees, cars, default skull-shirt body and red prop. Comic outlines and Standard materials render. Toronto loads the original landmark windows, door, white cladding, coloured trim and corrected forward-reading lettering (clearest in Comic Jump). District names, mini-maps, attribution, objectives, HOP burst and car controls are readable.

Toronto still shows sparse repetitive shells, empty corridors, a distant abrupt horizon and thin angular paving joins. East/West close cameras crop the fascia and upper storey. Existing default body/rig/prop limitations remain; these captures do not approve the user’s final character-art target.

Both districts passed native readback of all eleven `sg.*` values at 3 and `r.ScreenPercentage` at 100 before and after crew cycling. Native bound graph clip clocks advanced; all six package peers exited 0 with no missing-package warnings. The managed window passed and restored settings, content, live package and saves; the tested archive is unchanged.

Two failed attempts remain rejected: 16:52 read frame-zero ScreenPercentage 0 before startup applied 100; 17:21 strictly rejected duplicate setter/query 100 rows. The passing fixture waits for the last ordered startup command before sampling; duplicate/missing checks remain strict.

No continuous video was viewed. These stills provide no frame-rate, long-soak, physical-input, internet, full-campaign or save-persistence acceptance. Body pose/foliage timing differs between looks; no pixel identity or performance claim.

Exact source, report, window, log and image hashes are in [RenderedReview.json](RenderedReview.json). Native originals are copied byte-for-byte under `RenderedImages/`; passing and failed receipts are under `RenderedReceipts/`.

| District | Image | Independent observation |
| --- | --- | --- |
| montreal | [NordComic_Car.png](RenderedImages/montreal/NordComic_Car.png) | Car, brick facades, exterior stairs, mature trees and road assets render. Car exit/speed/control HUD is legible; foreground tree dominates the left composition. |
| montreal | [NordComic_East.png](RenderedImages/montreal/NordComic_East.png) | Existing default skull-shirt body, palm shorts and red prop render against populated brick/window/stair frontage. Face has soft baked detail and hands remain rigid; close framing crops feet. Objective and control HUD readable. |
| montreal | [NordComic_Jump.png](RenderedImages/montreal/NordComic_Jump.png) | Airborne default body, HOP burst and ground shadow visible against exterior stairs. Single still shows state only; it cannot establish transition quality or fluidity. |
| montreal | [NordComic_North.png](RenderedImages/montreal/NordComic_North.png) | Sidewalk, parked cars, trees and intersection retain readable silhouettes and outlined materials. Mini-map/attribution/objective readable; no blank or checkerboard surfaces observed. |
| montreal | [NordComic_West.png](RenderedImages/montreal/NordComic_West.png) | Street-facing body/car and long opposite frontage render. Ground joins and patterned outlines remain visible. Distant frontage is repetitive; no new missing-asset symptom observed. |
| montreal | [NordRealistic_East.png](RenderedImages/montreal/NordRealistic_East.png) | Standard-mode brick/stone/windows/stair surfaces and default body/prop render. Moving body is softer than static architecture; pose differs from Comic, so no pixel-matched comparison claim. |
| montreal | [NordRealistic_North.png](RenderedImages/montreal/NordRealistic_North.png) | Standard-mode tree shadows, parked cars, brick frontage and ground render. HUD remains legible against darker shadows; no missing geometry or error screen observed. |
| toronto | [NordComic_Car.png](RenderedImages/toronto/NordComic_Car.png) | Streetcar rails/markings, shell blocks and car render with legible Toronto free-roam, attribution, mini-map, exit/speed/control HUD. Corridor is very sparse and recedes to an abrupt horizon. |
| toronto | [NordComic_East.png](RenderedImages/toronto/NordComic_East.png) | Sneaky Dee's original stone, framed ground windows, door and partial fascia render; cropped visible DEE'S reads forward. Close side fixture excludes most of the sign and upper storey. Pavement texture/joins remain visible. |
| toronto | [NordComic_Jump.png](RenderedImages/toronto/NordComic_Jump.png) | Corrected SNEAKY DEE'S lettering reads forward, with left edge cropped. White cladding, coloured panels, trim, door, default airborne body and HOP burst render. This is a strong glyph-handness package proof, not full-facade composition approval. |
| toronto | [NordComic_North.png](RenderedImages/toronto/NordComic_North.png) | Default skull-shirt body/face, car and repetitive shell frontage render; HUD legible. Wide paving has thin diagonal joins and shell frontage lacks street-level detail. |
| toronto | [NordComic_West.png](RenderedImages/toronto/NordComic_West.png) | Landmark windows/door/partial forward-reading fascia and side corridor render. Thin angular road/sidewalk joins remain. Partial close fascia cannot prove all three complete signs in this packaged suite. |
| toronto | [NordRealistic_East.png](RenderedImages/toronto/NordRealistic_East.png) | Standard stone, original window/door/fascia material and moving default body/prop render. Clear difference from Comic without default/checkerboard failure. Sparse long corridor remains. |
| toronto | [NordRealistic_North.png](RenderedImages/toronto/NordRealistic_North.png) | Standard-mode default body/shirt/hair/prop, shell walls and car render. Shadows make shells dark but HUD stays legible. Existing simple body/rig and empty frontage remain art limitations. |
