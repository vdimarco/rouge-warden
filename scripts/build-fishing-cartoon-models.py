# Run in Higgsfield 3D Jutsu (Blender). Metre-scale, editable cartoon fishing assets.
import bpy, math
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def mat(name, color):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1); p.inputs['Roughness'].default_value=.94; p.inputs['Metallic'].default_value=0
    return m
# Colors are linear; exported material factors become game vertex colors.
C={k:mat(k,c) for k,c in {'bamboo':(.57,.31,.095),'sunlit_bamboo':(.9,.66,.27),'ivory':(.92,.84,.58),'jade':(.16,.38,.25),'leaf':(.34,.54,.22),'moss':(.09,.23,.13),'coral':(.7,.19,.095),'ink':(.025,.07,.05),'water':(.18,.41,.46),'wood':(.46,.25,.10),'paper':(.83,.74,.48),'roof':(.17,.3,.19),'stone':(.32,.4,.34),'white':(.9,.91,.76)}.items()}
ROOT=None

def asset(name, loc=(0,0,0), scale=1):
    global ROOT
    ROOT=bpy.data.objects.new('ASSET_'+name,None); bpy.context.collection.objects.link(ROOT); ROOT.location=loc; ROOT.scale=(scale,)*3
    return ROOT

def finish(o,name,color,smooth=True):
    o.name=name; o.parent=ROOT; o.data.materials.append(C[color])
    for p in o.data.polygons: p.use_smooth=smooth
    return o

def ball(name,loc,scale,color,seg=10,rings=6):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,radius=1,location=loc)
    o=bpy.context.object; o.scale=scale; return finish(o,name,color)

def box(name,loc,size,color,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        b=o.modifiers.new('soft corners','BEVEL'); b.width=bevel; b.segments=1
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=b.name)
    return finish(o,name,color,False)

def tube(name,a,b,r,color,r2=None,n=8):
    a,b=Vector(a),Vector(b); d=b-a
    bpy.ops.mesh.primitive_cone_add(vertices=n,radius1=r,radius2=r if r2 is None else r2,depth=d.length,location=(a+b)/2)
    o=bpy.context.object; o.rotation_euler=d.to_track_quat('Z','Y').to_euler(); return finish(o,name,color)

def loop(name,center,r,thick,color,axis='X',seg=12):
    bpy.ops.mesh.primitive_torus_add(major_segments=seg,minor_segments=4,major_radius=r,minor_radius=thick,location=center)
    o=bpy.context.object
    if axis=='X': o.rotation_euler.y=math.pi/2
    elif axis=='Y': o.rotation_euler.x=math.pi/2
    return finish(o,name,color)

asset('rod',(0,0,1.3))
# A warm bamboo pole with broad painted nodes and a comfortable rounded grip.
for i in range(12):
    x=.25+i*2.05/12; r=.013*(1-i/15)
    tube('bamboo section '+str(i),(x,0,0),(x+2.05/12,0,0),r,'sunlit_bamboo',max(.003,r-.001),8)
    if i%2==0: tube('dark bamboo node '+str(i),(x,0,0),(x+.018,0,0),r*1.2,'bamboo',n=8)
tube('rounded cork grip',(-.34,0,0),(-.03,0,0),.025,'bamboo',.028,10)
ball('grip end',(-.34,0,0),(.022,.025,.025),'jade',8,4)
tube('jade reel seat',(-.03,0,0),(.14,0,0),.025,'jade',n=10)
tube('cream collar',(.14,0,0),(.20,0,0),.031,'ivory',.026,10)
tube('coral rod wrap',(.20,0,0),(.25,0,0),.023,'coral',.016,8)
for i in range(5):
    x=-.29+i*.05;loop('grip binding '+str(i),(x,0,0),.0255,.0018,'ivory',seg=10)
# Rounded enamel reel, large spool, thumb-sized orange handle.
tube('reel stem',(.055,0,-.01),(.055,0,-.085),.012,'jade',n=6)
ball('reel housing',(.02,0,-.12),(.061,.047,.052),'jade',12,6)
tube('cream spool rim rear',(.061,0,-.12),(.073,0,-.12),.06,'ivory',n=12)
tube('spool line',(.073,0,-.12),(.12,0,-.12),.049,'paper',n=12)
tube('cream spool front',(.12,0,-.12),(.13,0,-.12),.061,'ivory',n=12)
tube('orange drag cap',(.13,0,-.12),(.145,0,-.12),.022,'coral',.028,10)
loop('bail wire',(.1,0,-.12),.067,.004,'ivory',seg=12)
tube('crank shaft',(.018,0,-.12),(.018,-.077,-.12),.009,'ivory',n=6)
tube('crank arm',(.018,-.077,-.12),(-.023,-.085,-.17),.01,'ivory',n=6)
ball('coral crank knob',(-.023,-.098,-.17),(.019,.027,.022),'coral',10,6)
for i,s in enumerate([.62,1.0,1.34,1.62,1.85,2.03,2.17,2.295]):
    r=.022*(1-i/10);drop=.028*(1-i/10)
    tube('guide leg '+str(i),(s,0,0),(s,0,-drop),.0025,'jade',n=4)
    loop('cream line guide '+str(i),(s,0,-drop-r),r,.0024,'ivory',seg=8)

asset('lure_body',(2.7,-.4,.5),5)
ball('painted float body',(0,0,0),(.012,.025,.012),'coral',10,6)
ball('cream lure nose',(0,.021,0),(.011,.010,.011),'ivory',8,4)
for sign in [-1,1]:
    ball('lure eye white',(sign*.010,.012,.004),(.003,.005,.005),'white',8,4)
    ball('lure eye pupil',(sign*.012,.013,.004),(.0018,.0028,.0028),'ink',8,4)
tube('lure stem',(0,-.024,0),(0,-.041,0),.0018,'jade',n=5)
loop('line eye',(0,.035,0),.005,.0016,'ivory',axis='Y',seg=8)
loop('single curved hook',(0,-.043,0),.01,.0017,'ink',axis='Y',seg=10)
asset('lure_blade',(2.7,-.4,.5),5)
ball('gold leaf blade',(.017,.015,0),(.010,.024,.0025),'sunlit_bamboo',8,4)

# Shared, instanced crowns. The low version has 26 triangles; far trees have 8.
for kind in ['pine','leaf']:
    for low in [True,False]:
        asset('tree_'+kind+('_low' if low else '_high'),(-.9 if kind=='pine' else 3.4,1.8 if low else 3,0))
        if low:
            ball('rounded crown',(0,0,.60),(.48 if kind=='pine' else .36,.45 if kind=='pine' else .34,.42),'leaf',5,3)
            tube('trunk',(0,0,0),(0,0,.4),.045,'wood',.03,3)
        else:
            for j,(x,y,z,sx,sy,sz) in enumerate([(-.12,0,.52,.31,.30,.31),(.13,.02,.65,.30,.28,.30),(0,0,.83,.24,.23,.25)]):
                ball('rounded crown '+str(j),(x,y,z),(sx,sy,sz),'leaf' if j!=0 else 'jade',8,4)
            tube('trunk',(0,0,0),(0,0,.4),.045,'wood',.03,5)
asset('tree_far',(3.4,4.1,0))
mesh=bpy.data.meshes.new('distant crown mesh');mesh.from_pydata([(0,0,.08),(0,0,1.04),(.44,0,.56),(-.44,0,.56),(0,.43,.56),(0,-.43,.56)],[],[(0,2,4),(0,4,3),(0,3,5),(0,5,2),(1,4,2),(1,3,4),(1,5,3),(1,2,5)]);mesh.update()
o=bpy.data.objects.new('distant crown',mesh);bpy.context.collection.objects.link(o);finish(o,o.name,'leaf')

asset('cottage',(0,2.4,0),.15)
box('cream cottage walls',(0,0,1.5),(8,6,3),'paper',.15)
# Pitched roof, with a soft wide eave.
verts=[(-4.5,-3.6,2.9),(4.5,-3.6,2.9),(-4.5,0,5.0),(4.5,0,5.0),(-4.5,3.6,2.9),(4.5,3.6,2.9)]
mesh=bpy.data.meshes.new('roof mesh');mesh.from_pydata(verts,[],[(0,1,3,2),(2,3,5,4),(0,2,4),(1,5,3)]);mesh.update()
o=bpy.data.objects.new('green pitched roof',mesh);bpy.context.collection.objects.link(o);finish(o,o.name,'roof',False)
box('chimney',(2.5,.8,4.5),(.65,.65,2),'coral',.08)
for x in [-2.6,.2,2.8]:
    box('window frame',(x,-3.06,1.8),(1.4,.14,1.3),'wood',.05)
    box('warm window',(x,-3.15,1.8),(1.17,.04,1.08),'sunlit_bamboo')
    box('window mullion',(x,-3.18,1.8),(.075,.04,1.15),'ivory')
box('door',(-.95,-3.12,1.05),(1.1,.14,2.1),'jade',.07)
ball('door knob',(-.6,-3.25,1.1),(.065,.065,.065),'ivory',8,4)

asset('loon',(1.6,1.5,.1))
ball('round loon body',(0,0,.15),(.25,.43,.20),'ink',12,6)
ball('white loon belly',(0,-.01,.10),(.24,.39,.14),'white',10,6)
ball('loon head',(0,.32,.42),(.14,.14,.16),'ink',10,6)
tube('white neck ring',(0,.27,.22),(0,.3,.35),.10,'white',.087,8)
tube('orange beak',(0,.42,.41),(0,.60,.39),.055,'coral',.002,6)
for sign in [-1,1]:
    ball('eye',(sign*.12,.365,.46),(.036,.046,.046),'white',8,4)
    ball('pupil',(sign*.147,.372,.46),(.015,.022,.023),'ink',8,4)

# A model sheet with a warm, diffuse presentation light.
ROOT=None
bpy.ops.object.camera_add(location=(3,-6.3,4.9)); camera=bpy.context.object; camera.name='Delivery camera'; camera.rotation_euler=(Vector((1.25,1.25,.65))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=5.8
scene=bpy.context.scene;scene.camera=camera
for name,loc,energy in [('Key',(-3,-4,7),1600),('Fill',(4,1,6),950)]:
    bpy.ops.object.light_add(type='POINT',location=loc);o=bpy.context.object;o.name=name;o.data.energy=energy;o.data.shadow_soft_size=2;o.rotation_euler=(Vector((1,1,.5))-o.location).to_track_quat('-Z','Y').to_euler()
scene.world=bpy.data.worlds.new('warm ambient');scene.world.color=(.4,.5,.4);scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=1280;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.render.film_transparent=False
scene.view_settings.view_transform='Standard'
scene.render.image_settings.media_type='IMAGE';scene.render.image_settings.file_format='PNG'
target=artifacts.file(name='cartoon-models.png',media_type='image/png');scene.render.filepath=str(target.path);bpy.ops.render.render(write_still=True);target.publish()
result={'assets':[o.name for o in bpy.data.objects if o.name.startswith('ASSET_')],'mesh_count':sum(o.type=='MESH' for o in bpy.data.objects)}
