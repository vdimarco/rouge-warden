shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx, cull_disabled;

uniform int surface_kind = 0;
uniform int room = 0;
varying vec3 world_point;
varying vec3 world_normal;

float hash(vec3 p) {
	p = fract(p * .3183099 + vec3(.11,.37,.63)) * 17.0;
	return fract(p.x*p.y*p.z * (p.x+p.y+p.z));
}
float grain(vec3 p) {
	vec3 i = floor(p);
	vec3 f = fract(p);
	f = f*f*(3.0-2.0*f);
	return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),
		mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
		mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
		mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
void vertex() {
	world_point = (MODEL_MATRIX*vec4(VERTEX,1.0)).xyz;
	world_normal = normalize(MODEL_NORMAL_MATRIX*NORMAL);
	if (surface_kind == 5) {
		float sway = sin(TIME*.93 + world_point.x*.71 + world_point.z*.46) * .045;
		VERTEX.x += sway;
		VERTEX.y += sway*.48;
	}
}
void fragment() {
	vec3 p = world_point;
	vec3 n = normalize(world_normal);
	float noise_large = grain(p*1.28);
	float noise_medium = grain(p*5.3);
	float grit = grain(p*26.0);
	vec3 base = COLOR.rgb;
	ROUGHNESS = .78;
	SPECULAR = .32;
	if (surface_kind == 2) {
		float seed = grain(p*7.6)*.50 + grain(p*19.0)*.19 + .38;
		float veins = smoothstep(.06,.24,abs(sin(p.y*25.0 + p.z*31.0 + noise_medium * 2.0)));
		ALBEDO = base * seed;
		EMISSION = base * (seed*1.38 + veins*.20);
		ROUGHNESS = .24;
	} else if (surface_kind == 3) {
		base *= mix(.67,1.27,noise_medium);
		ALBEDO = mix(base, base*vec3(.55,.88,.90),smoothstep(.53,.76,noise_large)*.69);
		METALLIC = .56;
		ROUGHNESS = mix(.26,.66,noise_medium);
	} else if (surface_kind == 4) {
		float bark = grain(p*vec3(18,3.1,18));
		ALBEDO = base * (.49 + bark*.66 + grit*.18);
	} else if (surface_kind == 5) {
		ALBEDO = base * (.78 + noise_medium*.21 + grit*.15);
		BACKLIGHT = base * .35;
		ROUGHNESS = .85;
	} else if (surface_kind == 8) {
		float facing = pow(1.0-abs(dot(normalize(NORMAL),VIEW)),2.4);
		ALBEDO = base * (.59 + noise_medium*.28 + grit*.14);
		EMISSION = base * (.06 + facing*.17);
		SPECULAR = .52;
		ROUGHNESS = .23 + .18*noise_medium;
	} else if (surface_kind == 7) {
		ALBEDO = base * (.76 + noise_large*.23 + grit*.13);
		ROUGHNESS = .65;
		SPECULAR = .37;
	} else {
		float strata = sin(p.y*13.0 + p.x*2.7 + p.z*1.73 + noise_large*6.1)*.5+.5;
		float fissure = (1.0-smoothstep(.010,.032,abs(grain(p*2.4)-.48))) * smoothstep(.50,.73,noise_large);
		float mineral = noise_large*.29 + noise_medium*.17 + grit*.14;
		vec3 stone = base*(.64 + mineral - fissure*.085);
		if (surface_kind == 0) {
			stone *= .80 + smoothstep(.10,.66,noise_large)*.18;
			stone *= mix(vec3(.63,.77,.81),vec3(1),smoothstep(-1.0,.9,p.y));
		}
		if (room == 1) {
			float moss = smoothstep(.52,.77, .34*max(0.0,n.y) + noise_large*.47 + noise_medium*.23);
			stone = mix(stone, vec3(.23,.28,.12)*(.69 + grit*.45),moss*.85);
		}
		if (room == 2 && surface_kind == 6) {
			float frost = smoothstep(.48,.72,n.y*.74+noise_large*.32+noise_medium*.14);
			vec3 drift = vec3(.65,.80,.88)*(.81+grit*.18);
			stone = mix(stone*(.84 + strata*.15),drift,frost);
		}
		ALBEDO = stone;
		ROUGHNESS = mix(.85,.58,mix(noise_large,noise_medium,.44));
		if (room == 0) ROUGHNESS -= .14 + smoothstep(.44,.78,noise_large)*.24;
		if (surface_kind == 1) SPECULAR = .31;
	}
	AO = .82 + noise_medium*.18;
}
