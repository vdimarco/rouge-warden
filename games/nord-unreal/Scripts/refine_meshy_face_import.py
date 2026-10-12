"""Inspect all eight meshes; -NordApplyFaceBuild applies the face build candidate.

Backs up all affected saved meshes and the existing style9 face before any asset
write. Rebuilds retained raw data with authored normals, Mikk tangents and full
UV/tangent precision. No imports, source/texture/geometry/animation edits. Idempotent;
original backups in ignored Saved/Recovery/face-build-<timestamp> are retained on
reruns; JSON hashes/flags stay in Verification. Run outside PIE and compare actual renders.
"""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
import struct
import traceback
import unreal as u

ROOT=Path(u.Paths.project_dir()).resolve()
APPLY='-NordApplyFaceBuild' in u.SystemLibrary.get_command_line()
NAMES={3:'GreenCap51',4:'Memphis33',5:'BlackCap',6:'WhiteCap',7:'RedJersey',8:'LimeJacket',9:'CurlyMetalhead',10:'Topknot'}
FIELDS=('recompute_normals','recompute_tangents','use_mikk_t_space','compute_weighted_normals',
        'use_full_precision_u_vs','use_high_precision_tangent_basis')
EXPECTED=dict(zip(FIELDS,(False,True,True,False,True,True)))
BACKUP=None
REPORT={'passed':False,'applied':APPLY,'visual_validation_pending':True,'characters':[]}
assert not u.EditorLevelLibrary.get_pie_worlds(True),'Run mesh build changes outside PIE'

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

try:
    # Check every protected source/clip/atlas before touching any saved mesh.
    protected=[]
    manifest={row['file']:row['sha256'] for row in json.loads((ROOT/'Data/CharactersMeshy/files.json').read_text())}
    for style,name in NAMES.items():
        folder=ROOT/f'Content/ParkComic/Crew/Resident{style}'
        for filename in ('body.fbx','base_color.png'):
            path=ROOT/'Data/CharactersMeshy'/name/filename
            assert digest(path)==manifest[name+'/'+filename],(style,'original source changed',filename)
            protected.append(path)
        for stem in ('A_Idle','A_Walk','A_Run','A_Jump','T_base_color'):
            path=folder/(stem+'.uasset');assert path.exists(),path
            protected.extend(p for suffix in ('.uasset','.uexp','.ubulk') if (p:=path.with_suffix(suffix)).exists())
    protected_hashes={str(p.relative_to(ROOT)):digest(p) for p in protected}

    if APPLY:
        record_path=ROOT/'Verification/MeshyFaceBuildBackup.json'
        backup_record=json.loads(record_path.read_text()) if record_path.exists() else {'files':{},'baseline_face':{}}
        backup_relative=backup_record.get('backup_directory','Saved/Recovery/face-build-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
        BACKUP=ROOT/backup_relative
        BACKUP.mkdir(parents=True,exist_ok=True)
        backup_record['backup_directory']=backup_relative
        for style in NAMES:
            source=ROOT/f'Content/ParkComic/Crew/Resident{style}/SK_Body.uasset'
            assert source.exists(),source
            for suffix in ('.uasset','.uexp','.ubulk'):
                path=source.with_suffix(suffix)
                if not path.exists():continue
                relative=str(path.relative_to(ROOT));target=BACKUP/relative
                target.parent.mkdir(parents=True,exist_ok=True)
                if not target.exists():
                    shutil.copy2(path,target)
                    assert digest(target)==digest(path),(style,'backup copy failed')
                expected=backup_record['files'].get(relative,digest(target))
                assert digest(target)==expected,(style,'original backup changed')
                backup_record['files'][relative]=expected
        # Preserve the actual existing A render, never replace it with a later B render.
        baseline=ROOT/'Preview/PlayerQuality1280/Resident9_Face.png'
        assert baseline.exists(),'Capture actual style9 face baseline before applying this candidate'
        target=BACKUP/'Resident9_Face_Before.png'
        if not target.exists():shutil.copy2(baseline,target)
        png=target.read_bytes();assert png[:8]==b'\x89PNG\r\n\x1a\n'
        backup_record['baseline_face']={'file':str(target.relative_to(ROOT)),'sha256':digest(target),
                                        'resolution':list(struct.unpack('>II',png[16:24]))}
        record_path.write_text(json.dumps(backup_record,indent=2)+'\n')
        REPORT['backup_manifest']=str(record_path.relative_to(ROOT))
        REPORT['baseline_face']=backup_record['baseline_face']

    for style,name in NAMES.items():
        mesh=u.load_asset(f'/Game/ParkComic/Crew/Resident{style}/SK_Body')
        assert isinstance(mesh,u.SkeletalMesh),style
        skeleton=mesh.get_editor_property('skeleton')
        material_paths=[s.material_interface.get_path_name() for s in mesh.get_editor_property('materials')]
        options=u.SkeletalMeshEditorSubsystem.get_lod_build_settings(mesh,0)
        before={key:bool(options.get_editor_property(key)) for key in FIELDS}
        import_data=mesh.get_editor_property('asset_import_data')
        normal_before=str(import_data.get_editor_property('normal_import_method'))
        changed=APPLY and (before!=EXPECTED
            or import_data.get_editor_property('normal_import_method')!=u.FBXNormalImportMethod.FBXNIM_IMPORT_NORMALS
            or import_data.get_editor_property('normal_generation_method')!=u.FBXNormalGenerationMethod.MIKK_T_SPACE
            or import_data.get_editor_property('compute_weighted_normals'))
        if changed:
            for key,value in EXPECTED.items():options.set_editor_property(key,value)
            # FBX retains source corner normals even if the initial build recomputes them.
            # This scoped setter rebuilds that raw data without replacing dependencies.
            u.SkeletalMeshEditorSubsystem.set_lod_build_settings(mesh,0,options)
            import_data.set_editor_property('normal_import_method',u.FBXNormalImportMethod.FBXNIM_IMPORT_NORMALS)
            import_data.set_editor_property('normal_generation_method',u.FBXNormalGenerationMethod.MIKK_T_SPACE)
            import_data.set_editor_property('compute_weighted_normals',False)
            assert u.EditorAssetLibrary.save_loaded_asset(mesh,only_if_is_dirty=False)
        after_options=u.SkeletalMeshEditorSubsystem.get_lod_build_settings(mesh,0)
        after={key:bool(after_options.get_editor_property(key)) for key in FIELDS}
        if APPLY:assert after==EXPECTED,(style,after)
        assert mesh.get_editor_property('skeleton')==skeleton
        assert [s.material_interface.get_path_name() for s in mesh.get_editor_property('materials')]==material_paths
        REPORT['characters'].append({'style':style,'before':before,'after':after,'changed':changed,
                                    'normal_import_before':normal_before,'normal_import_after':str(import_data.get_editor_property('normal_import_method')),
                                    'saved_skeleton':skeleton.get_path_name(),'material_paths':material_paths})
    for relative,expected in protected_hashes.items():assert digest(ROOT/relative)==expected,('protected source/clip/atlas changed',relative)
    REPORT['protected_dependencies_unchanged']=True
    REPORT['protected_file_sha256']=protected_hashes
    REPORT['passed']=True
    out=ROOT/'Verification'/('MeshyFaceBuildApplied.json' if APPLY else 'MeshyFaceBuildProbe.json')
    out.write_text(json.dumps(REPORT,indent=2)+'\n')
    u.log('NORD_MESHY_FACE_BUILD_OK 8 '+('applied' if APPLY else 'inspected'))
except Exception:
    REPORT['error']=traceback.format_exc()
    out=ROOT/'Verification'/('MeshyFaceBuildApplied.json' if APPLY else 'MeshyFaceBuildProbe.json')
    out.write_text(json.dumps(REPORT,indent=2)+'\n')
    u.log_error('NORD_MESHY_FACE_BUILD_FAILED '+REPORT['error'])
    raise
