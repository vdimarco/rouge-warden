# Design

Reuse the existing standardPad polling and pad edge cache. Clear cached button states in the existing no-pad branch, alongside trigger hysteresis. This must preserve one action per press while connected and emit no action while disconnected. Browser synthetic input verifies logic only; physical controller behavior and affected Chrome-session latency remain unverified. No rendering technique is added.
