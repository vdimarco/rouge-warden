"""Check imported geometry against real coordinates and trace actual collision."""
import json
from pathlib import Path
import unreal as u
root=Path(u.Paths.project_dir())
data=json.loads((root/'Data/LaFontaine/layout.json').read_text())
world=u.EditorLevelLibrary.get_editor_world()
assert '/Maps/LaFontaine.' in world.get_path_name()
actors=u.get_editor_subsystem(u.EditorActorSubsystem).get_all_level_actors()
by_name={a.get_actor_label():a for a in actors}
assert sum(isinstance(a,u.PlayerStart) for a in actors)==4
assert 'OSM Water' in by_name and 'OSM Road' in by_name
# Detect north/south reflection at import, independently of the generated map actors.
road=by_name['OSM Road'].static_mesh_component.static_mesh.get_bounds()
assert road.origin.y>0,'OBJ import mirrored north/south'
assert 90000<road.box_extent.x*2<110000 and 110000<road.box_extent.y*2<125000
checks=[]
city_path=root/'Data/CityBuildings/manifest.json'
if city_path.exists():
    city=json.loads(city_path.read_text())
    municipal=[a for a in actors if a.get_actor_label().startswith('Municipal building ')]
    assert len(municipal)==len(city['buildings'])
    for b in city['buildings']:
        a=by_name['Municipal building '+b['id']]
        mesh=a.static_mesh_component.static_mesh
        assert mesh.get_num_sections(0)<=2, b['id']+' material batching'
        bounds=mesh.get_bounds()
        assert abs(bounds.origin.x-b['center'][0])<30 and abs(bounds.origin.y-b['center'][1])<30, b['id']+' geographic alignment'
        # Survey wall skirts can extend below the ground footprint; verify against the source.
        source_min=min(float(line.split()[3]) for line in (root/'Data/CityBuildings/Geometry'/(b['id']+'.obj')).read_text().splitlines() if line.startswith('v '))
        assert source_min<=.1 and abs(bounds.origin.z-bounds.box_extent.z-source_min)<5, b['id']+' ground alignment'
        assert abs(bounds.origin.z+bounds.box_extent.z-b['height_cm'])<10, b['id']+' surveyed height'
        assert a.static_mesh_component.get_collision_profile_name()=='BlockAll'
    checks.append({'surveyed_buildings':len(municipal),'replaced_generic_footprints':data['surveyed_replacements']})
for label,p,minimum,maximum in [('spawn',data['spawn'], -1,20),('car',data['car'],-1,20),
                               ('address',data['address_xy'],250,6500)]:
    hit=u.SystemLibrary.line_trace_single(world,u.Vector(p[0],p[1],8000),u.Vector(p[0],p[1],-200),
        u.TraceTypeQuery.TRACE_TYPE_QUERY1,True,[],u.DrawDebugTrace.NONE,True)
    assert hit is not None,label+' has no ground collision'
    # Optional-return Python wrapper returns the hit struct only when the native bool is true.
    result=u.get_default_object(u.load_class(None,'/Script/Engine.GameplayStatics')).call_method('BreakHitResult',(hit,))
    z=result[5].z
    assert result[0] and minimum<=z<=maximum,(label,z,str(result))
    checks.append({'location':label,'surface_z_cm':z})
if city_path.exists():
    nearest=min(city['buildings'],key=lambda b:(b['center'][0]-data['address_xy'][0])**2+(b['center'][1]-data['address_xy'][1])**2)
    p=nearest['roof_probe']
    hit=u.SystemLibrary.line_trace_single(world,u.Vector(p[0],p[1],10000),u.Vector(p[0],p[1],-100),u.TraceTypeQuery.TRACE_TYPE_QUERY1,True,[],u.DrawDebugTrace.NONE,True)
    assert hit is not None, 'Surveyed roof has no collision'
    result=u.get_default_object(u.load_class(None,'/Script/Engine.GameplayStatics')).call_method('BreakHitResult',(hit,))
    assert abs(result[5].z-p[2])<5, ('Surveyed roof height',result[5].z,p[2])
    assert result[9].get_actor_label().startswith('Municipal building ')
    checks.append({'surveyed_roof_z_cm':result[5].z,'model':nearest['id']})
report={'passed':True,'checks':checks,'counts':data['counts']}
output=root/'Saved/Tests/LaFontaine.json'
output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps(report,indent=2))
u.log('LAFONTAINE_VERIFY_OK '+json.dumps(report))
