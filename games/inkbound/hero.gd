extends Node3D

const MODEL := "res://art/hero/ashwarden.glb"
const TRAIL := preload("res://shaders/blade_trail.gdshader")
const ATTACK_DURATION := [.24, .24, .31]
const TRAIL_LIFETIME := .145
const STRIKE_ARCS := [
	# Time, blade azimuth/elevation, upper arm X/Y/Z, elbow bend, torso yaw.
	[[0.0,1.12,-.29,.30,.07,.09,.52,0.0],
	 [.055,2.05,.55,-.32,-.37,1.03,.82,-.48],
	 [.102,.42,.24,.98,-.14,1.23,.37,-.06],
	 [.145,-1.42,-.19,1.30,.83,-.20,.44,.63],
	 [.24,-1.05,-.89,.23,.14,-.15,.83,.10]],
	[[0.0,-1.40,-.52,.78,.67,-.31,.78,.42],
	 [.050,-1.82,-.49,.75,.66,-.57,.67,.58],
	 [.107,.23,.28,1.11,.04,.61,.38,-.07],
	 [.155,1.81,.38,.18,-.50,1.32,.40,-.56],
	 [.24,1.05,-.60,.23,.06,.18,.61,-.12]],
	[[0.0,1.30,.50,.48,-.36,.69,.84,-.33],
	 [.071,.57,1.38,2.25,-.34,.53,1.00,-.35],
	 [.122,.01,.53,1.71,-.14,.62,.68,.29],
	 [.171,-.39,-.83,1.16,.46,-.05,.20,.51],
	 [.31,.54,-1.01,.33,.05,.11,.65,.03]],
]

var skeleton: Skeleton3D
var joints: Dictionary[StringName, int] = {}
var trail_mesh := ImmediateMesh.new()
var trail: MeshInstance3D
var trail_samples: Array[Dictionary] = []
var phase := 0.0
var clock := 0.0
var run_weight := 0.0
var turning := 0.0
var landing := 0.0
var jump_age := 1.0
var second_jump := false
var hit_left := 0.0
var dash_weight := 0.0
var attack_index := -1
var attack_age := 0.0
var target: Dictionary[StringName, Vector3] = {}
var last_facing := 0.0

func _ready() -> void:
	var decoder := GLTFDocument.new()
	var gltf := GLTFState.new()
	var err := decoder.append_from_file(MODEL,gltf)
	if err != OK:
		push_error("Ashwarden GLB failed to load (%s)" % error_string(err))
		return
	var model := decoder.generate_scene(gltf)
	add_child(model)
	skeleton = model.find_children("*","Skeleton3D",true,false)[0] as Skeleton3D
	for i in range(skeleton.get_bone_count()):
		joints[skeleton.get_bone_name(i)] = i
	var finish := ShaderMaterial.new()
	finish.shader = TRAIL
	trail = MeshInstance3D.new()
	trail.name = "BladeTrail"
	trail.mesh = trail_mesh
	trail.material_override = finish
	trail.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	trail.top_level = true
	trail.physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_OFF
	add_child(trail)
	trail.global_transform = Transform3D.IDENTITY

func play_jump(air: bool) -> void:
	jump_age = 0.0
	second_jump = air

func play_land(speed: float) -> void:
	landing = clampf((speed-1.6)/15.0,.12,.94)

func play_hurt() -> void:
	hit_left = .25

func play_strike(chain: int) -> void:
	attack_index = clampi(chain-1,0,2)
	attack_age = 0.0
	if not trail_samples.is_empty():
		trail_samples.back()["break"] = true

func cancel_strike() -> void:
	attack_index = -1
	if not trail_samples.is_empty():
		trail_samples.back()["break"] = true

func reset_pose() -> void:
	if not is_instance_valid(skeleton):
		return
	phase = 0.0
	run_weight = 0.0
	dash_weight = 0.0
	turning = 0.0
	landing = 0.0
	hit_left = 0.0
	jump_age = 1.0
	attack_index = -1
	trail_samples.clear()
	trail_mesh.clear_surfaces()
	skeleton.reset_bone_poses()
	last_facing = rotation.y

func bend(joint: StringName, x: float, y := 0.0, z := 0.0) -> void:
	target[joint] = Vector3(x,y,z)

func ankle(side: String, rise: float, reach: float, toes: float) -> void:
	var upper := .354
	var lower := .343
	var distance := clampf(Vector2(rise,reach).length(),.19,upper+lower-.002)
	var pitch := atan2(-reach,-rise)
	var thigh := pitch + acos(clampf((upper*upper+distance*distance-lower*lower)/(2.0*upper*distance),-1.0,1.0))-.082
	var shin := acos(clampf((distance*distance-upper*upper-lower*lower)/(2.0*upper*lower),-1.0,1.0))
	# Thigh and calf bend along the same plane, and the ankle counter-rotates onto the stone.
	bend("Thigh_"+side,thigh)
	bend("Shin_"+side,-shin+.155)
	bend("Foot_"+side,toes-thigh+shin-.155)

func motion(dt: float, velocity: Vector3, facing: Vector3, grounded: bool, dashing: bool) -> void:
	if not is_instance_valid(skeleton):
		return
	clock += dt
	jump_age += dt
	hit_left = maxf(0.0,hit_left-dt)
	var planar := Vector2(velocity.x,velocity.z).length()
	var desired_yaw := atan2(-facing.x,-facing.z)
	rotation.y = lerp_angle(rotation.y,desired_yaw,1.0-exp(-dt*(31.0 if dashing or attack_index >= 0 else 22.0)))
	var spin := angle_difference(last_facing,rotation.y) / maxf(.001,dt)
	turning = lerpf(turning,clampf(spin*.047,-.35,.35),1.0-exp(-dt*13.0))
	last_facing = rotation.y
	var pace := clampf(planar/8.6,0.0,1.0)
	run_weight = lerpf(run_weight,pace if grounded and not dashing else 0.0,1.0-exp(-dt*14.0))
	dash_weight = lerpf(dash_weight,1.0 if dashing else 0.0,1.0-exp(-dt*(35.0 if dashing else 15.0)))
	var impact := landing
	landing = maxf(0.0,landing-dt*4.8)
	var w := run_weight
	if planar > .08 and grounded:
		phase = fposmod(phase+dt*lerpf(1.24,3.36,w),1.0)
	var twist := cos(phase*TAU)*w
	var root_height := -.039*w+.033*absf(cos(phase*TAU))*w-.113*impact-.175*dash_weight
	if not grounded:
		root_height += .040*clampf(velocity.y/8.0,-.35,1.0)
	var recoil := hit_left/.25
	root_height -= .060*recoil
	target.clear()
	var pelvis_pitch := -.07*w-.12*impact-.17*dash_weight
	bend("Pelvis",pelvis_pitch,.14*twist,turning*.25)
	bend("Chest",-.13*w-.25*dash_weight-.11*impact+.29*recoil,-.24*twist,turning*.60)
	bend("Head",.11*w+.21*dash_weight, .05+.06*sin(clock*.9),-turning*.33)
	var blade_azimuth := 1.02+.14*twist + dash_weight*.70
	var blade_elevation := -.28 + .19*twist - .32*dash_weight
	for i in range(2):
		var side := "L" if i==0 else "R"
		var sign_ := -1.0 if i==0 else 1.0
		var t := fposmod(phase + i*.5,1.0)
		var stride := .48*w
		var reach := 0.0
		var lift := 0.0
		var toes := 0.0
		if t < .40:
			reach = lerpf(-stride,stride,t/.40)
			toes = -.22*w*smoothstep(.28,.40,t)
		else:
			var swing := (t-.40)/.60
			reach = lerpf(stride,-stride,smoothstep(.0,1.0,swing))
			lift = sin(swing*PI)*.265*w
			toes = lerpf(-.29,.17,swing)*w
		reach += sign_*.04*(1.0-w)
		if not grounded:
			var up := clampf(velocity.y/8.4,-1.0,1.0)
			var tuck := .16 + maxf(0.0,up)*.10
			lift = tuck+sign_*.065
			reach = sign_*(.18 + maxf(0.0,up)*.10)
			if jump_age < .26 and second_jump:
				lift += .18*sin(jump_age/.26*PI)
				reach = -reach * .77
			toes = -.24-.31*maxf(0.0,up)
		lift = lerpf(lift,.07+(.060 if i==1 else 0.0),dash_weight)
		reach = lerpf(reach,sign_*.44,dash_weight)
		toes = lerpf(toes,-.42 if i==1 else .10,dash_weight)
		var ankle_target := Vector3(0,-.687-root_height+lift,reach).rotated(Vector3.RIGHT,-pelvis_pitch)
		ankle(side,ankle_target.y,ankle_target.z,toes-pelvis_pitch)
		var arm_swing := -sin(t*TAU+.64)*w
		bend("Upper_arm_"+side, .14+.59*arm_swing + (.32 if not grounded else 0.0) - dash_weight*sign_*.55,
			sign_*.055, sign_*(.18+.07*w+.18*dash_weight))
		bend("Forearm_"+side,.32+w*.20+maxf(0.0,arm_swing)*.33 + dash_weight*.42, sign_*.06)
		bend("Hand_"+side,.06,0.0,sign_*.10)
		bend("Coat_"+side,-.22*w-.27*dash_weight+.08*arm_swing,.06*arm_swing,sign_*.07*arm_swing)
		bend("Hem_"+side,-.12*w + .11*arm_swing + .07*sin(clock*11+i),turning*.35)
	for i in range(6):
		var wave := clock*(6.6+w*4.3)-i*.78
		var sag := .12*(1.0-w-dash_weight*.6)
		var lift := .18*w+.17*dash_weight
		bend("Scarf_%d" % i, sag-lift+ .09*sin(wave) + (.19 if i==0 else .0),
			turning*.49 + .075*sin(wave*.68),.055*sin(wave+.83))
	var active_trail := false
	if attack_index >= 0:
		attack_age += dt
		var length: float = ATTACK_DURATION[attack_index]
		var arc: Array = STRIKE_ARCS[attack_index]
		var state := sample_arc(arc,attack_age)
		var blend := smoothstep(0.0,.026,attack_age)*(1.0-smoothstep(length-.06,length,attack_age))
		blade_azimuth = lerpf(blade_azimuth,state[0],blend)
		blade_elevation = lerpf(blade_elevation,state[1],blend)
		blend_joint("Upper_arm_R",Vector3(state[2],state[3],state[4]),blend)
		blend_joint("Forearm_R",Vector3(state[5],-.22,-.09),blend)
		blend_joint("Upper_arm_L",Vector3(-.48,-.17,-.48),blend*.82)
		blend_joint("Chest",Vector3(-.105 if attack_index<2 else -.30,state[6],state[6]*.21),blend)
		blend_joint("Pelvis",Vector3(-.095,state[6]*.46,.13),blend*.60)
		active_trail = attack_age >= (.065 if attack_index<2 else .092) and attack_age <= (.156 if attack_index<2 else .192)
		if attack_age >= length:
			attack_index = -1
	var pose_amount := 1.0-exp(-dt*(55.0 if attack_index>=0 or dashing else 31.0))
	for key in target:
		var index := joints[key]
		var pose := Quaternion.from_euler(target[key])
		skeleton.set_bone_pose_rotation(index,skeleton.get_bone_pose_rotation(index).slerp(pose,pose_amount))
	var root := joints[&"Root"]
	var root_pose := skeleton.get_bone_pose_position(root)
	skeleton.set_bone_pose_position(root,root_pose.lerp(Vector3(0,root_height,0),pose_amount))
	aim_blade(blade_azimuth,blade_elevation,pose_amount)
	update_trail(active_trail)

func blend_joint(joint: StringName, pose: Vector3, weight: float) -> void:
	target[joint] = target[joint].lerp(pose,weight)

func sample_arc(keys: Array, age: float) -> PackedFloat32Array:
	var sample := PackedFloat32Array()
	sample.resize(7)
	for i in range(1,keys.size()):
		var a: Array = keys[i-1]
		var b: Array = keys[i]
		if age <= float(b[0]) or i == keys.size()-1:
			var t := smoothstep(float(a[0]),float(b[0]),age)
			for j in range(7):
				sample[j] = lerpf(a[j+1],b[j+1],t)
			break
	return sample

func aim_blade(azimuth: float, elevation: float, amount: float) -> void:
	var blade := joints[&"Weapon"]
	var up := Vector3(sin(azimuth)*cos(elevation),sin(elevation),-cos(azimuth)*cos(elevation))
	var right := Vector3.UP.cross(up).normalized()
	var target_basis := Basis(right,up,right.cross(up))
	var wrist := skeleton.get_bone_global_pose(joints[&"Hand_R"]).basis
	var orientation := (wrist.inverse()*target_basis).orthonormalized().get_rotation_quaternion()
	var pose := skeleton.get_bone_pose_rotation(blade)
	skeleton.set_bone_pose_rotation(blade,pose.slerp(orientation,amount))

func update_trail(active: bool) -> void:
	while not trail_samples.is_empty() and clock-float(trail_samples[0].time) > TRAIL_LIFETIME:
		trail_samples.pop_front()
	if active:
		var blade := skeleton.global_transform*skeleton.get_bone_global_pose(joints[&"Weapon"])
		trail_samples.append({
			"base": blade*Vector3(0,.57,0),
			"tip": blade*Vector3(-.027,1.085,0),
			"time": clock,
			"break": false,
		})
	trail_mesh.clear_surfaces()
	if trail_samples.size() < 2:
		return
	var open := false
	for i in range(1,trail_samples.size()):
		var a := trail_samples[i-1]
		var b := trail_samples[i]
		if a["break"]:
			continue
		if not open:
			trail_mesh.surface_begin(Mesh.PRIMITIVE_TRIANGLES)
			open = true
		var before := trail_samples[i-2] if i > 1 and not trail_samples[i-2]["break"] else a
		var after := trail_samples[i+1] if i+1 < trail_samples.size() and not b["break"] else b
		var start := a
		for step in range(1,5):
			var t := float(step)/4.0
			var end := {
				"base": (a.base as Vector3).cubic_interpolate(b.base,before.base,after.base,t),
				"tip": (a.tip as Vector3).cubic_interpolate(b.tip,before.tip,after.tip,t),
				"time": lerpf(a.time,b.time,t),
			}
			trail_vertex(start,false)
			trail_vertex(end,false)
			trail_vertex(end,true)
			trail_vertex(start,false)
			trail_vertex(end,true)
			trail_vertex(start,true)
			start = end
	if open:
		trail_mesh.surface_end()

func trail_vertex(sample: Dictionary, tip: bool) -> void:
	var life := clampf(1.0-(clock-float(sample.time))/TRAIL_LIFETIME,0.0,1.0)
	trail_mesh.surface_set_color(Color(1,1,1,.65*life*life))
	trail_mesh.surface_set_uv(Vector2(life,1.0 if tip else 0.0))
	trail_mesh.surface_add_vertex(sample.tip if tip else sample.base)
