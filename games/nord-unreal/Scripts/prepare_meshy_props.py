"""Keep the cottage crew's original plumbing props separate from generated skinning."""
import math
import shutil
import prepare_park_comic as art
art.OUT=art.ROOT/'Data/CharactersMeshy';(art.OUT/'Geometry').mkdir(exist_ok=True)
m=art.Mesh();m.rod((0,0,-35),(0,0,45),1.5,'Wood',16)
m.ellipsoid((0,0,50),(27,27,17),'Red',24,10)
# The cup lip is a real ring in the ground plane.
for i in range(32):
    a=i*math.tau/32;b=(i+1)*math.tau/32
    m.rod((13*math.cos(a),13*math.sin(a),55),(13*math.cos(b),13*math.sin(b),55),1.4,'Red',6)
a=m.save('Plunger')
m=art.Mesh();m.rod((0,0,-35),(0,0,55),3.3,'White',24);b=m.save('PVCTube')
assert a['triangles']>500 and b['triangles']>20
shutil.copy2(art.ROOT/'Data/ParkComic/Geometry/comic.mtl',art.OUT/'Geometry/comic.mtl')
print('NORD_CREW_PROPS_OK',a['triangles'],b['triangles'])
