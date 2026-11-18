shader_type spatial;
render_mode specular_schlick_ggx;

varying vec3 world_point;
float drift(vec2 p) {
	return sin(p.x*2.1 + p.y*.51 + TIME*.84)*.047
		+sin(p.y*1.68-p.x*.64-TIME*1.03)*.035
		+sin(p.y*3.71+p.x*2.74+TIME*1.40)*.012
		+cos(p.x*1.2-p.y*.66+TIME*.56)*.056;
}
void vertex() {
	world_point = (MODEL_MATRIX*vec4(VERTEX,1)).xyz;
	VERTEX.y += drift(world_point.xz);
}
void fragment() {
	vec2 p=world_point.xz;
	float wave=drift(p);
	vec3 n=normalize(vec3(wave-drift(p+vec2(.048,0)),.048,wave-drift(p+vec2(0,.048))));
	NORMAL=normalize((VIEW_MATRIX*vec4(n,0)).xyz);
	float facing=pow(1.0-clamp(dot(NORMAL,VIEW),0.0,1.0),2.65);
	float current=sin(p.y*2.7 + p.x*.4 + wave*10.0 + TIME*.53)*.5+.5;
	float pane=exp(-pow((p.x-6.35+wave*6.0)*.67,2.0))*(.32+.68*pow(.5+.5*cos((p.y-1.8)*1.296+wave*4.2),5.0));
	float floor_fade=smoothstep(-30.0,-14.0,p.y);
	vec3 dark=vec3(.012,.043,.061);
	vec3 sheen=vec3(.075,.161,.209);
	ALBEDO=mix(dark,sheen,(.17+facing*.48) * (.71+current*.36));
	EMISSION=(vec3(.060,.205,.224)*pane*(.22+.78*floor_fade) + sheen*.045)*(current*.74+.28);
	ROUGHNESS=.25;
	METALLIC=.45;
}
