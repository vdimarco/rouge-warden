"""CPU mock/preflight and pose-gate checks; no Unreal or Content writes."""
import copy
import importlib.util
import math
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace as NS
from unittest.mock import patch

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('private_native_trial', Path(__file__).with_name('native_trial.py'))
n = importlib.util.module_from_spec(spec); spec.loader.exec_module(n)


def reject(fn):
    try: fn()
    except AssertionError: return
    raise AssertionError('Unsafe operation accepted')


def unreal(root):
    attrs = {key: type(key, (), {}) for key in ('AnimSequence','SkeletalMesh','AssetImportTask','FbxImportUI','FbxFactory',
        'FBXImportType','AnimPoseEvaluationOptions','AnimDataEvalType','AnimPoseSpaces')}
    editor = object()
    return NS(**attrs, Paths=NS(project_dir=lambda: str(root)),
        SystemLibrary=NS(get_command_line=lambda: '-NullRHI -NordGraphicNovelCandidate -NordGraphicNovelGenerated -NordGraphicNovelHighDetail'),
        EditorLevelLibrary=NS(get_pie_worlds=lambda unused: []), UnrealEditorSubsystem=editor,
        get_editor_subsystem=lambda cls: NS(get_editor_world=lambda: NS(get_path_name=lambda:n.ENTRY)),
        EditorLoadingAndSavingUtils=NS(get_dirty_map_packages=lambda:[], get_dirty_content_packages=lambda:[]),
        AssetToolsHelpers=NS(get_asset_tools=lambda: NS()), load_asset=lambda path: object(),
        AnimationLibrary=NS(**{key: lambda *args: None for key in ('get_num_frames','get_num_keys','get_animation_track_names')}),
        AnimPoseExtensions=NS(**{key: lambda *args: None for key in ('get_anim_pose_at_time','get_reference_pose','get_bone_names','get_bone_pose','is_valid')}))


def preflights():
    with tempfile.TemporaryDirectory(prefix='nord-jump-mocks-',dir='/tmp') as directory:
        root=Path(directory);backup=root/'Saved/Recovery/new'
        with patch.object(n,'cpu_gate',return_value=([],{})), patch.object(n,'sha',return_value=n.ORIGINAL_SHA), \
             patch.object(n,'metadata',return_value=({'source_sha256':n.RAW_JUMP_SHA},{})), \
             patch.object(n,'pose_snapshot',return_value={}), patch.object(n,'content',return_value={n.TARGET:n.ORIGINAL_SHA}):
            n.preflight(unreal(root),root,backup)
            for bad in ('rendered','flags','PIE','map','dirty_map','dirty_content','project','outside','stale','CPU','assetSHA','API','poseAPI','metadata','pose'):
                u=unreal(root);b=backup; patches=[]
                if bad=='rendered':u.SystemLibrary.get_command_line=lambda:'-NordGraphicNovelCandidate -NordGraphicNovelGenerated -NordGraphicNovelHighDetail'
                elif bad=='flags':u.SystemLibrary.get_command_line=lambda:'-NullRHI -NordGraphicNovelCandidate -NordGraphicNovelGenerated'
                elif bad=='PIE':u.EditorLevelLibrary.get_pie_worlds=lambda unused:[object()]
                elif bad=='map':u.get_editor_subsystem=lambda cls:NS(get_editor_world=lambda:NS(get_path_name=lambda:'/Game/Maps/LaFontaine.LaFontaine'))
                elif bad=='dirty_map':u.EditorLoadingAndSavingUtils.get_dirty_map_packages=lambda:[object()]
                elif bad=='dirty_content':u.EditorLoadingAndSavingUtils.get_dirty_content_packages=lambda:[object()]
                elif bad=='project':u.Paths.project_dir=lambda:str(root/'wrong')
                elif bad=='outside':b=root/'Content/unsafe'
                elif bad=='stale':b=root/'Saved/Recovery/stale';b.mkdir(parents=True)
                elif bad=='CPU':patches.append(patch.object(n,'cpu_gate',side_effect=AssertionError('gate missing/failed')))
                elif bad=='assetSHA':patches.append(patch.object(n,'sha',return_value='changed'))
                elif bad=='API':u.AnimSequence=None
                elif bad=='poseAPI':u.AnimPoseExtensions.get_anim_pose_at_time=None
                elif bad=='metadata':patches.append(patch.object(n,'metadata',side_effect=AssertionError('bad skeleton/source/rate')))
                elif bad=='pose':patches.append(patch.object(n,'pose_snapshot',side_effect=AssertionError('endpoint/pose readback failed')))
                for p in patches:p.start()
                try:reject(lambda:n.preflight(u,root,b))
                finally:
                    for p in reversed(patches):p.stop()
                assert not (backup/'backup-manifest.json').exists()


def poses():
    cpu_names=['LeftArm','RightArm',*('Bone'+str(i) for i in range(22))]
    names=[*cpu_names,n.IMPORT_ROOT]
    rest={name:{'translation':[0.,0.,0.],'scale':[1.,1.,1.],'rotation':[0.,0.,0.,1.]} for name in names}
    rest[n.IMPORT_ROOT]['rotation']=[0.,-math.sqrt(.5),0.,math.sqrt(.5)]
    old={'names':names,'reference_pose':rest,'samples':[{'seconds':i/30.,'bones':copy.deepcopy(rest)} for i in range(37)]}
    new=copy.deepcopy(old)
    for name in n.ARMS:new['samples'][12]['bones'][name]['rotation']=[0.,0.,math.sin(.25),math.cos(.25)]
    assert n.compare_poses(old,new)['sample_frames']==37
    assert n.compare_poses(new,new,False)['bones']==25
    for field,value in [('translation',[.01,0,0]),('scale',[1.01,1,1]),('rotation',[0,0,.1,math.sqrt(.99)])]:
        bad=copy.deepcopy(new);bad['samples'][12]['bones']['Bone0'][field]=value;reject(lambda:n.compare_poses(old,bad))
    reject(lambda:n.compare_poses(old,old))
    bad=copy.deepcopy(new);bad['reference_pose']['LeftArm']['translation'][0]=1;reject(lambda:n.compare_poses(old,bad))
    class Options:
        def __init__(self):self.props={}
        def set_editor_property(self,key,value):self.props[key]=value
    def t(row):return NS(translation=NS(**dict(zip('xyz',row['translation']))),scale3d=NS(**dict(zip('xyz',row['scale']))),rotation=NS(**dict(zip('xyzw',row['rotation']))))
    calls=[]
    def evaluate(clip,time,options):
        assert options.props['evaluation_type']==1 and options.props['should_retarget'] is False and options.props['extract_root_motion'] is False
        calls.append(time);return new['samples'][round(time*30)]['bones']
    u=NS(AnimationLibrary=NS(get_animation_track_names=lambda clip:[name.lower() for name in names]),AnimPoseEvaluationOptions=Options,
         AnimDataEvalType=NS(RAW=1),AnimPoseSpaces=NS(LOCAL=0),
         AnimPoseExtensions=NS(get_reference_pose=lambda skeleton:rest,is_valid=lambda pose:True,get_bone_names=lambda pose:list(pose),
             get_bone_pose=lambda pose,name,space:t(pose[name]),get_anim_pose_at_time=evaluate))
    body=NS(get_editor_property=lambda key:object())
    got=n.pose_snapshot(u,object(),body,cpu_names);assert len(calls)==37 and len(got['samples'])==37 and got['import_root']=='Armature'
    assert len(got['names'])==25 and got['cpu_names']==cpu_names and got['native_track_spellings']==[name.lower() for name in names]
    for bad in (names[:-1],names+['Unexpected'],[*names[:-1],'Unexpected'],['LEFTARM',*names[1:]],names[:-2]+['BONE0','Armature']):
        # A case-only spelling is valid, but collisions are not.
        if len(bad)==25 and len({name.casefold() for name in bad})==25 and {name.casefold() for name in bad}=={name.casefold() for name in names}:
            assert n.native_inventory(bad,names)==bad
        else:reject(lambda bad=bad:n.native_inventory(bad,names))
    u.AnimationLibrary.get_animation_track_names=lambda clip:names[:-1]
    reject(lambda:n.pose_snapshot(u,object(),body,cpu_names))
    u.AnimationLibrary.get_animation_track_names=lambda clip:[name.lower() for name in names]
    for key,value in [('translation',[.01,0.,0.]),('scale',[1.01,1.,1.]),('rotation',[0.,0.,0.,1.])]:
        saved=new['samples'][18]['bones']['Armature'][key]
        new['samples'][18]['bones']['Armature'][key]=value
        reject(lambda:n.pose_snapshot(u,object(),body,cpu_names))
        new['samples'][18]['bones']['Armature'][key]=saved
    new['samples'][0]['bones']['LeftArm']['translation'][0]=1;reject(lambda:n.pose_snapshot(u,object(),body,cpu_names))
    new['samples'][0]['bones']['LeftArm']['translation'][0]=float('nan');reject(lambda:n.pose_snapshot(u,object(),body,cpu_names))


def package_delta():
    old={n.TARGET:'original','Content/Maps/LaFontaine.umap':'map','Content/Other.uasset':'other'}
    new={**old,n.TARGET:'trial'};assert n.delta(old,new)==[n.TARGET]
    for changed in (old,{**new,'Content/Other.uasset':'bad'},{**new,'Content/New.uasset':'bad'}, {n.TARGET:'trial'}):reject(lambda:n.delta(old,changed))


if __name__=='__main__':
    preflights();poses();package_delta()
    print('PRIVATE_JUMP_NATIVE_CPU_OK:15preflight rejections;37x24local poses+staticArmature;strictFNameinventory/endpoint/finite/rootTRS guards;arms-only delta;exactprivatepackage')
