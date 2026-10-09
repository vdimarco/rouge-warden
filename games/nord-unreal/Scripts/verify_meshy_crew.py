"""Fresh-process checks for saved skeletal meshes, materials and animation dependencies."""
import json
from pathlib import Path
import unreal as u
root=Path(u.Paths.project_dir()).resolve();report=[]
for style in range(3,11):
    folder=f'/Game/ParkComic/Crew/Resident{style}'
    mesh=u.load_asset(folder+'/SK_Body');assert isinstance(mesh,u.SkeletalMesh),style
    skeleton=mesh.get_editor_property('skeleton');assert skeleton and u.EditorAssetLibrary.does_asset_exist(skeleton.get_path_name())
    bounds=mesh.get_bounds();assert 165<bounds.box_extent.z*2<205,(style,bounds)
    slots=mesh.get_editor_property('materials');assert slots
    for slot in slots:
        material=slot.material_interface;assert material and material.get_path_name().startswith(folder+'/M_Crew')
        node=u.MaterialEditingLibrary.get_material_property_input_node(material,u.MaterialProperty.MP_BASE_COLOR)
        assert node and node.get_editor_property('texture') and node.get_editor_property('texture').get_path_name().startswith(folder+'/T_base_color')
    for name in ('A_Walk','A_Idle'):
        clip=u.load_asset(folder+'/'+name)
        assert isinstance(clip,u.AnimSequence) and clip.get_editor_property('skeleton')==skeleton and clip.get_play_length()>.1
    report.append({'style':style,'height_cm':round(bounds.box_extent.z*2,1),'material_slots':len(slots),'saved_skeleton':skeleton.get_path_name()})
for prop in ('Plunger','PVCTube'):
    assert isinstance(u.load_asset('/Game/ParkComic/Crew/SM_'+prop),u.StaticMesh)
(root/'Verification/MeshyAssets.json').write_text(json.dumps({'passed':True,'characters':report},indent=2)+'\n')
u.log('NORD_MESHY_ASSETS_OK '+str(len(report)))
