"""Verify saved scene instancing and crew assets after a fresh level load."""
import json
import math
import sys
from pathlib import Path
import unreal as u
root=Path(u.Paths.project_dir());data=json.loads((root/'Data/ParkComic/layout.json').read_text())
sys.path.insert(0,str(root/'Scripts'))
from prepare_environment_refresh import retired_tennis_parts
actors=u.get_editor_subsystem(u.EditorActorSubsystem).get_all_level_actors();by={a.get_actor_label():a for a in actors}
trunks=by['Comic park inventory trunks'].get_component_by_class(u.HierarchicalInstancedStaticMeshComponent)
assert trunks.get_instance_count()==len(data['trees'])==4586
assert trunks.get_collision_profile_name()=='BlockAll'
crowns=sum(a.get_component_by_class(u.HierarchicalInstancedStaticMeshComponent).get_instance_count() for a in actors if a.get_actor_label().startswith('Comic park inventory crowns'))
assert crowns==4586
residents=[a for a in actors if a.get_actor_label().startswith('Comic resident ')]
assert len(residents)==14 and {a.get_editor_property('Style') for a in residents}==set(range(11))
for style in range(11):
    for part in ('Body','Head','LeftArm','RightArm','LeftLeg','RightLeg'):
        assert u.EditorAssetLibrary.does_asset_exist(f'/Game/ParkComic/SM_Resident{style}{part}')
for label in ('OSM Wood','OSM HiddenTrunks','OSM Canopy','OSM CanopyGold','OSM CanopyRust'):
    assert not by[label].static_mesh_component.is_visible()
    assert by[label].static_mesh_component.get_collision_profile_name()=='NoCollision'
assert len([a for a in actors if a.get_actor_label().startswith('Comic parked car ')])>=3
roof_checks=[]
world=u.EditorLevelLibrary.get_editor_world()
# Regression for the mapped 29 m² theatre service building's estimated single-storey roof.
service={'name':'OSM 1299562301 service building','roof_probe':[-11756.298,579.421,320]}
for landmark in data['landmark_models']+[service]:
    p=landmark['roof_probe']
    hit=u.SystemLibrary.line_trace_single(world,u.Vector(p[0],p[1],3000),u.Vector(p[0],p[1],-100),u.TraceTypeQuery.TRACE_TYPE_QUERY1,True,[],u.DrawDebugTrace.NONE,True)
    assert hit is not None,landmark['name']+' has no roof collision'
    result=u.get_default_object(u.load_class(None,'/Script/Engine.GameplayStatics')).call_method('BreakHitResult',(hit,))
    assert abs(result[5].z-p[2])<5,(landmark['name'],result[5].z,p[2],result[9].get_actor_label())
    assert result[9].get_actor_label()==('OSM Roof' if landmark is service else 'Comic park mapped landmarks')
    roof_checks.append({'landmark':landmark['name'],'roof_z_cm':result[5].z})
report={'passed':True,'trunks':trunks.get_instance_count(),'crowns':crowns,'residents':len(residents),'crew_styles':8,'original_meshes':len(data['models']),'roof_collision':roof_checks,'checked':'fresh saved scene counts, collision, assets, old tree removal'}
details=json.loads((root/'Data/NeighbourhoodDetails/layout.json').read_text())
detail_counts={}
for model in details['models']:
    name=Path(model['file']).stem
    rows=[row for row in details['instances'] if row['model']==name]
    comp=by['Neighbourhood detail '+name].get_component_by_class(u.HierarchicalInstancedStaticMeshComponent)
    assert comp.get_instance_count()==len(rows),name
    assert comp.get_collision_profile_name()=='NoCollision',name
    assert comp.get_editor_property('instance_start_cull_distance')==6500
    assert comp.get_editor_property('instance_end_cull_distance')==8500
    assert not comp.get_editor_property('cast_shadow')
    for i,row in enumerate(rows):
        point=comp.get_instance_transform(i,True).translation
        assert max(abs(a-b) for a,b in zip((point.x,point.y,point.z),row['position']))<.1,name
    detail_counts[name]=len(rows)
signs=[a for a in actors if a.get_actor_label().startswith('Neighbourhood detail sign ')]
assert len(signs)==len(details['signs'])
for label,mesh in (('Environment architecture accents','SM_ArchitectureAccents'),('Environment court surfaces','SM_CourtSurfaces'),('Environment court details','SM_CourtDetails')):
    comp=by[label].static_mesh_component
    assert comp.static_mesh.get_name()==mesh
    assert comp.get_collision_profile_name()=='NoCollision'
    if mesh=='SM_ArchitectureAccents':assert comp.static_mesh.get_editor_property('nanite_settings').enabled
for i,tree in enumerate(data['trees']):
    transform=trunks.get_instance_transform(i,True)
    assert abs(transform.translation.x-tree['xy'][0])<.1 and abs(transform.translation.y-tree['xy'][1])<.1
    assert abs(transform.scale3d.x-tree['diameter_cm']/100)<.0001
environment=json.loads((root/'Data/EnvironmentRefresh/layout.json').read_text())
volley=next(c for c in environment['courts'] if c['sport']=='beachvolleyball')
retired=retired_tennis_parts(data,environment['courts'])+[r for r in data['details'] if
         math.dist(r['position'][:2],volley['center'])<2500 and ((r['mesh']=='Cube' and r['material']=='Ink' and r['position'][2]==210 and r['size'][2]==80) or (r['mesh']=='Cylinder' and r['material']=='Paint' and r['position'][2]==125 and r['size'][2]==250))]
assert len(retired)>17
for mesh,mat in {(r['mesh'],r['material']) for r in retired}:
    comp=by['Comic park '+mesh+' '+mat].get_component_by_class(u.HierarchicalInstancedStaticMeshComponent)
    positions=[comp.get_instance_transform(i,True).translation for i in range(comp.get_instance_count())]
    for row in (r for r in retired if (r['mesh'],r['material'])==(mesh,mat)):
        assert all(math.dist((p.x,p.y,p.z),row['position'])>=.1 for p in positions)
report.update(neighbourhood_instances=detail_counts,neighbourhood_signs=len(signs),municipal_tree_positions_preserved=True,retired_net_parts_absent=len(retired))
(root/'Saved/Tests/Park.json').write_text(json.dumps(report,indent=2));u.log('NORD_PARK_VERIFY_OK '+json.dumps(report))
