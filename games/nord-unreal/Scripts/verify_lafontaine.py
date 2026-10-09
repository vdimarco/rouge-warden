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
for label,p,minimum,maximum in [('spawn',data['spawn'], -1,20),('car',data['car'],-1,20),
                               ('address building',data['address_xy'],250,6500)]:
    hit=u.SystemLibrary.line_trace_single(world,u.Vector(p[0],p[1],8000),u.Vector(p[0],p[1],-200),
        u.TraceTypeQuery.TRACE_TYPE_QUERY1,True,[],u.DrawDebugTrace.NONE,True)
    assert hit is not None,label+' has no ground collision'
    # Optional-return Python wrapper returns the hit struct only when the native bool is true.
    result=u.get_default_object(u.load_class(None,'/Script/Engine.GameplayStatics')).call_method('BreakHitResult',(hit,))
    z=result[5].z
    assert result[0] and minimum<=z<=maximum,(label,z,str(result))
    checks.append({'location':label,'surface_z_cm':z})
report={'passed':True,'checks':checks,'counts':data['counts']}
output=root/'Saved/Tests/LaFontaine.json'
output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps(report,indent=2))
u.log('LAFONTAINE_VERIFY_OK '+json.dumps(report))
