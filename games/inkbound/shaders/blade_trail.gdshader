shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never, blend_add, shadows_disabled;
void fragment() {
	float ribbon = smoothstep(.06,.80,UV.y) * (1.0-smoothstep(.95,1.0,UV.y));
	ALBEDO = mix(vec3(.10,.56,.58),vec3(.79,1.0,.91),pow(UV.y,4.0));
	ALPHA = COLOR.a * ribbon;
}
