"""Persist Nanite material support so detailed trees also render in game mode."""
import unreal as u
assets = u.EditorAssetLibrary
paths = ['/Game/Art/M_DetailedAutumnLeaves',
         '/Game/Art/Tree/tree_small_02/Materials/tree_small_02_branches',
         '/Game/Art/Tree/tree_small_02/Materials/tree_small_02_trunk']
for path in paths:
    mat = assets.load_asset(path)
    assert isinstance(mat, (u.Material, u.MaterialInstanceConstant)), path
    if isinstance(mat, u.Material):
        u.MaterialEditingLibrary.set_base_material_usage(mat, u.MaterialUsage.MATUSAGE_NANITE, True)
        u.MaterialEditingLibrary.recompile_material(mat)
    else:
        u.MaterialEditingLibrary.set_material_usage_override(mat, u.MaterialUsage.MATUSAGE_NANITE, True, True)
        u.MaterialEditingLibrary.update_material_instance(mat)
    assert u.MaterialEditingLibrary.has_material_usage(mat, u.MaterialUsage.MATUSAGE_NANITE), path
    assert assets.save_loaded_asset(mat)
u.log('NORD_TREE_USAGE_OK')
