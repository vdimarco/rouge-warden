"""Odd courses are headers: a second joint and a separate tint on each half."""
from pathlib import Path

shader = Path(__file__).resolve().with_name('city_facade.hlsl').read_text()
assert 'float HeaderCourse = step(0.5, frac(CourseId * 0.5));' in shader
assert 'float HeaderJoint = step(abs(Across - 0.52), 0.045) * HeaderCourse;' in shader
assert 'Color *= lerp(1.0, lerp(0.72, 1.25, HeaderBreak), HeaderCourse);' in shader
assert 'float2 BrickId = floor(float2(UV.x * 8.0 + floor(Z / 28.0) * 0.5, Z / 28.0));' in shader
assert 'float Crust = (1.0 - Stone) * step(0.64, BloomId)' in shader
assert shader.index('float HeaderJoint') < shader.index('float3 Mortar')
assert shader.index('HeaderBreak') < shader.index('float3 Mortar')


def header_course(course_id):
    fraction = (course_id * 0.5) % 1.0
    return 1.0 if fraction >= 0.5 else 0.0


assert header_course(0) == 0.0
assert header_course(1) == 1.0
assert header_course(2) == 0.0
assert header_course(3) == 1.0
print('NORD_FACADE_BOND_OK')
