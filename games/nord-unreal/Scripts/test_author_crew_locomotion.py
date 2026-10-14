"""CPU guards for bounded default-crew graph authoring; no Unreal or native assets."""
import copy
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace as NS

import author_crew_locomotion as author


class Object:
    def __init__(self, path='', **properties):
        self.path, self.properties = path, properties
    def get_path_name(self): return self.path
    def get_editor_property(self, name): return self.properties[name]
    def set_editor_property(self, name, value): self.properties[name] = value


class Mesh(Object): pass
class Clip(Object):
    def get_play_length(self): return self.properties['length']
class Space(Object):
    def __init__(self, path='', **properties):
        axis = Object(display_name='Speed', min=0., max=800., grid_num=16, snap_to_grid=False, wrap_input=False)
        smoothing = Object(interpolation_time=.12, interpolation_type=NS(value=1))
        super().__init__(path, blend_parameters=[axis]*3, interpolation_param=[smoothing]*3, scale_animation=False, target_weight_interpolation_speed_per_sec=0., sample_data=[], **properties)
class Factory(Object): pass


def fixture(root):
    assets, events, loaded = {}, [], set()
    for style in author.STYLES:
        folder=f'{author.CREW}/Resident{style}'
        skeleton=Object(folder+'/SK_Body_Skeleton.SK_Body_Skeleton')
        assets[folder+'/SK_Body']=Mesh(folder+'/SK_Body.SK_Body', skeleton=skeleton)
        for kind in author.KINDS:
            path=folder+'/A_'+kind
            assets[path]=Clip(path+'.A_'+kind, skeleton=skeleton, length=1.2, enable_root_motion=False)
        for name in ('SK_Body','SK_Body_Skeleton',*('A_'+kind for kind in author.KINDS)):
            target=root/'Content/ParkComic/Crew'/f'Resident{style}'/(name+'.uasset')
            target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(('retained:'+str(target)).encode())
    def load(path): loaded.add(path);return assets.get(path)
    def create(name,folder,cls,factory):
        assert len(loaded)==40, 'An asset was created before all eight bodies/four clips were resolved'
        events.append(('create',folder));space=cls(folder+'/'+name+'.'+name,skeleton=factory.properties['target_skeleton'])
        assets[folder+'/'+name]=space;return space
    def configure(space,idle,walk,run):
        events.append(('configure',space.path))
        space.properties['sample_data']=[Object(animation=clip,sample_value=NS(x=speed,y=0.,z=0.),rate_scale=rate,mirror=False,use_single_frame_for_blending=False)
            for clip,speed,rate in zip((idle,walk,run),(0.,450.,800.),(1.,2.,800./600.))]
        return True
    def save(space,**kwargs):
        events.append(('save',space.path));path=root/'Content'/((space.path.split('.',1)[0][len('/Game/'):])+'.uasset')
        path.write_bytes(('new graph:'+space.path).encode());return True
    u=NS(SystemLibrary=NS(get_command_line=lambda:'-NullRHI'), EditorLevelLibrary=NS(get_pie_worlds=lambda _:[]),
        EditorLoadingAndSavingUtils=NS(get_dirty_map_packages=lambda:[],get_dirty_content_packages=lambda:[]),
        UnrealEditorSubsystem=object(), get_editor_subsystem=lambda _:NS(get_editor_world=lambda:Object('/Engine/Maps/Entry.Entry')),
        BlendSpace1D=Space,BlendSpaceFactory1D=Factory,SkeletalMesh=Mesh,AnimSequence=Clip,
        QuebecCrewAnimInstance=NS(configure_crew_blend_space=configure),AssetToolsHelpers=NS(get_asset_tools=lambda:NS(create_asset=create)),
        EditorAssetLibrary=NS(does_asset_exist=lambda path:path in assets,save_loaded_asset=save),load_asset=load,log=lambda message:None)
    return u,assets,events


for defect in ('rendered','candidate','wrong_world','pie','dirty_map','dirty_asset','existing_last_graph','missing_last_clip','last_wrong_rig','last_root_motion','empty_last_clip'):
    with tempfile.TemporaryDirectory() as directory:
        root=Path(directory);u,assets,events=fixture(root);before=author.content_hashes(root)
        last=author.CREW+'/Resident10/A_Jump'
        if defect=='rendered':u.SystemLibrary.get_command_line=lambda:'-vulkan'
        elif defect=='candidate':u.SystemLibrary.get_command_line=lambda:'-NullRHI -NordGraphicNovelCandidate'
        elif defect=='wrong_world':u.get_editor_subsystem=lambda _:NS(get_editor_world=lambda:Object('/Game/Maps/LaFontaine.LaFontaine'))
        elif defect=='pie':u.EditorLevelLibrary.get_pie_worlds=lambda _:[Object()]
        elif defect=='dirty_map':u.EditorLoadingAndSavingUtils.get_dirty_map_packages=lambda:[Object()]
        elif defect=='dirty_asset':u.EditorLoadingAndSavingUtils.get_dirty_content_packages=lambda:[Object()]
        elif defect=='existing_last_graph':assets[author.CREW+'/Resident10/BS_Locomotion']=Space()
        elif defect=='missing_last_clip':del assets[last]
        elif defect=='last_wrong_rig':assets[last].properties['skeleton']=Object('/wrong/rig')
        elif defect=='last_root_motion':assets[last].properties['enable_root_motion']=True
        else:assets[last].properties['length']=0
        try:author.run(u,root)
        except AssertionError:pass
        else:raise AssertionError('Unsafe preflight accepted '+defect)
        assert not events and author.content_hashes(root)==before and not (root/'Saved').exists(), 'Mutation before all prerequisites passed'

with tempfile.TemporaryDirectory() as directory:
    root=Path(directory);u,assets,events=fixture(root);before=author.content_hashes(root)
    result=author.run(u,root)
    assert result['passed'] and not result['fresh_process_readback'] and len(result['characters'])==8
    assert sum(event[0]=='create' for event in events)==sum(event[0]=='save' for event in events)==8
    receipt=next((root/'Saved/Tests/CrewLocomotion').glob('*/Author.json'))
    events.clear();verified=author.run(u,root,True,receipt)
    assert verified['fresh_process_readback'] and not events, 'Fresh verification created/configured/saved an asset'
    _,rows=author.preflight(u,root,True)
    row=rows[0];space=assets[row['path']]
    for defect in ('axis','smoothing','other_clip','sample_speed','cadence','mirror','single_frame','scale_animation','second_filter'):
        baseline=copy.deepcopy(space.properties)
        if defect=='axis':space.properties['blend_parameters'][0].properties['max']=900
        elif defect=='smoothing':space.properties['interpolation_param'][0].properties['interpolation_time']=0
        elif defect=='other_clip':space.properties['sample_data'][0].properties['animation']=rows[1]['clips'][0]
        elif defect=='sample_speed':space.properties['sample_data'][1].properties['sample_value'].x=500
        elif defect=='cadence':space.properties['sample_data'][1].properties['rate_scale']=1
        elif defect=='mirror':space.properties['sample_data'][0].properties['mirror']=True
        elif defect=='single_frame':space.properties['sample_data'][0].properties['use_single_frame_for_blending']=True
        elif defect=='scale_animation':space.properties['scale_animation']=True
        else:space.properties['target_weight_interpolation_speed_per_sec']=3.
        try:author.graph_readback(u,space,row)
        except AssertionError:pass
        else:raise AssertionError('Invalid saved graph accepted '+defect)
        # Restore original object references as well as scalar properties.
        space.properties=baseline
        for sample,clip in zip(space.properties['sample_data'],row['clips']):sample.properties['animation']=clip
        space.properties['skeleton']=row['skeleton']
    after=author.content_hashes(root)
    for defect in ('old_changed','old_removed','extra_asset','missing_graph'):
        broken=dict(after)
        if defect=='old_changed':broken[next(iter(before))]='0'*64
        elif defect=='old_removed':del broken[next(iter(before))]
        elif defect=='extra_asset':broken['Content/unexpected.uasset']='0'*64
        else:del broken[next(iter(author.expected_files()))]
        try:author.preserved(before,broken)
        except AssertionError:pass
        else:raise AssertionError('Unexpected Content mutation accepted '+defect)

print('NORD_CREW_LOCOMOTION_CPU_OK eight new graphs only; all-style preflight, saved graph parameters, no-write verification and full retained Content guards')
