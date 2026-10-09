"""Apply the shared comic facade shader to the existing municipal building material."""
from pathlib import Path
import unreal as u
root = Path(u.Paths.project_dir())
mat = u.EditorAssetLibrary.load_asset('/Game/CityBuildings/M_EstimatedFacade')
assert isinstance(mat, u.Material), 'Import municipal models first'
node = u.MaterialEditingLibrary.get_material_property_input_node(mat, u.MaterialProperty.MP_BASE_COLOR)
assert isinstance(node, u.MaterialExpressionCustom), 'Unexpected facade shader graph'
node.set_editor_property('code', (root/'Scripts/city_facade.hlsl').read_text())
u.MaterialEditingLibrary.recompile_material(mat)
assert u.EditorAssetLibrary.save_loaded_asset(mat)
u.log('NORD_CITY_COMIC_OK')
