"""La Fontaine street lamp header checks against the checked-in OSM snapshot (no Unreal required)."""
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'Scripts'))
import prepare_lafontaine as lf
import prepare_lafontaine_lamps as lamps

# The snapshot holds 288 street_lamp nodes; 22 of them lie outside the La Fontaine bounds.
EXPECTED = 266


def main():
    points = lamps.lamps()
    assert len(points) == EXPECTED, f'{len(points)} lamps, expected {EXPECTED}'
    lo, hi = lf.xy(*lf.BOUNDS[:2]), lf.xy(*lf.BOUNDS[2:])
    assert all(lo[0] <= x <= hi[0] and lo[1] <= y <= hi[1] and z == lamps.LAMP_Z for x, y, z in points), 'lamp outside the bounds'
    assert len({(round(x, 3), round(y, 3)) for x, y, _ in points}) == len(points), 'duplicate lamp positions'

    # The checked-in header is exactly what the generator writes now.
    text = lamps.HEADER.read_text()
    assert text == lamps.header_text(points), 'LaFontaineLamps.h is stale; run Scripts/prepare_lafontaine_lamps.py'
    rows = re.findall(r'FVector\(([-\d.]+),([-\d.]+),([-\d.]+)\)', text)
    assert len(rows) == EXPECTED and all(float(z) == lamps.LAMP_Z for _, _, z in rows)

    # It is plain C++ with a one-line FVector stub, like LaFontaineMap.h.
    compiler = shutil.which('clang++') or shutil.which('g++')
    if compiler:
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp)/'lamps.cpp'
            source.write_text('struct FVector { double X, Y, Z; constexpr FVector(double InX, double InY, double InZ) : X(InX), Y(InY), Z(InZ) {} };\n'
                              f'#include "{lamps.HEADER}"\nint main() {{ return int(sizeof(LaFontaine::StreetLamps) / sizeof(FVector)) == {EXPECTED} ? 0 : 1; }}\n')
            subprocess.run([compiler, '-std=c++20', '-Wall', '-Wextra', '-Werror', '-o', str(Path(tmp)/'lamps'), str(source)], check=True)
            subprocess.run([str(Path(tmp)/'lamps')], check=True)
    else:
        print('NORD_LAFONTAINE_LAMPS_TEST compile skipped: no C++ compiler on PATH')
    print('NORD_LAFONTAINE_LAMPS_TEST_OK', len(points), 'lamps', compiler or '')


if __name__ == '__main__':
    main()
