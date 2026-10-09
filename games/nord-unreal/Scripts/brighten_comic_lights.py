"""Make the existing emissive vehicle lamps readable at outdoor exposure."""
import unreal as u
m=u.MaterialEditingLibrary;a=u.EditorAssetLibrary
parent=a.load_asset('/Game/Materials/M_Glow');assert parent
m.delete_all_material_expressions(parent)
tint=m.create_material_expression(parent,u.MaterialExpressionVectorParameter);tint.set_editor_property('parameter_name','Tint')
scale=m.create_material_expression(parent,u.MaterialExpressionMultiply);scale.set_editor_property('const_b',3500.)
assert m.connect_material_expressions(tint,'',scale,'A')
assert m.connect_material_property(scale,'',u.MaterialProperty.MP_EMISSIVE_COLOR)
m.recompile_material(parent);assert a.save_loaded_asset(parent)
u.log('NORD_LAMPS_OK')
