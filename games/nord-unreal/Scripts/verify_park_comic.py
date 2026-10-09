"""Verify saved scene instancing and crew assets after a fresh level load."""
import json
from pathlib import Path
import unreal as u
root=Path(u.Paths.project_dir());data=json.loads((root/'Data/ParkComic/layout.json').read_text())
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
(root/'Saved/Tests/Park.json').write_text(json.dumps(report,indent=2));u.log('NORD_PARK_VERIFY_OK '+json.dumps(report))
