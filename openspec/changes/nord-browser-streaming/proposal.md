# Browser access to NORD

Make the existing Unreal Montréal game playable from a desktop browser without porting or replacing the game. Use Epic's UE5.8 Pixel Streaming frontend on Vercel and the user's current Linux GPU PC as a temporary game/signalling host. The user selected this PC to avoid a new GPU hosting bill.

The first rollout supports two independent browser players in the existing co-op session. Each player needs a distinct Unreal process/stream; two viewers of one stream are not two characters. Preserve game/map assets and existing host-owned campaign saves. Keep deployment separate from the existing Warden production arcade.

Temporary hosting requires the PC and processes to stay running. Public signalling needs HTTPS/WSS, and WebRTC media needs a reachable ICE route. Validate actual local browser video/input and report public-network/TURN limits honestly. Do not buy cloud GPU/TURN resources or change router/firewall settings as part of this rollout.

The user has now confirmed phone video loads and requested mobile controls. Extend this player with touch movement/camera/action controls using existing native bindings; preserve the running game and networking services.
