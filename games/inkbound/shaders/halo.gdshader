shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, shadows_disabled;

uniform vec4 tint : source_color = vec4(1,.58,.22,1);
uniform float strength = .32;
void vertex() {
	MODELVIEW_MATRIX=VIEW_MATRIX*mat4(INV_VIEW_MATRIX[0],INV_VIEW_MATRIX[1],INV_VIEW_MATRIX[2],MODEL_MATRIX[3]);
}
void fragment() {
	float r=length(UV-.5)*2.0;
	float edge=clamp(1.0-r,0.0,1.0);
	ALBEDO=tint.rgb;
	ALPHA=pow(edge,2.6)*strength*(.93 + .07*sin(TIME*6.3+VERTEX.x));
}
