"""Brick and stone faces carry a coarse mottle. The palette, the trough, and the apron stay."""
from pathlib import Path

shader = Path(__file__).resolve().with_name('city_facade.hlsl').read_text()
assert 'Color *= lerp(0.78, 1.16, Mottle);' in shader
assert 'float Chip = step(0.80, BrickNoise) * step(0.48, Face.x) * step(Face.y, 0.40) * (1.0 - Stone);' in shader
assert 'float Pit = step(0.62, BrickNoise) * step(0.30, Face.x) * step(Face.x, 0.72) * step(0.35, Face.y) * step(Face.y, 0.70) * Stone;' in shader
assert shader.index('float Mottle') > shader.index('lerp(0.93, 1.06, Grain)')
assert shader.index('float3 Mortar') > shader.index('max(Chip, Pit)')
assert 'float3(0.36, 0.14, 0.08)' in shader
assert 'float Trough = Wall * step(P.x, WindowWidth + 0.02)' in shader
assert 'float Lit = step(0.55, Room) * Wall * (1.0 - Glass);' in shader
print('NORD_FACADE_FACE_OK')
