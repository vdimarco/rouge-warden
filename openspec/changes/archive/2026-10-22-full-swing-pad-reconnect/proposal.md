# Restore controller button edges after reconnect

Audit desktop controller lifecycle while the remaining user-Chrome performance check is inaccessible. The cached button-edge state survives a disconnected poll, unlike trigger state, so a button active on reconnection can lose its first action. Reproduce with synthetic standard gamepads before changing code. Scope: desktop input cache, focused regression and CI, evidence and round log. No graphics or saved-data change.
