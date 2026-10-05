# Design

- The art lives in `public/arcade/key/<id>.webp`, 640 x 360, under 80 KB each. A separate folder keeps the old frames, which game scripts own.
- `higgsfield/arcade-key-art.json` records the model, the date, the Higgsfield job ID and the source URL of each picture. `node scripts/arcade-key-art.mjs` downloads and converts them again.
- Generation: the Higgsfield MCP connector, model `gpt_image_2_5` (flare), quality high, 1k, 16:9. The user chose the connector because this session had no API key. Each prompt asks for no text, no logos and no UI.
- The machine screens use `object-fit: cover`, so the 16:9 art is cut at the sides on the 4:3.3 screen. Each prompt puts the subject in the center.
