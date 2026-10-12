"""Small batched mesh writer for the Plateau environment pass; centimetres throughout."""
import math
from pathlib import Path


class Mesh:
    def __init__(self):
        self.groups = {}

    def face(self, material, points):
        points = [tuple(p) for p in points]
        assert len(points) >= 3 and all(len(p) == 3 and all(math.isfinite(v) for v in p) for p in points)
        self.groups.setdefault(material, []).append(points)

    def box(self, material, center, size, yaw_degrees=0):
        assert all(v > 0 for v in size), size
        c, s = math.cos(math.radians(yaw_degrees)), math.sin(math.radians(yaw_degrees))
        x, y, z = (v / 2 for v in size)
        p = [(center[0] + a*c-b*s, center[1] + a*s+b*c, center[2]+d)
             for a, b, d in [(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),
                              (-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)]]
        for indices in [(3,2,1,0),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)]:
            self.face(material, [p[i] for i in indices])

    def rod(self, material, a, b, radius, sides=8):
        assert radius > 0 and sides >= 3
        d = [b[i]-a[i] for i in range(3)]
        length = math.sqrt(sum(v*v for v in d))
        assert length > .001, (a,b)
        d = [v/length for v in d]
        reference = (0,0,1) if abs(d[2]) < .9 else (0,1,0)
        u = (d[1]*reference[2]-d[2]*reference[1], d[2]*reference[0]-d[0]*reference[2], d[0]*reference[1]-d[1]*reference[0])
        norm = math.sqrt(sum(v*v for v in u)); u = [v/norm for v in u]
        v = (d[1]*u[2]-d[2]*u[1], d[2]*u[0]-d[0]*u[2], d[0]*u[1]-d[1]*u[0])
        rings = [[tuple(p[j]+radius*(u[j]*math.cos(i*math.tau/sides)+v[j]*math.sin(i*math.tau/sides)) for j in range(3))
                  for i in range(sides)] for p in (a,b)]
        self.face(material, rings[0][::-1]); self.face(material, rings[1])
        for i in range(sides):
            k = (i+1)%sides
            self.face(material, [rings[0][i],rings[0][k],rings[1][k],rings[1][i]])

    def cylinder(self, material, center, radius, height, sides=12):
        self.rod(material, (center[0],center[1],center[2]-height/2),
                 (center[0],center[1],center[2]+height/2),radius,sides)

    def write(self, directory):
        directory = Path(directory); directory.mkdir(parents=True,exist_ok=True)
        for material, faces in self.groups.items():
            assert material.replace('_','').isalnum(), material
            with (directory/(material+'.obj')).open('w') as f:
                f.write('o '+material+'\n'); index = 1
                for poly in faces:
                    a,b = poly[:2]
                    d = [b[i]-a[i] for i in range(3)]
                    length = math.sqrt(sum(v*v for v in d)) or 1
                    d = [v/length for v in d]
                    horizontal = max(p[2] for p in poly)-min(p[2] for p in poly) < .1
                    for x,y,z in poly:
                        f.write(f'v {x:.3f} {-y:.3f} {z:.3f}\n')
                    for p in poly:
                        uv = (p[0]/200,p[1]/200) if horizontal else (sum(p[i]*d[i] for i in range(3))/200,p[2]/200)
                        f.write(f'vt {uv[0]:.5f} {uv[1]:.5f}\n')
                    # OBJ importer reverses Y; reverse winding to preserve the outward normal.
                    for i in range(1,len(poly)-1):
                        f.write(f'f {index+i+1}/{index+i+1} {index+i}/{index+i} {index}/{index}\n')
                    index += len(poly)


if __name__ == '__main__':
    m = Mesh(); m.box('Test',(0,0,50),(200,100,100),30)
    assert len(m.groups['Test']) == 6
    m.rod('Test',(0,0,0),(10,20,100),4)
    assert len(m.groups['Test']) == 16
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        m.write(d)
        data = (Path(d)/'Test.obj').read_text()
        assert data.count('\nf ') == 40 and 'nan' not in data
    print('Plateau mesh checks passed')
