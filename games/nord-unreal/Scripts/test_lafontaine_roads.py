"""Cross-boundary street and street-width regression checks (no Unreal required)."""
from prepare_lafontaine import clip_segment, road_width

assert clip_segment((-10,5),(20,5),(0,0,10,10)) == [(0.,5.),(10.,5.)]
assert clip_segment((5,-10),(5,20),(0,0,10,10)) == [(5.,0.),(5.,10.)]
assert clip_segment((-10,-1),(20,-1),(0,0,10,10)) is None
assert clip_segment((1,1),(9,9),(0,0,10,10)) == [(1.,1.),(9.,9.)]
assert road_width({'highway':'residential','lanes':'1','oneway':'yes'}) == 680
assert road_width({'highway':'service'}) == 380
assert road_width({'highway':'cycleway','width':'3 m'}) == 300
assert road_width({'highway':'residential','width':'unknown'}) == 680
print('La Fontaine road checks passed')
