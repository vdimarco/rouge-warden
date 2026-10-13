"""Compile the pond, rain streak and puddle Custom node bodies as C++ and check their math."""
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))
from plateau_atmosphere import RAIN_MAX_OFFSET

SOURCE = SCRIPTS / 'water_shader_test.cpp'
# The streak check uses the displacement limit that plateau_atmosphere authors on M_NordRain.
FLAGS = ['-std=c++20', '-Wall', '-Wextra', '-Werror', '-O1', '-I', str(SCRIPTS), f'-DNORD_RAIN_MAX_OFFSET={RAIN_MAX_OFFSET!r}']
compilers = [name for name in ('c++', 'g++', 'clang++') if shutil.which(name)]
assert compilers, 'no C++ compiler found (c++, g++ or clang++)'
for body in ('pond_water.hlsl', 'rain_streak.hlsl', 'wet_puddles.hlsl'):
    text = (SCRIPTS / body).read_text()
    # Unreal shader headers define these; a body that uses them would not mean what the test checks.
    for name in ('PI', 'check', 'verify', 'ensure', 'TEXT', 'SMALL_NUMBER', 'static'):
        assert not any(word == name for word in text.replace('(', ' ').replace(')', ' ').replace(';', ' ').split()), (body, name)
    assert 'return ' in text and '#' not in text, body
outputs = {}
with tempfile.TemporaryDirectory() as directory:
    for name in compilers:
        version = subprocess.run([name, '--version'], capture_output=True, text=True).stdout.splitlines()[0]
        binary = Path(directory) / ('water_shader_test_' + name.replace('+', 'p'))
        build = subprocess.run([name, *FLAGS, str(SOURCE), '-o', str(binary), '-lm'], capture_output=True, text=True)
        assert build.returncode == 0, f'{name} build failed:\n{build.stderr}'
        run = subprocess.run([str(binary)], capture_output=True, text=True)
        assert run.returncode == 0, f'{name} water shader test failed:\n{run.stdout}{run.stderr}'
        outputs[name] = run.stdout
        print(f'{name} ({version}): {run.stdout.strip().splitlines()[-1]}')
print(outputs[compilers[0]].strip())
print('NORD_WATER_SHADERS_OK', len(compilers), 'compilers')
