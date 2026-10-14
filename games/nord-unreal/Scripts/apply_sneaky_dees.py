"""Fresh NullRHI, additive-only import of the verified original Toronto facade layer."""
import json
import math
import shlex
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'Scripts'))
import prepare_sneaky_dees as prepared

MAP='/Game/Maps/CollegeBathurst'
DESTINATION='/Game/CollegeBathurst/SneakyDees'
PREFIX="Sneaky Dee's facade "


def snapshot(u,editor):
    result={}
    for actor in editor.get_all_level_actors():
        if not isinstance(actor,u.StaticMeshActor) or actor.get_actor_label().startswith(PREFIX):
            continue
        component=actor.static_mesh_component
        mesh=component.static_mesh
        location,rotation,scale=actor.get_actor_location(),actor.get_actor_rotation(),actor.get_actor_scale3d()
        result[actor.get_path_name()]={'label':actor.get_actor_label(),
            'mesh':mesh.get_path_name() if mesh else None,
            'location':[location.x,location.y,location.z],'rotation':[rotation.pitch,rotation.yaw,rotation.roll],
            'scale':[scale.x,scale.y,scale.z],'hidden':actor.get_editor_property('hidden'),
            'visible':component.is_visible(),'collision_profile':str(component.get_collision_profile_name()),
            'collision_enabled':str(component.get_collision_enabled()),'cast_shadow':component.get_editor_property('cast_shadow'),
            'materials':[component.get_material(index).get_path_name() if component.get_material(index) else None
                         for index in range(component.get_num_materials())]}
    return result


def preflight(u,root=ROOT):
    assert '-nullrhi' in [argument.lower() for argument in shlex.split(u.SystemLibrary.get_command_line())], \
        'Use a fresh -NullRHI editor for facade authoring'
    assert Path(u.Paths.project_dir()).resolve()==root.resolve(),'Wrong Unreal project'
    report=prepared.verified(root)
    assert all(getattr(u,name,None) is not None for name in
               ('StaticMeshActor','StaticMesh','MaterialInterface','AssetImportTask','FbxImportUI',
                'EditorActorSubsystem','LevelEditorSubsystem','UnrealEditorSubsystem','Vector')),'Missing Unreal class'
    editor=u.get_editor_subsystem(u.EditorActorSubsystem)
    levels=u.get_editor_subsystem(u.LevelEditorSubsystem)
    world_editor=u.get_editor_subsystem(u.UnrealEditorSubsystem)
    tools=u.AssetToolsHelpers.get_asset_tools()
    assert editor and levels and world_editor and tools,'Missing editor subsystem'
    assert world_editor.get_editor_world().get_path_name().startswith(MAP+'.'),'Load only the saved Toronto map'
    assert not u.EditorLoadingAndSavingUtils.get_dirty_map_packages(),'Fresh saved map required'
    actors=editor.get_all_level_actors()
    assert not any(actor.get_actor_label().startswith(PREFIX) for actor in actors),'Facade actors already exist; preserve them before replacing'
    assert not any(u.EditorAssetLibrary.does_asset_exist(DESTINATION+'/SM_'+name) for name in report['materials']), \
        'Facade packages already exist; preserve the earlier attempt before replacing'
    materials={name:u.EditorAssetLibrary.load_asset('/Game/Plateau/Materials/M_'+metadata['material'])
               for name,metadata in report['materials'].items()}
    assert all(isinstance(material,u.MaterialInterface) for material in materials.values()),'Missing Plateau material'
    landmark=[actor for actor in actors if actor.get_actor_label()=='Toronto Landmark']
    assert len(landmark)==1 and isinstance(landmark[0],u.StaticMeshActor),'Missing surveyed landmark collider'
    component=landmark[0].static_mesh_component
    assert component.static_mesh.get_path_name()=='/Game/CollegeBathurst/SM_Landmark.SM_Landmark'
    assert str(component.get_collision_profile_name())=='BlockAll'
    assert component.get_collision_enabled()!=u.CollisionEnabled.NO_COLLISION
    assert component.static_mesh.get_editor_property('body_setup').get_editor_property('collision_trace_flag')==u.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE
    before=snapshot(u,editor)
    protected_paths=['Content/CollegeBathurst/SM_Landmark.uasset','Content/CollegeBathurst/SM_Glass.uasset']
    protected={name:prepared.digest(root/name) for name in protected_paths}
    return {'manifest':report,'editor':editor,'levels':levels,'tools':tools,'materials':materials,
            'before':before,'protected':protected}


def apply(u,root=ROOT,report_path=None):
    run=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    report_path=Path(report_path) if report_path else root/'Saved/Tests/CollegeBathurst'/('SneakyDees-'+run)/'apply.json'
    assert report_path.is_absolute() and report_path.resolve().is_relative_to((root/'Saved/Tests').resolve()), \
        'Report must be inside this project Saved/Tests'
    assert not report_path.exists(),'Preserve the previous apply report'
    result={'passed':False,'map':MAP,'native_visual_acceptance':False,'new_collision':False}
    try:
        context=preflight(u,root)
        manifest=context['manifest']
        result.update({'manifest_sha256':prepared.digest(root/prepared.RELATIVE/'facade.json'),
                       'source_sha256':manifest['source_sha256'],'geometry_sha256':manifest['geometry_sha256'],
                       'protected_package_sha256_before':context['protected'],'unowned_static_meshes_before':context['before'],
                       'created':[]})
        for name,metadata in manifest['materials'].items():
            task=u.AssetImportTask()
            task.filename=str(root/prepared.RELATIVE/'Geometry'/(name+'.obj'))
            task.destination_path=DESTINATION
            task.destination_name='SM_'+name
            task.automated=True
            task.save=True
            task.replace_existing=False
            options=u.FbxImportUI()
            options.import_mesh=True
            options.import_materials=False
            options.import_textures=False
            options.import_as_skeletal=False
            options.static_mesh_import_data.combine_meshes=True
            options.static_mesh_import_data.auto_generate_collision=False
            task.options=options
            context['tools'].import_asset_tasks([task])
            expected=DESTINATION+'/SM_'+name+'.SM_'+name
            assert list(task.imported_object_paths)==[expected],task.imported_object_paths
            mesh=u.EditorAssetLibrary.load_asset(expected)
            assert isinstance(mesh,u.StaticMesh) and mesh.get_num_triangles(0)==metadata['triangles'],name
            actor=context['editor'].spawn_actor_from_class(u.StaticMeshActor,u.Vector())
            actor.set_actor_label(PREFIX+name)
            actor.set_folder_path('CollegeBathurst/SneakyDees')
            component=actor.static_mesh_component
            component.set_static_mesh(mesh)
            component.set_material(0,context['materials'][name])
            component.set_collision_profile_name('NoCollision')
            component.set_cast_shadow(False)
            assert component.get_collision_enabled()==u.CollisionEnabled.NO_COLLISION
            assert u.EditorAssetLibrary.save_loaded_asset(mesh),name
            result['created'].append({'label':PREFIX+name,'mesh':expected,'triangles':mesh.get_num_triangles(0),
                                      'material':component.get_material(0).get_path_name(),'collision':'NoCollision','cast_shadow':False})
        assert snapshot(u,context['editor'])==context['before'],'Original static mesh state changed'
        assert context['levels'].save_current_level(),'Toronto map save failed'
        protected={name:prepared.digest(root/name) for name in context['protected']}
        assert protected==context['protected'],'Original landmark/glass package changed'
        after=snapshot(u,context['editor'])
        assert after==context['before'],'Original static mesh state changed during save'
        result.update({'passed':True,'triangles':manifest['triangles'],'protected_package_sha256_after':protected,
                       'unowned_static_meshes_after':after,
                       'clearances_cm':manifest['clearances_cm'],'generic_glass_unchanged':True,
                       'landmark_collision_unchanged':True})
    except Exception as error:
        result['error']=str(error)
        raise
    finally:
        report_path.parent.mkdir(parents=True,exist_ok=True)
        report_path.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    return result


def front_normals(triangles,manifest):
    """UE uses cross(P2-P0, P1-P0) for its left-handed mesh-description winding."""
    checks=[]
    word_triangles=2*sum(len(stroke)-1 for character in prepared.TEXT if character!=' '
                         for stroke in prepared.GLYPHS[character])
    for edge in manifest['edges']:
        expected=word_triangles*sum(sign['street']==edge['name'] for sign in manifest['signs'])
        if not expected:
            continue
        observed=0
        dots=[]
        for points in triangles:
            local=[]
            for point in points:
                offset=[point[index]-edge['a'][index] for index in (0,1)]
                local.append((sum(offset[index]*edge['tangent'][index] for index in (0,1)),
                              sum(offset[index]*edge['normal'][index] for index in (0,1)),point[2]))
            if not all(-.05<=x<=edge['width_cm']+.05 and abs(out-24)<.05 and 330<z<450 for x,out,z in local):
                continue
            a,b=[tuple(points[index][axis]-points[0][axis] for axis in range(3)) for index in (2,1)]
            cross=(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
            length=math.sqrt(sum(value*value for value in cross))
            assert length>1e-6,'Degenerate saved sign triangle'
            dot=sum(cross[index]*edge['normal'][index] for index in (0,1))/length
            assert dot>.999,'Saved sign faces inward on '+edge['name']
            dots.append(dot)
            observed+=1
        assert observed==expected,(edge['name'],observed,expected)
        checks.append({'street':edge['name'],'outward_sign_triangles':observed,'minimum_normal_dot':min(dots)})
    assert len(checks)==2
    return checks


def verify(u,apply_report_path,root=ROOT,report_path=None):
    """Read saved assets after a separate editor launch; never imports or saves native state."""
    manifest=prepared.verified(root)
    original=json.loads(Path(apply_report_path).read_text())
    assert original['passed'] and original['map']==MAP
    assert original['manifest_sha256']==prepared.digest(root/prepared.RELATIVE/'facade.json'),'Different applied facade manifest'
    assert original['geometry_sha256']==manifest['geometry_sha256'] and original['source_sha256']==manifest['source_sha256']
    editor=u.get_editor_subsystem(u.EditorActorSubsystem)
    world=u.get_editor_subsystem(u.UnrealEditorSubsystem).get_editor_world()
    assert Path(u.Paths.project_dir()).resolve()==root.resolve() and world.get_path_name().startswith(MAP+'.')
    assert not u.EditorLoadingAndSavingUtils.get_dirty_map_packages(),'Verify in a fresh saved-map editor'
    assert snapshot(u,editor)==original['unowned_static_meshes_before'],'Saved original static mesh state changed'
    protected={name:prepared.digest(root/name) for name in original['protected_package_sha256_before']}
    assert protected==original['protected_package_sha256_before'],'Saved original landmark/glass packages changed'
    actors=[actor for actor in editor.get_all_level_actors() if actor.get_actor_label().startswith(PREFIX)]
    assert len(actors)==len(manifest['materials'])==8
    labels={actor.get_actor_label():actor for actor in actors}
    assert set(labels)=={PREFIX+name for name in manifest['materials']}
    checks=[]
    cladding=None
    for name,metadata in manifest['materials'].items():
        actor=labels[PREFIX+name]
        assert isinstance(actor,u.StaticMeshActor)
        component=actor.static_mesh_component
        mesh=component.static_mesh
        assert mesh.get_path_name()==DESTINATION+'/SM_'+name+'.SM_'+name
        assert mesh.get_num_triangles(0)==metadata['triangles'],name
        bounds=mesh.get_bounds()
        observed=[[getattr(bounds.origin,axis)+side*getattr(bounds.box_extent,axis)
                   for axis in ('x','y','z')] for side in (-1,1)]
        assert all(math.isfinite(value) and abs(value-metadata['bounds_cm'][end][axis])<.25
                   for end,row in enumerate(observed) for axis,value in enumerate(row)),name+' bounds'
        expected='/Game/Plateau/Materials/M_'+metadata['material']+'.M_'+metadata['material']
        assert component.get_material(0).get_path_name()==expected,name+' material'
        assert component.get_collision_enabled()==u.CollisionEnabled.NO_COLLISION
        assert str(component.get_collision_profile_name())=='NoCollision'
        assert component.get_editor_property('cast_shadow') is False
        assert component.is_visible() and not actor.get_editor_property('hidden')
        location,rotation,scale=actor.get_actor_location(),actor.get_actor_rotation(),actor.get_actor_scale3d()
        assert math.dist((location.x,location.y,location.z),(0,0,0))<.01
        assert math.dist((scale.x,scale.y,scale.z),(1,1,1))<.001
        assert all(abs(value)<.01 for value in (rotation.pitch,rotation.yaw,rotation.roll))
        checks.append({'group':name,'triangles':mesh.get_num_triangles(0),'bounds_cm':observed,
                       'material':expected,'collision':'NoCollision','cast_shadow':False})
        if name=='Cladding':
            cladding=mesh.get_static_mesh_description(0)
    assert cladding and cladding.get_triangle_count()==manifest['materials']['Cladding']['triangles']
    triangles=[]
    for index in range(cladding.get_triangle_count()):
        instances=cladding.get_triangle_vertex_instances(u.TriangleID(id_value=index))
        assert len(instances)==3
        points=[]
        for instance in instances:
            point=cladding.get_vertex_position(cladding.get_vertex_instance_vertex(instance))
            points.append((point.x,point.y,point.z))
        triangles.append(points)
    normal_checks=front_normals(triangles,manifest)
    result={'passed':True,'map':MAP,'manifest_sha256':original['manifest_sha256'],'checks':checks,
            'triangles':sum(check['triangles'] for check in checks),'front_normals':normal_checks,
            'base_static_mesh_states_unchanged':True,'protected_package_sha256':protected,
            'native_visual_acceptance':False,'limits':'Fresh saved geometry/material/collision/state readback; appearance requires native rendering.'}
    if report_path:
        output=Path(report_path)
        assert output.is_absolute() and output.resolve().is_relative_to((root/'Saved/Tests').resolve()) and not output.exists()
        output.parent.mkdir(parents=True,exist_ok=True)
        output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    return result


if __name__=='__main__':
    import unreal as u
    arguments=shlex.split(u.SystemLibrary.get_command_line())
    paths=[argument.split('=',1)[1] for argument in arguments if argument.startswith('-NordSneakyDeesReport=')]
    assert len(paths)<=1,'Only one facade report destination is allowed'
    result=apply(u,report_path=paths[0] if paths else None)
    u.log('SNEAKY_DEES_APPLY_OK '+json.dumps({'triangles':result['triangles'],'batches':len(result['created'])}))
