# Separate native-import body derivative

`body.fbx` keeps the provider's own 61-bone rig, skin weights, normalized ~1m height and UV surface. It restores original GLB corner normals within measured precision limits and correct original base-color/normal references. The two JPEGs here are exact original GLB payloads, not bitmap re-encodes. The byte-identical original `generated-v2-high-detail/normal.png` is reused.

Import body and its own clips with the same **1.82 uniform scale**. Bind packed MR **G→Roughness/B→Metallic** explicitly in the native material, keeping MR/normal linear and base color sRGB. FBX does not preserve that packed node graph. Native normal/tangent convention still requires verification.

The [surface receipt and checks](../../../../../../../Verification/TripoNative/Surface/README.md) record actual fresh-FBX import, bounds, immutable source hashes and limitations. The original provider rig, older derivatives and production assets are unchanged. This candidate does not activate automatically.
