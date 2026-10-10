"""Check road width formulas and exact source/layout/header segment alignment."""
import json
import re
from prepare_lafontaine import DATA,ROOT,road_width_cm,source_road_metadata,road_segments_text,road_widths_text

assert road_width_cm({'highway':'residential'})==620
assert road_width_cm({'highway':'primary','lanes':'4'})==1240
assert road_width_cm({'highway':'primary','lanes':'8'})==1400
assert road_width_cm({'highway':'residential','lanes':'1'})==400
assert road_width_cm({'highway':'service','lanes':'4'})==380
assert road_width_cm({'highway':'secondary','lanes':'3;2'})==930
data=json.loads((DATA/'layout.json').read_text());roads,widths=source_road_metadata()
assert data['roads']==roads and data['road_widths']==widths
assert len(roads)==len(widths)==data['counts']['roads']
header=(ROOT/'Source/Quebec/LaFontaineMap.h').read_text()
assert road_segments_text(roads) in header, 'Header row order/coordinates differ from OSM and layout'
assert road_widths_text(roads,widths) in header, 'Width array differs from source road order'
rows=re.search(r'const FVector RoadSegments\[\]\[2\] = \{\n(.*?)\n\};',header,re.S).group(1).splitlines()
values=re.search(r'const float RoadSegmentWidths\[\] = \{\n(.*?)\n\};',header,re.S).group(1).split(',')
expected=[(a,b,width) for road,width in zip(roads,widths) for a,b in zip(road,road[1:])]
assert len(rows)==len(values)==len(expected)
for row,value,(a,b,width) in zip(rows,values,expected):
    actual=[tuple(map(float,v.split(','))) for v in re.findall(r'FVector\(([^)]+)\)',row)]
    assert actual==[tuple(float(f'{v:.3f}') for v in [*p,0]) for p in (a,b)]
    assert float(value.rstrip('f'))==width
print('NORD_ROAD_WIDTHS_TEST_OK',len(roads),'source roads,',len(rows),'coordinate-aligned segment widths')
