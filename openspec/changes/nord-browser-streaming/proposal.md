# Browser access to NORD

Make the existing Unreal Montréal game playable from a desktop browser without porting or replacing the game. Use Epic's UE5.8 Pixel Streaming frontend on Vercel and the user's current Linux GPU PC as a temporary game/signalling host. The user selected this PC to avoid a new GPU hosting bill.

The first rollout supports two independent browser players in the existing co-op session. Each player needs a distinct Unreal process/stream; two viewers of one stream are not two characters. Preserve game/map assets and existing host-owned campaign saves. Keep deployment separate from the existing Warden production arcade.

Temporary hosting requires the PC and processes to stay running. Public signalling needs HTTPS/WSS, and WebRTC media needs a reachable ICE route. Validate actual local browser video/input and report public-network/TURN limits honestly. Do not buy cloud GPU/TURN resources or change router/firewall settings as part of this rollout.

The user has now confirmed phone video loads and requested mobile controls. Extend this player with touch movement/camera/action controls using existing native bindings; preserve the running game and networking services.

On 2026-10-13 the user requested drag-to-look anywhere on the game image, optional phone gyro look, and smaller action buttons in the bottom-right corner. Extend the existing touch controller and menu, retaining movement/action ownership and 44 px hit areas. Validate sensor permission/failure cases and actual streamed camera input; physical-phone sensor feel remains a separate check.

The user then asked to show the finished GTA: NORD trailer on the player's title screen. Add a muted trailer loop behind the start card, the GTA: NORD title and tagline, and a button that plays the full trailer with sound. Keep the connect flow, touch controls and streaming behavior unchanged.

After the menu change the user asked for smaller, more subtle touch buttons with a comic book feel, for the trailer to play full screen, and for the game to go fullscreen by itself. Restyle the touch controls, make the trailer fill the screen, and take the game frame fullscreen on the tap that starts it on touch screens. The tall game on a phone held upright still needs the host to run the rebuilt game.
