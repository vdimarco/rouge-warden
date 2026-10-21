"""Some clay bricks carry a pale salt crust above the joint. Stone, mortar, and the apron stay."""
from pathlib import Path

shader = Path(__file__).resolve().with_name('city_facade.hlsl').read_text()
assert 'float Crust = (1.0 - Stone) * step(0.64, BloomId)' in shader
assert 'step(0.08, Face.y) * step(Face.y, 0.62)' in shader
assert 'lerp(Color, float3(0.84, 0.82, 0.76), Crust * lerp(0.55, 1.0, Streak));' in shader
assert shader.index('float Crust') > shader.index('max(Chip, Pit)')
assert shader.index('float3 Mortar') > shader.index('float Crust')
assert 'float3(0.36, 0.14, 0.08)' in shader
assert 'float Trough = Wall * step(P.x, WindowWidth + 0.02)' in shader
assert 'float Lit = step(0.55, Room) * Wall * (1.0 - Glass);' in shader


def crust_amount(stone, bloom_id, face_x, face_y, streak):
    if stone or bloom_id < 0.64:
        return 0.0
    if not (0.08 <= face_y <= 0.62 and 0.10 <= face_x <= 0.90):
        return 0.0
    return 0.55 + 0.45 * streak


assert crust_amount(0.0, 0.80, 0.5, 0.3, 1.0) == 1.0
assert crust_amount(1.0, 0.80, 0.5, 0.3, 1.0) == 0.0
assert crust_amount(0.0, 0.20, 0.5, 0.3, 1.0) == 0.0
assert crust_amount(0.0, 0.80, 0.5, 0.04, 1.0) == 0.0
print('NORD_FACADE_CRUST_OK')
