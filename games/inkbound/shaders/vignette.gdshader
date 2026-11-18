shader_type canvas_item;
void fragment() {
	vec2 uv=UV*2.0-1.0;
	float edge=smoothstep(.25,1.71,dot(uv,uv));
	float bottom=smoothstep(.83,1.0,UV.y)*.34;
	float top=(1.0-smoothstep(0.0,.18,UV.y))*.34;
	COLOR=vec4(.014,.023,.035,edge*.34 + max(bottom,top)*(1.0-edge*.14));
}
