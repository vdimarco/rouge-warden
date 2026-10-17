# CPU silhouette checkpoint — 17 October 2026

Private CPU checkpoint only. This preserves the supplied results and all 32 hash-pinned artifacts; it does not promote a clip, prop or character and grants no graphics, native-render or motion acceptance.

The chosen native-equivalent calibration is shown only by [front](trial-native-grip-front.png), [side](trial-native-grip-side.png) and [three-quarter](trial-native-grip-threequarter.png): scale 0.6, shaft-local grip z = −0.20 m, calibrated at frame 2 to the RightHand wrist matrix translation with no palm offset, inspected at clip time 0.43254 s. “Native-equivalent” describes the intended attachment transform; these remain 16-sample CPU studio images of the retained OBJ proxy with white material. The exact transform is retained in [native-grip-preview.json](native-grip-preview.json).

In those three actual images, sleeve caps remain continuous, the large exposed shoulder lobes are reduced, and the downward/outboard prop clears the face. Open static fingers do not grasp the shaft; the pose is restrained, shirt folds remain faceted/crumpled, the far forearm approaches the abdomen/hip in side view, and the cup needs full-trajectory leg/floor checks. These observations support a bounded native test only.

The original six `baseline-*.png` / `trial-*.png` files are historical context. Their initial trial used a 4.5 cm palm offset and shaft-local z = −0.28 m, so they are not the chosen wrist/z−20 cm attachment proof. Their hashes and original [preview.json](preview.json) are preserved without relabeling.

[results.json](results.json) records the final 37-sample, 24-bone semantic comparison, neutral endpoints/static object root, changes confined to the four listed arm/forearm rotation tracks, and unchanged retained geometry/maps/weights/binds. Sampled triangle intersections outside a 10 cm wrist region were absent; this is not signed-distance, swept collision or gameplay clearance proof. Final trial FBX SHA-256: `7bc042e812872fc0d1709a861d9623512d3d93a3c9969c8c9e99c7223d2f69ab`.

A prior re-export of an already imported clip was rejected: local-scale drift 1.5497207641601562e−6 exceeded the unchanged 1e−6 tolerance. The final export used original body-based authoring. An earlier empty-scene render also failed before rendering because no World existed. These attempts are described in `results.json`; their separate rejected directories are outside the supplied 32-artifact manifest and are not copied here.

No continuous playback, native compression/blending, native materials/ink/shadows/camera, player controls, trajectory, replication, performance or final art is accepted by this checkpoint. The subsequent Vulkan attempt failed before PIE on GPU out-of-memory; no successful native rendered comparison resulted. Native authoring/verification and restoration receipts belong to the parent task, not this CPU evidence bundle.

`CurationManifest.json` inventories every file here except itself with relative paths, byte counts and SHA-256, and records exact source-copy verification. Original source/art, Content, Scripts and pinned plans were not edited during curation.
