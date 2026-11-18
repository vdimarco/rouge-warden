shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, shadows_disabled;

uniform vec4 tint : source_color = vec4(.40,.74,.75,1);
uniform float strength = .13;
void fragment() {
	float across=1.0-abs(UV.x-.5)*2.0;
	float ribbon=pow(max(across,0.0),2.4);
	float along=smoothstep(0.0,.12,UV.y)*(1.0-smoothstep(.48,1.0,UV.y));
	float drift=.73 + .27 * sin(UV.y*24.0 + UV.x*14.0 + TIME*.64) * sin(UV.x*23.0 - TIME*.17);
	ALBEDO=tint.rgb;
	ALPHA=ribbon*along*drift*strength;
}
