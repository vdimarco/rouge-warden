# Patches to the vendored three.js

This folder holds super-three 0.185.0 (the supermedium fork of three.js r185, MIT, see LICENSE) with one change.

## Deferred texture uploads under multiview

In multiview XR rendering, `WebGLRenderer.render()` calls `textures.setDeferTextureUploads(true)` and never turns it off. Nothing calls `textures.runDeferredUploads()`. So after the first multiview frame, no new or changed texture reaches the GPU: canvas panels freeze and textures loaded later draw black.

The fix runs the queued uploads at the start of each render, before the scene draws:

```
three.module.min.js
- if(N.setupLights(),t.isArrayCamera)
+ if(N.setupLights(),Ce.setDeferTextureUploads(!1),Ce.runDeferredUploads(),t.isArrayCamera)
```

In the unminified source this is, in `render()`, right after `currentRenderState.setupLights();`:

```js
textures.setDeferTextureUploads( false );
textures.runDeferredUploads();
```

`qa/vr/boot.mjs` checks that the patch is present. Apply it again if you update the lib.
