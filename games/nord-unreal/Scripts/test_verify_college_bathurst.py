"""CPU boundary readback/negative guards and native jump-fixture thresholds; no UE."""
import ast
import copy
import json
import math
from pathlib import Path
from types import SimpleNamespace as NS

ROOT=Path(__file__).resolve().parents[1]


def functions(path,names):
    tree=ast.parse(path.read_text());scope={'math':math}
    nodes=[node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name in names]
    assert len(nodes)==len(names)
    exec(compile(ast.Module(body=nodes,type_ignores=[]),str(path),'exec'),scope)
    return scope


class Vector:
    def __init__(self,x=0.,y=0.,z=0.):self.x,self.y,self.z=x,y,z
    def __add__(self,other):return Vector(self.x+other.x,self.y+other.y,self.z+other.z)
    def __sub__(self,other):return Vector(self.x-other.x,self.y-other.y,self.z-other.z)
    def __mul__(self,scale):return Vector(self.x*scale,self.y*scale,self.z*scale)
    def dot(self,other):return self.x*other.x+self.y*other.y+self.z*other.z


scope=functions(ROOT/'Scripts/verify_college_bathurst.py',{'boundary_specs','verify_boundaries'})
layout=json.loads((ROOT/'Data/CollegeBathurst/layout.json').read_text())
specs=scope['boundary_specs'](layout)
assert len(specs)==4 and {row['side'] for row in specs}=={'west','east','south','north'}
creator=ast.parse((ROOT/'Scripts/create_college_bathurst.py').read_text())
wall_calls=[node for node in ast.walk(creator) if isinstance(node,ast.Call) and isinstance(node.func,ast.Name) and node.func.id=='block'
            and isinstance(node.args[0],ast.Constant) and node.args[0].value=='District edge']
assert len(wall_calls)==2 and all(node.args[1].elts[2].value==150 and node.args[2].elts[2].value==300 for node in wall_calls), 'Update boundary checks when actual creator height changes'


class Actor:
    def __init__(self,spec):
        self.spec=spec;self.location=Vector(*spec['location']);self.scale=Vector(*(v/100 for v in spec['size']))
        self.extent=Vector(*(v/2 for v in spec['size']));self.rotation=NS(pitch=0.,yaw=0.,roll=0.)
        self.enabled=True;self.hidden=True;self.visible=True;self.profile='BlockAll';self.collision=2;self.mesh='/Engine/BasicShapes/Cube.Cube'
        self.static_mesh_component=NS(static_mesh=NS(get_path_name=lambda:self.mesh),get_collision_profile_name=lambda:self.profile,
            get_collision_enabled=lambda:self.collision,is_visible=lambda:self.visible)
    def get_path_name(self):return '/fake/'+self.spec['side']
    def get_actor_label(self):return 'District edge'
    def get_actor_location(self):return self.location
    def get_actor_scale3d(self):return self.scale
    def get_actor_rotation(self):return self.rotation
    def get_actor_enable_collision(self):return self.enabled
    def get_editor_property(self,key):assert key=='hidden';return self.hidden
    def get_actor_bounds(self,*args):return self.location,self.extent


for defect in (None,'missing','duplicate','moved','scaled','rotated','disabled_actor','disabled_component','profile','visible_actor','invisible_component','wrong_mesh','wrong_native_actor','wrong_hit_face','wrong_hit_normal'):
    actors=[Actor(copy.deepcopy(spec)) for spec in specs];events=[]
    actor=actors[-1]
    if defect=='missing':actors.pop()
    elif defect=='duplicate':actors.append(Actor(copy.deepcopy(specs[-1])))
    elif defect=='moved':actor.location.x+=1
    elif defect=='scaled':actor.scale.z+=.02
    elif defect=='rotated':actor.rotation.yaw=1
    elif defect=='disabled_actor':actor.enabled=False
    elif defect=='disabled_component':actor.collision=0
    elif defect=='profile':actor.profile='NoCollision'
    elif defect=='visible_actor':actor.hidden=False
    elif defect=='invisible_component':actor.visible=False
    elif defect=='wrong_mesh':actor.mesh='/fake/wrong_mesh'
    def trace(world,start,end,query,complex_trace,ignored,*args):
        remaining=[a for a in actors if a not in ignored];assert len(remaining)==1
        target=remaining[0];normal=Vector(*target.spec['normal']);expected=target.location-normal*35
        assert (end-start).dot(normal)==1000 and complex_trace
        events.append(target.spec['side'])
        row=[None]*12;row[0]=True;row[5]=expected;row[7]=normal*-1;row[9]=target
        if defect=='wrong_native_actor':row[9]=object()
        elif defect=='wrong_hit_face':row[5]=expected+Vector(1,1,1)
        elif defect=='wrong_hit_normal':row[7]=normal
        return row
    u=NS(Vector=Vector,SystemLibrary=NS(line_trace_single=trace),TraceTypeQuery=NS(TRACE_TYPE_QUERY1=1),DrawDebugTrace=NS(NONE=0),CollisionEnabled=NS(QUERY_AND_PHYSICS=2))
    try:rows=scope['verify_boundaries'](u,object(),actors,layout,NS(call_method=lambda name,args:args[0]))
    except AssertionError:assert defect is not None
    else:assert defect is None and len(rows)==4 and len(events)==4

runtime=functions(ROOT/'Scripts/test_college_runtime.py',{'boundary_candidates','boundary_run_ready','boundary_contained'})
tree=ast.parse((ROOT/'Scripts/test_college_runtime.py').read_text())
first=next(i for i,node in enumerate(tree.body) if isinstance(node,ast.Expr) and isinstance(node.value,ast.Call) and isinstance(node.value.func,ast.Name) and node.value.func.id=='step')
last=next(i for i,node in enumerate(tree.body) if isinstance(node,ast.FunctionDef) and node.name=='finish')
labels=[];registration_scope={node.name:(lambda *args,**kwargs:None) for node in tree.body if isinstance(node,ast.FunctionDef)}
registration_scope.update(ANCHORS=dict.fromkeys(('Corner','College','Euclid','Grace')),step=lambda label,*args,**kwargs:labels.append(label))
exec(compile(ast.Module(body=tree.body[first:last],type_ignores=[]),'native-check-count','exec'),registration_scope)
assert len(labels)==35
candidates=runtime['boundary_candidates'](layout)
assert len(candidates)==4 and {row['side'] for row in candidates}=={'west','east','south','north'}
assert all(layout['road_widths'][row['road_index']]>=900 and row['point'] in (layout['roads'][row['road_index']][0],layout['roads'][row['road_index']][-1]) for row in candidates)
for remaining,speed,expected in ((400,450,False),(350,450,True),(300,450,True),(299,450,None),(350,0,None)):
    character=NS(get_actor_location=lambda:Vector(0,-remaining,100),get_velocity=lambda:Vector(0,speed,0))
    runtime['STATE']={'host_char':character,'boundary_normal':Vector(0,1,0),'boundary_inner':Vector(0,-35,150)}
    try:result=runtime['boundary_run_ready']()
    except AssertionError:assert expected is None
    else:assert result is expected
for defect in (None,'escaped','no_airborne','no_contact','low_jump'):
    sample={'max_outward_from_inner_cm':-42.,'max_z_cm':280.,'airborne':True,'airborne_wall_contact':True}
    if defect=='escaped':sample['max_outward_from_inner_cm']=-36.
    elif defect=='no_airborne':sample['airborne']=False
    elif defect=='no_contact':sample['airborne_wall_contact']=False
    elif defect=='low_jump':sample['max_z_cm']=140
    runtime.update(STATE={'boundary_sample':sample,'boundary_launch':Vector(0,-325,100),'host_char':NS(get_actor_location=lambda:Vector(0,-42,100))},
        REPORT={},elapsed=lambda:2.6,release_controls=lambda:None,isolation=lambda:True,vec=lambda v:[v.x,v.y,v.z])
    try:result=runtime['boundary_contained']()
    except AssertionError:assert defect is not None
    else:assert defect is None and result
print('COLLEGE_BOUNDARY_CPU_OK four exact300cm walls/native-ray guards; all4 surveyed candidates; strict run-up, capsule containment and actual airborne-contact rejection checks')
