"""Each window has an iron trough. The door opening, the rail, and the lamp apron stay."""
from pathlib import Path

shader = Path(__file__).resolve().with_name('city_facade.hlsl').read_text()
assert 'float Trough = Wall * step(P.x, WindowWidth + 0.02) * step(abs(Cell.y - 0.105), 0.042) * (1.0 - Opening);' in shader
assert 'float Lip = Wall * step(P.x, WindowWidth + 0.02) * step(abs(Cell.y - 0.142), 0.008) * (1.0 - Opening);' in shader
assert shader.index('float Trough') > shader.index('float Spill')
assert shader.index('float Cornice') > shader.index('float Lip')
assert 'float3(0.16, 0.17, 0.18), max(Iron, Spout)' in shader
assert 'float3(0.36, 0.14, 0.08)' in shader
print('NORD_FACADE_TROUGH_OK')
