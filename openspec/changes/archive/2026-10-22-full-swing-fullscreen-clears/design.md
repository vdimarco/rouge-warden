# Design

Official source: https://threejs.org/docs/pages/WebGLRenderer.html documents autoClear and complete render targets. Existing full-screen triangle has depth testing/writing disabled, opaque output, no discard, and overwrites the viewport. Disable autoClear only inside pass(), restore caller state in finally even on render failure. Keep scene render clear and renderer target selection unchanged. No shader/art/physics changes. Scope: bloom pass helper, browser regression/CI, hardware evidence, specs.
