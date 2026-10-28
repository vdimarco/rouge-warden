"""Lit facade windows keep their pane and warm the brick underneath."""
from pathlib import Path

shader = (Path(__file__).resolve().with_name("city_facade.hlsl")).read_text()
assert "float3(0.78, 0.46, 0.18)" in shader, "the lamp pane colour changed"
assert "float Lit = step(0.55, Room) * Wall * (1.0 - Glass);" in shader
assert "float Under = saturate((0.26 - Cell.y) / 0.22);" in shader
assert "float Reach = saturate(1.0 - max(P.x - WindowWidth, 0.0) / 0.28);" in shader
assert shader.index("float Spill") > shader.index("max(Iron, Spout)"), "the apron must sit on the finished wall"
assert shader.index("float Cornice") > shader.index("float Spill"), "the cornice still covers the top"
print("NORD_FACADE_SPILL_OK")
