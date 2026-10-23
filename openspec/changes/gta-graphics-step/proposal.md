# Play the casual walk when the crew rig is missing

Animation smoothness is still the lowest aesthetics score. The body rock is in, and it leans the whole mesh. The crew blend space still cannot be posed offline. The casual civilian already has an authored walk. When `SK_Body` is missing and that skeleton and its idle and walk clips load, the player mesh plays them, so the feet leave the idle stance. The static clothed stand remains the fallback when those clips are missing. The opening camera, the socket, and the sway amplitudes stay.
