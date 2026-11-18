"""Build the Ashwarden's textured, skinned GLB. Run with Blender's background Python."""
import argparse
import math
from pathlib import Path
import sys

import bpy
import numpy as np
from mathutils import Vector

TAU = math.tau
PROJECT = Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
parts = []


def point(p):
    """Author in Godot axes and convert to Blender's Z-up space."""
    x, y, z = p
    return (x, -z, y)


def material(name, tint, roughness, metal=0, pattern=None, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*tint, 1)
    mat.use_nodes = True
    tree = mat.node_tree
    shader = tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*tint, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metal
    if emission:
        shader.inputs["Emission Color"].default_value = (*tint, 1)
        shader.inputs["Emission Strength"].default_value = emission
    if pattern:
        size = 1024
        rng = np.random.default_rng(sum(map(ord, name)))
        u, v = np.meshgrid(np.arange(size, dtype=np.float32)/size, np.arange(size, dtype=np.float32)/size)
        grain = rng.normal(0, .021, (size, size)).astype(np.float32)
        clouds = (.043*np.sin(TAU*(u*3+v*4)) + .031*np.cos(TAU*(v*9-u*8))
                  + .028*np.sin(TAU*(u*17-v*15) + np.sin(TAU*v*7)))
        if pattern == "cloth":
            relief = (.10*np.sin(TAU*u*142)*np.cos(TAU*v*132) + .035*np.cos(TAU*(v*66+u*45)))
            noise = clouds*1.5 + relief + grain
        elif pattern == "metal":
            scratch = np.maximum(0, np.sin(TAU*(u*91+v*3+np.sin(TAU*v*5)*.065)))**24
            relief = scratch * (.10*np.maximum(0, np.cos(TAU*(v*11-u*7))))
            noise = clouds + relief + grain*.6
        else:
            relief = .035*np.sin(TAU*(u*53-v*43))*np.sin(TAU*(v*58+u*30))
            noise = clouds*.55 + relief + grain*.50
        image = bpy.data.images.new(name+"_1024",width=size,height=size,alpha=True)
        rgba = np.ones((size,size,4),dtype=np.float32)
        rgba[:,:,:3] = np.clip(np.array(tint)[None,None,:]*(.88 + noise[:,:,None]*1.84),0,1)
        image.pixels.foreach_set(rgba.ravel())
        image.pack()
        sampler = tree.nodes.new("ShaderNodeTexImage")
        sampler.image = image
        tree.links.new(sampler.outputs["Color"],shader.inputs["Base Color"])
    return mat


linen = material("Indigo quilted linen", (.19,.31,.39), .88, pattern="cloth")
wool = material("Oxblood wool", (.62,.139,.104), .87, pattern="cloth")
lining = material("Crimson edging", (.79,.299,.16), .73, pattern="cloth")
hide = material("Black tanned leather", (.145,.111,.091), .61, pattern="hide")
suede = material("Chestnut harness", (.37,.225,.143), .55, pattern="hide")
iron = material("Blued steel", (.31,.38,.42), .39, .68, "metal")
dark_iron = material("Blackened plates", (.21,.27,.30), .48, .57, "metal")
gold = material("Hammered brass", (.69,.46,.24), .44, .60, "metal")
ivory = material("Aged ivory enamel", (.86,.787,.67), .41, .17, "hide")
black = material("Recess", (.063,.049,.047), .78)
amber = material("Amber slit", (.98,.48,.13), .41, emission=2.1)
edge = material("Etched blade", (.49,.73,.735), .26, .65, "metal")
gem = material("Aqua inlay", (.23,.79,.71), .31, .22, emission=.68)


def mesh(name, vertices, faces, finish, bone, uv=None, smooth=True):
    data = bpy.data.meshes.new(name)
    data.from_pydata([point(p) for p in vertices], [], faces)
    data.update()
    obj = bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(obj)
    data.materials.append(finish)
    if uv:
        layer = data.uv_layers.new(name="UVMap")
        for f in data.polygons:
            coords = [uv[data.loops[i].vertex_index] for i in f.loop_indices]
            seam = max(c[0] for c in coords) - min(c[0] for c in coords) > .65
            for i, (u,v) in zip(f.loop_indices, coords):
                layer.data[i].uv = (u+1 if seam and u<.25 else u,v)
    for f in data.polygons:
        f.use_smooth = smooth
    groups = {}
    for i, p in enumerate(vertices):
        weights = {bone:1.0} if isinstance(bone,str) else bone(i,p)
        for label, value in weights.items():
            if value > 0.00001:
                if label not in groups:
                    groups[label] = obj.vertex_groups.new(name=label)
                groups[label].add([i],float(value),"REPLACE")
    parts.append(obj)
    return obj


def loft(name, rows, finish, bone, resolution=32, detail=None, close_bottom=True):
    vertices, uv, faces = [], [], []
    for row, (x,y,z,rx,rz) in enumerate(rows):
        for i in range(resolution):
            a = TAU*i/resolution
            p = (x+rx*math.cos(a),y,z+rz*math.sin(a))
            vertices.append(detail(row,a,p) if detail else p)
            uv.append((i/resolution,row/(len(rows)-1)))
    for r in range(len(rows)-1):
        for i in range(resolution):
            j=(i+1)%resolution
            faces.append((r*resolution+i,(r+1)*resolution+i,(r+1)*resolution+j,r*resolution+j))
    if close_bottom:
        faces.append(tuple(range(resolution)))
    faces.append(tuple((len(rows)-1)*resolution+i for i in reversed(range(resolution))))
    return mesh(name,vertices,faces,finish,bone,uv)


def tube(name, path, radii, finish, bone, sides=9):
    vertices, uv, faces = [], [], []
    for r, p in enumerate(path):
        tangent = (Vector(path[min(r+1,len(path)-1)])-Vector(path[max(0,r-1)])).normalized()
        reference = Vector((0,0,1)) if abs(tangent.z)<.82 else Vector((1,0,0))
        u = tangent.cross(reference).normalized()
        v = tangent.cross(u).normalized()
        radius = radii[r] if isinstance(radii,(tuple,list)) else radii
        for i in range(sides):
            a=TAU*i/sides
            vertices.append(tuple(Vector(p)+(math.cos(a)*u+math.sin(a)*v)*radius))
            uv.append((i/sides,r/max(1,len(path)-1)))
    for r in range(len(path)-1):
        for i in range(sides):
            j=(i+1)%sides
            faces.append((r*sides+i,r*sides+j,(r+1)*sides+j,(r+1)*sides+i))
    faces.append(tuple(reversed(range(sides))))
    faces.append(tuple((len(path)-1)*sides+i for i in range(sides)))
    return mesh(name,vertices,faces,finish,bone,uv)


def bead(name, x, y, z, rx, ry, rz, finish, bone):
    rings=[]
    for j in range(11):
        a=-math.pi/2+(j+.01)*math.pi/10.02
        rings.append((x,y+ry*math.sin(a),z,rx*math.cos(a),rz*math.cos(a)))
    return loft(name,rings,finish,bone,18)


def panel(name, corners, finish, bone, thickness=.014):
    faces = [(0,1,2,3),(7,6,5,4),(4,5,1,0),(5,6,2,1),(6,7,3,2),(7,4,0,3)]
    return mesh(name, corners+[(x,y,z+thickness) for x,y,z in corners], faces,finish,bone,
                [(0,0),(1,0),(1,1),(0,1)]*2, False)


def torso_weights(_index,p):
    w = max(0,min(1,(p[1]-.91)/.24))
    return {"Pelvis":1-w,"Chest":w}


loft("Quilted brigandine", [
    (0,.741,.018,.151,.098),(0,.815,.015,.178,.106),(0,.93,.021,.175,.101),
    (0,1.015,.021,.191,.129),(0,1.108,.027,.219,.142),(0,1.22,.025,.25,.148),
    (0,1.292,.018,.236,.125),(0,1.352,.009,.127,.093),
], linen,torso_weights,48,lambda row,a,p: (p[0],p[1]+.01*math.cos(2*a),p[2]+.006*math.sin(a*6)))
loft("Waist harness",[(0,.825,.012,.172,.114),(0,.842,.012,.184,.121),(0,.914,.011,.184,.127),
    (0,.927,.012,.174,.115)], hide,"Pelvis",44)
for y in [.843,.918]:
    tube("Belt piping",[(.183*math.cos(i*TAU/40),y,.011+.124*math.sin(i*TAU/40)) for i in range(41)],
         .0055,suede,"Pelvis",7)
panel("Forged belt clasp",[(-.054,.852,-.127),(.054,.852,-.127),(.048,.907,-.13),(-.048,.907,-.13)],gold,"Pelvis",.019)
panel("Clasp stone",[(-.017,.86,-.134),(.020,.86,-.134),(.019,.903,-.138),(-.015,.903,-.138)],gem,"Pelvis",.014)

for side, suffix in [(-1,"L"),(1,"R")]:
    x = side*.123
    thigh, shin, foot = "Thigh_"+suffix, "Shin_"+suffix, "Foot_"+suffix
    loft("Tapered breeches",[(x,.442,-.016,.066,.062),(x,.479,-.017,.080,.074),
        (x,.605,.01,.091,.087),(x,.729,.022,.105,.096),(x,.814,.014,.107,.093)],linen,thigh,32)
    for i in range(2):
        z = -.039-.020*i
        tube("Quilt seam",[(x+side*.072,.49,z),(x+side*.089,.605,z),(x+side*.093,.704,z)],
             .005,suede,thigh,7)
    bead("Leather knee underlayer",x,.458,-.024,.085,.096,.082,hide,shin)
    bead("Sculpted poleyn",x,.468,-.084,.080,.076,.050,iron,shin)
    tube("Knee trim",[(x+side*.055,.493,-.108),(x+side*.021,.53,-.126),(x-side*.04,.51,-.112)],
         .007,gold,shin)
    loft("Long cuff boot",[(x,.083,.017,.057,.057),(x,.117,.018,.067,.072),(x,.20,.018,.065,.071),
       (x,.282,.022,.077,.077),(x,.335,.023,.078,.077),(x,.389,.009,.077,.071)],hide,shin,32)
    for y in [.327,.375]:
        loft("Boot binding",[(x,y-.012,.017,.073,.077),(x,y,.018,.083,.081),(x,y+.013,.015,.078,.079)],suede,shin)
        bead("Cuff rivet",x+side*.08,y,-.005,.012,.010,.010,gold,shin)
    tube("Greave ridge",[(x+side*.023,.146,-.035),(x+side*.025,.263,-.063),(x+side*.027,.376,-.068)],
         [.016,.026,.011],dark_iron,shin,12)
    loft("Tapered boot foot",[(x,.011,-.032,.067,.121),(x,.025,-.034,.080,.133),
       (x,.052,-.035,.079,.133),(x,.085,-.021,.070,.112),(x,.111,.005,.061,.070)],hide,foot,36)
    loft("Welted sole",[(x,.008,-.034,.073,.127),(x,.021,-.034,.082,.134),(x,.035,-.035,.080,.134)],
         dark_iron,foot,32)
    tube("Toe cap",[(x-.056,.048,-.139),(x-.03,.058,-.163),(x,.061,-.167),(x+.037,.056,-.157),
         (x+.065,.045,-.129)], .008,iron,foot,7)

    upper,fore,hand = "Upper_arm_"+suffix,"Forearm_"+suffix,"Hand_"+suffix
    arm_x = side*.275
    loft("Gathered sleeve",[(side*.339,1.045,.011,.062,.060),(side*.322,1.11,.017,.075,.069),
        (side*.293,1.225,.011,.089,.075),(arm_x,1.30,.009,.088,.089),
        (arm_x,1.351,.007,.050,.058)],linen,upper,30)
    if side<0:
        for j in range(4):
            cx=arm_x+side*(.013+j*.023)
            y=1.345-j*.043
            loft("Layered left pauldron",[(cx,y-.060,.014,.101,.111),(cx,y-.024,.014,.129,.131),
                (cx-side*.025,y+.019,.016,.116,.109),(cx-side*.047,y+.038,.012,.071,.073)],
                iron if j%2==0 else dark_iron,upper,34)
            tube("Pauldron rolled edge",[(cx+.105*math.cos(i*TAU/32),y-.043,.014+.117*math.sin(i*TAU/32))
                 for i in range(33)],.005,gold,upper,7)
    else:
        bead("Right padded shoulder",arm_x,1.277,.010,.099,.108,.092,hide,upper)
        for i in range(3):
            y=1.27+i*.026
            tube("Shoulder seam",[(arm_x-.04,y+.019,-.067),(arm_x+.024,y,-.087),(arm_x+.066,y-.023,-.059)],
                 .0055,suede,upper,7)
    loft("Articulated bracer",[(side*.354,.861,.026,.050,.053),(side*.349,.900,.022,.062,.064),
        (side*.345,.968,.017,.071,.067),(side*.339,1.041,.012,.068,.061),(side*.34,1.061,.012,.057,.056)],
        hide,fore,32)
    for j in range(3):
        y=.918+j*.052
        loft("Overlapping bracer band",[(side*.352,y-.013,.018,.063+j*.004,.065),
            (side*.352,y+.007,.018,.070+j*.004,.067),(side*.347,y+.019,.018,.066+j*.004,.063)],
            iron if j==1 else dark_iron,fore,22)
        bead("Bracer rivet",side*.403,y+.004,-.029,.010,.010,.009,gold,fore)
    palm=(side*.357,.831,.026)
    bead("Glove palm",*palm,.051,.066,.042,hide,hand)
    for j in range(4):
        xx=palm[0]+side*(.025-j*.015)
        tube("Glove digit",[(xx,.818,-.004),(xx,.795,-.016),(xx-side*.006,.782,.005)],
             [.013,.013,.009],hide,hand,8)
    tube("Glove thumb",[(palm[0]-side*.030,.841,-.001),(palm[0]-side*.052,.817,-.012),
        (palm[0]-side*.044,.805,-.016)], [.018,.016,.012],suede,hand,9)

# Cloth yoke and diagonal strap lie over the fitted torso.
loft("Draped shoulder mantle",[(0,1.208,.026,.274,.174),(0,1.236,.026,.267,.170),
    (0,1.281,.023,.244,.154),(0,1.331,.019,.198,.139),(0,1.373,.008,.138,.112),
    (0,1.411,.000,.106,.098)], wool,"Chest",56,
    lambda row,a,p:(p[0],p[1]+.021*math.sin(a+.55),p[2]+.005*math.cos(a*5)),
    close_bottom=False)
tube("Woven shoulder hem",[(.274*math.cos(a),1.208+.021*math.sin(a+.55),
    .026+.174*math.sin(a)+.005*math.cos(a*5)) for a in [i*TAU/56 for i in range(57)]],
    .005,lining,"Chest",8)
for offset in [-.016,.016]:
    tube("Harness stitching",[
        (-.143+offset,1.275,-.105),(-.087+offset,1.20,-.145),
        (-.031+offset,1.105,-.135),(.045+offset,1.008,-.118),(.092+offset,.928,-.112)],
        .012,suede,"Chest",8)
bead("Mantle brooch",-.146,1.254,-.123,.046,.045,.014,gold,"Chest")
bead("Mantle brooch inlay",-.146,1.255,-.138,.024,.024,.009,gem,"Chest")
loft("Folded neck wrap",[(0,1.368,.009,.119,.115),(0,1.401,.007,.135,.124),
    (.013,1.439,.005,.128,.111),(0,1.454,.014,.101,.098)], wool,"Chest",46,
    lambda row,a,p:(p[0],p[1]+.012*math.sin(3*a)+.009*math.cos(a+row),p[2]))
for j in range(2):
    tube("Neck wrap seam",[(.130*math.cos(i*TAU/40),1.397+j*.021+.01*math.sin(3*i*TAU/40),
        .010+.12*math.sin(i*TAU/40)) for i in range(41)], .005,lining,"Chest",7)
bead("Scarf knot",.103,1.411,.102,.071,.063,.060,wool,"Chest")

# The hood has a swept-back shape, a thick rolled edge, and a recessed mask.
loft("Sculpted hood",[
    (0,1.377,.023,.074,.076),(0,1.403,.029,.105,.099),(0,1.460,.034,.135,.124),
    (0,1.54,.037,.145,.133),(0,1.61,.050,.124,.118),(0,1.68,.067,.082,.076),
    (0,1.718,.075,.033,.034),(0,1.729,.075,.005,.008),
],wool,"Head",48,lambda row,a,p:(p[0]+.003*math.sin(a*5),p[1]+.009*math.cos(a*2+row*.32),p[2]))
loft("Dark eye recess",[(0,1.421,-.066,.033,.037),(0,1.455,-.071,.081,.054),
    (0,1.515,-.077,.112,.065),(0,1.578,-.079,.109,.066),(0,1.632,-.077,.076,.040),
    (0,1.660,-.067,.035,.025)],black,"Head",42)
hood_opening = [(-.069,1.43,-.049),(-.100,1.466,-.074),(-.126,1.521,-.079),
    (-.126,1.575,-.079),(-.104,1.626,-.076),(-.061,1.666,-.053),(0,1.683,-.042),
    (.064,1.666,-.053),(.110,1.624,-.075),(.132,1.576,-.079),(.130,1.514,-.084),(.096,1.453,-.068)]
tube("Folded fabric lining",[(x,y,z+.033) for x,y,z in hood_opening],.032,wool,"Head",14)
tube("Brass hood piping",[(x,y,z+.006) for x,y,z in hood_opening],
    [.007,.009,.009,.009,.010,.010,.010,.010,.010,.009,.009,.007],gold,"Head",10)
loft("Porcelain brow",[(0,1.558,-.104,.093,.040),(0,1.577,-.105,.101,.043),
    (0,1.617,-.093,.087,.048),(0,1.643,-.081,.065,.039),(0,1.658,-.071,.032,.028)],
    ivory,"Head",42,lambda row,a,p:(p[0],p[1]-.009*abs(math.cos(a)),p[2]))
loft("Porcelain cheek and chin shell",[
    (0,1.424,-.074,.029,.030),(0,1.438,-.095,.060,.030),(0,1.474,-.104,.073,.039),
    (0,1.512,-.108,.088,.050),(0,1.538,-.106,.095,.052)
],ivory,"Head",44,lambda row,a,p:(p[0],p[1]+.014*abs(math.cos(a)),p[2]-.018*max(0,-math.sin(a))**11))
for side in [-1,1]:
    tube("Amber eye",[(side*.023,1.554,-.149),(side*.044,1.552,-.150),
        (side*.069,1.557,-.137),(side*.081,1.562,-.129)],[.006,.007,.006,.004],amber,"Head",10)
    tube("Mask inlay",[(side*.060,1.478,-.123),(side*.084,1.504,-.128),
        (side*.094,1.519,-.121)],.0048,gold,"Head",8)
    for j in range(3):
        bead("Mask rivet",side*(.105-j*.011),1.513-j*.021,-.079,.007,.008,.006,gold,"Head")
tube("Mask crest",[(0,1.592,-.144),(0,1.631,-.130),(0,1.674,-.092)], [.006,.009,.004],gold,"Head")
tube("Hood crown seam",[(0,1.693,-.039),(0,1.733,.079),(0,1.693,.145),(0,1.617,.166),
     (0,1.53,.177),(0,1.44,.132)], .005,lining,"Head",7)


def textile(name, profile, resolution, finish, bones, pivot=0):
    vertices, uv, faces = [], [], []
    count=len(profile)
    for row in range(count):
        for col in range(resolution):
            u=col/(resolution-1)
            vertices.append(profile[row](u))
            uv.append((u,row/(count-1)))
    for row in range(count-1):
        for col in range(resolution-1):
            i=row*resolution+col
            faces.append((i,i+1,i+1+resolution,i+resolution))
    def weights(i,_p):
        phase=max(0,(i//resolution)/(count-1)*(len(bones)-1)+pivot)
        lo=min(len(bones)-1,int(phase))
        hi=min(len(bones)-1,lo+1)
        fraction=min(1,phase-lo)
        if lo == hi:
            return {bones[lo]:1}
        return {bones[lo]:1-fraction,bones[hi]:fraction}
    return mesh(name,vertices,faces,finish,weights,uv)


for side,suffix in [(-1,"L"),(1,"R")]:
    def coat_row(t):
        def shape(u):
            x=side*(.020+u*(.200+t*.031) + .013*t**3)
            y=.927-.42*t + (.052*math.cos(u*math.pi)-.016*math.sin(u*9))*t**5
            z=.148+.104*t-(.043+(.028*(1-t)))*(u**1.6)+.008*math.cos(u*TAU*1.5+t)
            return (x,y,z)
        return shape
    tails=["Pelvis","Coat_"+suffix,"Hem_"+suffix]
    textile("Split riding coat", [coat_row(j/20) for j in range(21)], 23,wool,tails)
    for low,high in [(0,.045),(.955,1)]:
        def binding(t):
            row = coat_row(t)
            return lambda u: tuple(v+(.0025 if i==2 else 0) for i,v in enumerate(row(low+(high-low)*u)))
        textile("Coat edge binding",[binding(j/20) for j in range(21)],5,lining,tails)

# Raised maker's mark sits where it stays legible from behind the character.
for angle in range(12):
    phase=angle*TAU/12
    x=.075*math.cos(phase)
    y=1.199+.074*math.sin(phase)
    bead("Mantle embroidery",x,y,.203,.008,.008,.005,gold,"Chest")
tube("Embroidered lozenge",[(0,1.268,.198),(.042,1.201,.200),(0,1.133,.170),
    (-.042,1.201,.200),(0,1.268,.198)],.006,gold,"Chest",7)
tube("Embroidered sunbreak",[(-.047,1.196,.202),(.004,1.174,.184),(.042,1.213,.202)],.0045,lining,"Chest",7)


def scarf_row(t):
    def profile(u):
        width=(.159*(1-.48*t))*(1-.40*t**12)
        notch=.024*(1-abs(2*u-1))*(t**11)
        return (.135+.13*t+.040*math.sin(t*3.3)+(u-.5)*width,
                1.423+.042*math.sin(t*4.6)-.070*t+.026*math.sin(u*TAU+t*3)+.018*t*math.cos(u*14),
                .120+t*.78 - notch + .011*math.sin(u*TAU+t*2))
    return profile


scarf_bones=["Scarf_"+str(i) for i in range(6)]
textile("Continuous wind scarf", [scarf_row(j/36) for j in range(37)], 19,wool,scarf_bones)
for low,high in [(0,.065),(.935,1)]:
    rows=[scarf_row(j/36) for j in range(37)]
    def strip(row):
        return lambda u: tuple(v + (.003 if i==1 else 0) for i,v in enumerate(row(low+(high-low)*u)))
    textile("Scarf woven border", [strip(row) for row in rows], 5,lining,scarf_bones)

# Sword and grip share the weapon bone so their contact with the glove stays fixed.
weapon="Weapon"
wx=.360
loft("Bound sword grip",[(wx,.729,-.026,.025,.029),(wx,.760,-.027,.030,.032),
     (wx,.873,-.026,.030,.030),(wx,.921,-.026,.027,.028)],hide,weapon,28)
for j in range(8):
    y=.751+j*.021
    tube("Grip spiral",[(wx+.031*math.cos(i*TAU/24),y+i*.00072,-.026+.032*math.sin(i*TAU/24))
         for i in range(25)], .0036,suede,weapon,7)
bead("Sword pommel",wx,.728,-.026,.044,.039,.038,gold,weapon)
tube("Quillon",[(wx-.13,.916,-.036),(wx-.087,.941,-.027),(wx,.946,-.026),(wx+.080,.958,-.022),
    (wx+.128,1.013,-.019)], [.016,.027,.035,.025,.012],gold,weapon,12)
bead("Hilt inset",wx,.956,-.063,.027,.039,.016,gem,weapon)
blade_coords=[]
for y,center,width,depth in [
    (.947,0,.036,.022),(1.024,0,.063,.028),(1.073,-.004,.084,.019),
    (1.166,.004,.087,.023),(1.342,.018,.080,.021),(1.543,.024,.063,.019),
    (1.702,.019,.048,.015),(1.833,-.007,.021,.009),(1.894,-.027,.001,.001),
]:
    blade_coords += [(wx+center-width,y,-.027),(wx+center,y,-.027-depth),
        (wx+center+width,y,-.027),(wx+center,y,-.027+depth)]
blade_faces=[]
for r in range(len(blade_coords)//4-1):
    for k in range(4):
        j=(k+1)%4
        blade_faces.append((4*r+k,4*r+j,4*(r+1)+j,4*(r+1)+k))
blade_faces += [(3,2,1,0),tuple(range(len(blade_coords)-4,len(blade_coords)))]
mesh("Fullered falchion",blade_coords,blade_faces,edge,weapon,
       [((j%4)/4,(j//4)/8) for j in range(len(blade_coords))],False)
tube("Silver cutting edge",[(x,y,z) for x,y,z in blade_coords[0::4] if y>1.0],.0036,ivory,weapon,8)
for direction in [-1,1]:
    tube("Recessed blade channel",[(wx+.005,1.071,-.027+direction*.024),(wx+.014,1.26,-.027+direction*.022),
         (wx+.024,1.50,-.027+direction*.020),(wx+.022,1.65,-.027+direction*.016)],
         [.008,.006,.005,.0015],dark_iron,weapon,8)
    for j in range(5):
        y=1.098+j*.040
        tube("Inlaid blade mark",[(wx-.012,y-.011,-.027+direction*.023),
            (wx+.009,y+.006,-.027+direction*.024),(wx+.027,y-.007,-.027+direction*.019)],
            .0028,gem,weapon,7)

# All rest axes point up in game coordinates for straightforward pose authoring.
joints = [
    ("Root",(0,0,0),None),("Pelvis",(0,.812,.009),"Root"),
    ("Chest",(0,1.040,.015),"Pelvis"),("Head",(0,1.447,.018),"Chest"),
]
for side,suffix in [(-1,"L"),(1,"R")]:
    joints += [
        ("Thigh_"+suffix,(side*.123,.804,.013),"Pelvis"),
        ("Shin_"+suffix,(side*.123,.451,-.016),"Thigh_"+suffix),
        ("Foot_"+suffix,(side*.123,.109,.009),"Shin_"+suffix),
        ("Upper_arm_"+suffix,(side*.273,1.308,.009),"Chest"),
        ("Forearm_"+suffix,(side*.340,1.056,.013),"Upper_arm_"+suffix),
        ("Hand_"+suffix,(side*.356,.869,.026),"Forearm_"+suffix),
        ("Coat_"+suffix,(side*.122,.820,.127),"Pelvis"),
        ("Hem_"+suffix,(side*.149,.640,.190),"Coat_"+suffix),
    ]
joints.append(("Weapon",(wx,.843,-.026),"Hand_R"))
for i, bone in enumerate(scarf_bones):
    p = scarf_row(i/len(scarf_bones))(.5)
    joints.append((bone,p,"Chest" if i==0 else scarf_bones[i-1]))


def assemble():
    rig_data = bpy.data.armatures.new("Ashwarden skeleton")
    rig = bpy.data.objects.new("Ashwarden",rig_data)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active=rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for name,(x,y,z),parent in joints:
        bone=rig_data.edit_bones.new(name)
        bone.head=point((x,y,z))
        bone.tail=point((x,y+.14,z))
        if parent:
            bone.parent=rig_data.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    bpy.ops.object.join()
    skin=parts[0]
    skin.name="Ashwarden skin"
    original_count=len(skin.data.vertices)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    skin.parent=rig
    armature=skin.modifiers.new("Ashwarden armature","ARMATURE")
    armature.object=rig
    armature.use_deform_preserve_volume=True
    return rig,skin,original_count


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--blend", type=Path)
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    rig,skin,count=assemble()
    skin.data.calc_loop_triangles()
    print(f"Ashwarden: {count} authored vertices, {len(skin.data.loop_triangles)} triangles, {len(joints)} pose bones")
    if args.blend:
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(args.blend.resolve()))
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    skin.select_set(True)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=str(PROJECT/"art/hero/ashwarden.glb"),export_format="GLB",
        use_selection=True,export_animations=False,export_yup=True,export_materials="EXPORT",
        export_image_format="JPEG",export_jpeg_quality=95,export_texcoords=True,export_normals=True)


if __name__ == "__main__":
    main()
