"""Probe/apply texture-only correction for tiny Meshy UV-island mip bleeding.

Run outside PIE; -NordApplyFaceMips applies the three base-color build settings.
Backs up original saved atlases first; source PNG RGB and imported TextureSource
RGB must match before/after. Meshes, materials, animations and source downloads
are protected by hashes. No UV, geometry, shader, normal or meshLOD changes.
"""
from datetime import datetime,timezone
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import traceback
import unreal as u

ROOT=Path(u.Paths.project_dir()).resolve()
APPLY='-NordApplyFaceMips' in u.SystemLibrary.get_command_line()
NAMES={3:'GreenCap51',4:'Memphis33',5:'BlackCap',6:'WhiteCap',7:'RedJersey',8:'LimeJacket',9:'CurlyMetalhead',10:'Topknot'}
OUT=ROOT/'Verification'/('MeshyFaceMipsApplied.json' if APPLY else 'MeshyFaceMipsProbe.json')
ATLAS=ROOT/'Saved/Tests/FaceMipsAtlases';ATLAS.mkdir(parents=True,exist_ok=True)
REPORT={'passed':False,'applied':APPLY,'characters':[],
        'reason':'default mips blend neighbouring tiny disconnected UV islands, causing triangle color patches and lost painted eyes',
        'scope':'three base-color texture build settings only; BC7 and original source pixels preserved',
        'visual_validation_pending':True}
assert not u.EditorLevelLibrary.get_pie_worlds(True),'Run texture changes outside PIE'


def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def rgb_hash(path):
    result=subprocess.run([shutil.which('magick'),str(path),'-alpha','off','-depth','8','rgb:-'],check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=25)
    assert len(result.stdout)==2048*2048*3,(str(path),len(result.stdout))
    return hashlib.sha256(result.stdout).hexdigest()


def export_rgb(texture,style,label):
    task=u.AssetExportTask();task.object=texture;task.filename=str(ATLAS/f'Resident{style}_{label}.png')
    task.automated=True;task.prompt=False;task.replace_identical=True;task.exporter=u.TextureExporterPNG()
    assert u.Exporter.run_asset_export_task(task),(style,label,'TextureSource export failed')
    return rgb_hash(Path(task.filename))


def flags(texture):
    return {'mip_gen_settings':str(texture.get_editor_property('mip_gen_settings')),
            'never_stream':bool(texture.get_editor_property('never_stream')),'lod_bias':texture.get_editor_property('lod_bias'),
            'max_texture_size':texture.get_editor_property('max_texture_size'),
            'compression':str(texture.get_editor_property('compression_settings')),
            'platform_dimensions':[texture.call_method('Blueprint_GetSizeX'),texture.call_method('Blueprint_GetSizeY')]}


try:
    assert shutil.which('magick'),'ImageMagick required for exact TextureSource RGB comparison'
    manifest={r['file']:r['sha256'] for r in json.loads((ROOT/'Data/CharactersMeshy/files.json').read_text())}
    for relative,expected in manifest.items():
        path=ROOT/'Data/CharactersMeshy'/relative
        assert path.exists() and digest(path)==expected,('Retained Meshy source changed',relative)
    protected={str(p.relative_to(ROOT)):digest(p) for p in (ROOT/'Content/ParkComic/Crew').rglob('*')
               if p.is_file() and p.stem!='T_base_color'}
    original_sources={str(p.relative_to(ROOT)):digest(p) for p in (ROOT/'Data/CharactersMeshy').rglob('*') if p.is_file()}
    backup_record_path=ROOT/'Verification/MeshyFaceMipsBackup.json'
    backup_record=json.loads(backup_record_path.read_text()) if backup_record_path.exists() else {'files':{},'backup_directory':'Saved/Recovery/face-mips-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')}
    if APPLY:
        backup=ROOT/backup_record['backup_directory']
        for style in NAMES:
            for path in (ROOT/f'Content/ParkComic/Crew/Resident{style}').glob('T_base_color.*'):
                if not path.is_file():continue
                relative=str(path.relative_to(ROOT));target=backup/relative;target.parent.mkdir(parents=True,exist_ok=True)
                if not target.exists():shutil.copy2(path,target)
                expected=backup_record['files'].get(relative,digest(target));assert digest(target)==expected,('Backup changed',relative)
                backup_record['files'][relative]=expected
        backup_record_path.write_text(json.dumps(backup_record,indent=2)+'\n')
        REPORT['backup_manifest']=str(backup_record_path.relative_to(ROOT))
    for style,name in NAMES.items():
        texture=u.load_asset(f'/Game/ParkComic/Crew/Resident{style}/T_base_color')
        assert isinstance(texture,u.Texture2D),style
        assert texture.get_editor_property('compression_settings')==u.TextureCompressionSettings.TC_BC7,(style,'BC7 changed')
        before=flags(texture);source_rgb=rgb_hash(ROOT/'Data/CharactersMeshy'/name/'base_color.png')
        assert export_rgb(texture,style,'Before')==source_rgb,(style,'Imported TextureSource differs from source')
        mesh=u.load_asset(f'/Game/ParkComic/Crew/Resident{style}/SK_Body')
        nanite_enabled=bool(mesh.get_editor_property('nanite_settings').get_editor_property('enabled'))
        changed=APPLY and (texture.get_editor_property('mip_gen_settings')!=u.TextureMipGenSettings.TMGS_NO_MIPMAPS
                          or not texture.get_editor_property('never_stream') or texture.get_editor_property('lod_bias')!=0)
        if changed:
            texture.set_editor_property('mip_gen_settings',u.TextureMipGenSettings.TMGS_NO_MIPMAPS)
            texture.set_editor_property('never_stream',True)
            texture.set_editor_property('lod_bias',0)
            assert u.EditorAssetLibrary.save_loaded_asset(texture,only_if_is_dirty=False),(style,'Texture save failed')
        after=flags(texture)
        if APPLY:
            assert texture.get_editor_property('mip_gen_settings')==u.TextureMipGenSettings.TMGS_NO_MIPMAPS
            assert texture.get_editor_property('never_stream') and texture.get_editor_property('lod_bias')==0
        assert export_rgb(texture,style,'After')==source_rgb,(style,'TextureSource pixels changed')
        REPORT['characters'].append({'style':style,'name':name,'before':before,'after':after,'changed':changed,
                                     'source_rgb_sha256':source_rgb,'imported_rgb_identical':True,'skeletal_nanite_enabled':nanite_enabled})
    for relative,expected in {**protected,**original_sources}.items():
        assert digest(ROOT/relative)==expected,('Protected source/material/mesh/animation changed',relative)
    REPORT['protected_assets_unchanged']=True
    REPORT['protected_asset_sha256']=protected
    REPORT['retained_sources_unchanged']=True
    REPORT['passed']=True
    OUT.write_text(json.dumps(REPORT,indent=2)+'\n')
    u.log('NORD_MESHY_FACE_MIPS_OK 8 '+('applied' if APPLY else 'probed')+'; original pixels and protected assets unchanged')
except Exception:
    REPORT['error']=traceback.format_exc();OUT.write_text(json.dumps(REPORT,indent=2)+'\n')
    u.log_error('NORD_MESHY_FACE_MIPS_FAILED '+REPORT['error'])
    raise
