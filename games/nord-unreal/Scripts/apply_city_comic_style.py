"""Apply the shared comic facade shader to the existing municipal building material."""
from pathlib import Path
import unreal as u
root = Path(u.Paths.project_dir())
mat = u.EditorAssetLibrary.load_asset('/Game/CityBuildings/M_EstimatedFacade')
assert isinstance(mat, u.Material), 'Import municipal models first'
node = u.MaterialEditingLibrary.get_material_property_input_node(mat, u.MaterialProperty.MP_BASE_COLOR)
assert isinstance(node, u.MaterialExpressionCustom), 'Unexpected facade shader graph'
node.set_editor_property('code', (root/'Scripts/city_facade.hlsl').read_text())
inputs=list(node.get_editor_property('inputs'))
for name,cls in (('Center',u.MaterialExpressionObjectPositionWS),('Bounds',u.MaterialExpressionObjectBounds),('Position',u.MaterialExpressionWorldPosition)):
    if name not in [str(entry.get_editor_property('input_name')) for entry in inputs]:
        entry=u.CustomInput();entry.set_editor_property('input_name',name);inputs.append(entry)
node.set_editor_property('inputs',inputs)
for name,cls in (('Center',u.MaterialExpressionObjectPositionWS),('Bounds',u.MaterialExpressionObjectBounds),('Position',u.MaterialExpressionWorldPosition)):
    # Reuse connected inputs so repeated refreshes do not grow the material graph.
    index=[str(entry.get_editor_property('input_name')) for entry in inputs].index(name)
    connected=u.MaterialEditingLibrary.get_inputs_for_material_expression(mat,node)
    if not connected[index]:
        source=u.MaterialEditingLibrary.create_material_expression(mat,cls)
        assert u.MaterialEditingLibrary.connect_material_expressions(source,'',node,name)
u.MaterialEditingLibrary.recompile_material(mat)
assert u.EditorAssetLibrary.save_loaded_asset(mat)
u.log('NORD_CITY_COMIC_OK')
