"""Brick paper and stone paper are different hues. The lamp apron is unchanged."""
from pathlib import Path

shader = Path(__file__).resolve().with_name('city_facade.hlsl').read_text()
assert 'float3(0.36, 0.14, 0.08)' in shader
assert 'float3(0.62, 0.30, 0.14)' in shader
assert 'float3(0.40, 0.44, 0.47)' in shader
assert 'float3(0.62, 0.66, 0.68)' in shader
assert 'float3(0.19, 0.085, 0.055)' not in shader
assert 'float Lit = step(0.55, Room) * Wall * (1.0 - Glass);' in shader
assert 'float3(0.16, 0.17, 0.18), max(Iron, Spout)' in shader
print('NORD_FACADE_PALETTE_OK')
