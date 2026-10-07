# Pacer: Seedance prompt (stage 2)

Upload `pacer-blockout.mp4` as **@Video 1**. Send no other reference. Copy the prompt below as it is.

```text
@Video 1 is a coarse blockout reference. It provides only camera positions, framing changes, subject paths, action timing, and cuts. Do not use its gray geometry, materials, or empty scene.

The capsule-torso figure with a sphere head on the street corresponds to Mika, a young woman marathon runner with short black hair, a navy running singlet with a white race bib, white shorts, and orange running shoes. The four smaller figures behind her correspond to other marathon runners in plain running clothes. The long cylinder and box hand with cylinder fingers correspond to Mika's forearm and hand with a navy sweatband. The disc with a needle on the wrist corresponds to a detailed analog pace gauge on a sports watch, with a cream dial, black tick marks, and a red zone at the slow end. The round figure with a small sphere head corresponds to Pip, a small round white robot with stubby limbs and a dark screen face with two glowing blue eyes. The gray box towers correspond to a dense city at night made of tall buildings shaped like giant glowing app tiles, with small lit windows. The tallest tower corresponds to the tallest app tower with an antenna mast. The flat disc Pip lifts corresponds to a glowing round voice-message bubble. The expanding rings correspond to rings of soft blue light spreading out over the city. The box arch over the street corresponds to a marathon finish-line gantry with a blank banner. The street, barriers, lamp poles, round marker sign, and buildings correspond to a city marathon course at early morning.

Re-render as 1980s hand-drawn cel anime with limited shading, clean ink lines, and painted backgrounds. Street shots: cool early-morning light, overcast sky. App-city shots: deep blue night, the glow of the tower windows and the voice bubble as the only light. Keep every cut exactly where @Video 1 cuts. No extra characters or cuts. No on-screen text.
```

## Notes

- **Why the exclusion sentence stays.** The author of this process found that the video model copied the flat colors of a colored blockout frame by frame. Our blockout is all gray, and the sentence tells the model to use the motion only.
- **Shots in @Video 1.** A 0.0–3.5 s, B 3.5–6.0 s, C 6.0–9.5 s, D 9.5–12.5 s, E 12.5–15.0 s. See `blockout.py` for what happens in each shot.
- **Do not add grain, dust or a tape look in this prompt.** Stage 3 adds them after generation, so they sit on the finished cel image.
