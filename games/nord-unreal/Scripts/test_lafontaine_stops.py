"""La Fontaine ARRET approach header checks against the checked-in OSM snapshot (no Unreal required)."""
from pathlib import Path
import math
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'Scripts'))
import prepare_lafontaine_stops as stops

# 13 stop nodes lie on traffic-graph streets; two all-way junctions (Mentana/Duluth, Mentana/Napoleon) add their
# other approaches. The other 64 mapped stops are on streets outside the original traffic graph.
EXPECTED = 14


def closed_roads(segments):
    """AQuebecCar's TrafficRoadLinks and PruneTrafficBranches, for the Quebec.Traffic.BlockedApproach fixture."""
    links = [[] for _ in range(2*len(segments))]
    for i in range(len(segments)):
        for j in range(i+1, len(segments)):
            for a in (0, 1):
                for b in (0, 1):
                    if math.dist(segments[i][a], segments[j][b]) <= 40.:
                        if j not in links[i*2+a]: links[i*2+a].append(j)
                        if i not in links[j*2+b]: links[j*2+b].append(i)
    roads = [True]*len(segments)
    changed = True
    while changed:
        changed = False
        for i, active in enumerate(roads):
            if active and any(not any(roads[n] for n in links[i*2+side]) for side in (0, 1)):
                roads[i] = False
                changed = True
    return roads, links


def blocked_approach_junction(segments, roads, links):
    """The junction Quebec.Traffic.BlockedApproach picks: the first long approach with a perpendicular long approach."""
    for i, active in enumerate(roads):
        if not active: continue
        for side in (0, 1):
            end = segments[i][side]
            into_a = (end[0]-segments[i][1-side][0], end[1]-segments[i][1-side][1])
            if math.hypot(*into_a) < 2500. or sum(roads[n] for n in links[i*2+side]) < 2: continue
            for j in links[i*2+side]:
                if not roads[j]: continue
                other = 0 if math.dist(end, segments[j][0]) <= 40. else 1
                into_b = (end[0]-segments[j][1-other][0], end[1]-segments[j][1-other][1])
                if math.hypot(*into_b) < 2500. or abs(stops.dot(stops.unit(into_a), stops.unit(into_b))) > .15: continue
                return end
    raise AssertionError('no BlockedApproach junction')


def main():
    rows = stops.approaches()
    assert len(rows) == EXPECTED, f'{len(rows)} stop approaches, expected {EXPECTED}'
    segments = stops.road_segments()
    assert len(segments) == 663
    for index, side, point, travel, node in rows:
        assert math.dist(segments[index][side], point) <= 40., f'segment {index} does not reach its stop junction'
        into = stops.unit((segments[index][side][0]-segments[index][1-side][0], segments[index][side][1]-segments[index][1-side][1]))
        assert stops.dot(into, travel) > .999, f'segment {index} enters its junction against the stored direction'
        assert abs(math.hypot(*travel)-1.) < 1e-6
    assert len({(index, side) for index, side, *_ in rows}) == len(rows), 'duplicate approach'

    # The existing traffic reservation test uses a junction without an ARRET sign, so its timing stays unchanged.
    roads, links = closed_roads(segments)
    junction = blocked_approach_junction(segments, roads, links)
    assert all(math.dist(point, junction) > 300. for _, _, point, _, _ in rows), 'BlockedApproach junction gained a stop'
    active = sum(roads[index] for index, *_ in rows)

    # The checked-in header is exactly what the generator writes now.
    text = stops.HEADER.read_text()
    assert text == stops.header_text(rows), 'LaFontaineStops.h is stale; run Scripts/prepare_lafontaine_stops.py'
    assert len(re.findall(r'\{FVector\(', text)) == EXPECTED and text.isascii()

    # Plain C++ with one-line FVector and int32 stubs, like LaFontaineMap.h.
    compiler = shutil.which('clang++') or shutil.which('g++')
    if compiler:
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp)/'stops.cpp'
            source.write_text('using int32 = int;\n'
                              'struct FVector { double X, Y, Z; constexpr FVector(double InX, double InY, double InZ) : X(InX), Y(InY), Z(InZ) {} };\n'
                              f'#include "{stops.HEADER}"\nint main() {{ return LaFontaine::StopApproachCount == {EXPECTED} && '
                              'LaFontaine::StopSegments[0] >= 0 ? 0 : 1; }\n')
            subprocess.run([compiler, '-std=c++20', '-Wall', '-Wextra', '-Wshadow', '-Werror', '-o', str(Path(tmp)/'stops'), str(source)], check=True)
            subprocess.run([str(Path(tmp)/'stops')], check=True)
    else:
        print('NORD_LAFONTAINE_STOPS_TEST compile skipped: no C++ compiler on PATH')
    print('NORD_LAFONTAINE_STOPS_TEST_OK', len(rows), 'approaches,', active, 'on circulating roads,', compiler or '')


if __name__ == '__main__':
    main()
