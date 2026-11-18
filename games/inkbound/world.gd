extends Node3D

const Scenery := preload("res://scenery.gd")
const Hero := preload("res://hero.gd")
const GLOWS = [Color("#62f1df"), Color("#d9ee83"), Color("#86cfff")]
const FOGS = [Color("#172e3a"),Color("#515f4e"),Color("#68899e")]
const SKY_TOPS = [Color("#0b1723"),Color("#3e5941"),Color("#405a73")]
const SUNS = [Color("#c3e7ee"),Color("#ffdfa2"),Color("#def1ff")]
const AMBIENT = [Color("#93b2d2"),Color("#b7c993"),Color("#acc5df")]
const KEY_LIGHT = [.80,1.11,.71]
const FOG_DENSITY = [.039,.034,.036]

var course: Dictionary
var body := CharacterBody3D.new()
var pivot := Node3D.new()
var arm := SpringArm3D.new()
var camera := Camera3D.new()
var avatar := Hero.new()
var moon := DirectionalLight3D.new()
var sky_finish := ProceduralSkyMaterial.new()
var env := Environment.new()
var zone := 0
var room_roots: Array[Node3D] = []
var hp := 5
var sigils := 0
var yaw := 0.0
var pitch := -0.25
var look := Vector3.FORWARD
var dash_dir := Vector3.FORWARD
var dash_left := 0.0
var dash_cool := 0.0
var dash_buffer := 0.0
var jump_buffer := 0.0
var coyote := 0.0
var air_jump := true
var hurt := 0.0
var attack_left := 0.0
var attack_buffer := 0.0
var attack_pending := false
var chain := 0
var chain_left := 0.0
var cleared := [false,false,false]
var enemies: Array[Dictionary] = []
var shrine_nodes: Array[Node3D] = []
var gate_lights: Array[OmniLight3D] = []
var effects: Array[Dictionary] = []
var hud: Label
var prompt: Label
var controls_help: Label
var progress: Label
var banner: Label
var banner_time := 5.0
var victory := false
var elapsed := 0.0
var help_pinned := false
var rng := RandomNumberGenerator.new()

func v(values: Array) -> Vector3:
	return Vector3(values[0], values[1], values[2])

func cube(parent: Node3D, at: Vector3, size: Vector3, material: Material) -> MeshInstance3D:
	var mesh := BoxMesh.new()
	mesh.size = size
	return Scenery.place(parent,mesh,at,material)

func light_at(at: Vector3, color: Color, power: float, radius: float) -> OmniLight3D:
	var lamp := OmniLight3D.new()
	lamp.position = at
	lamp.light_color = color
	lamp.light_energy = power
	lamp.omni_range = radius
	room_roots.back().add_child(lamp)
	return lamp

func _ready() -> void:
	rng.seed = 583
	course = JSON.parse_string(FileAccess.get_file_as_string("res://art/course.json"))
	var world_environment := WorldEnvironment.new()
	world_environment.environment = env
	add_child(world_environment)
	var sky := Sky.new()
	sky.sky_material = sky_finish
	env.sky = sky
	env.background_mode = Environment.BG_SKY
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_sky_contribution = .0
	env.ambient_light_color = AMBIENT[0]
	env.ambient_light_energy = .76
	env.fog_enabled = true
	env.fog_light_color = FOGS[0]
	env.fog_density = FOG_DENSITY[0]
	env.fog_sky_affect = .40
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	moon.rotation_degrees = Vector3(-41,-52,0)
	moon.light_color = SUNS[0]
	moon.light_energy = KEY_LIGHT[0]
	moon.shadow_enabled = true
	moon.directional_shadow_max_distance = 34
	moon.shadow_blur = 1.2
	add_child(moon)
	update_atmosphere(1.0)
	Scenery.water(self)
	for i in range(3):
		make_zone(i)
	show_active_room()
	make_player()
	make_hud()
	banner.text = course.zoneNames[0]
	if DisplayServer.get_name() != "headless":
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func update_atmosphere(amount: float) -> void:
	env.fog_light_color = env.fog_light_color.lerp(FOGS[zone],amount)
	env.fog_density = lerpf(env.fog_density,FOG_DENSITY[zone],amount)
	env.ambient_light_color = env.ambient_light_color.lerp(AMBIENT[zone],amount)
	env.ambient_light_energy = lerpf(env.ambient_light_energy,[.48,.68,.66][zone],amount)
	moon.light_color = moon.light_color.lerp(SUNS[zone],amount)
	moon.light_energy = lerpf(moon.light_energy,KEY_LIGHT[zone],amount)
	var horizon: Color = FOGS[zone]
	if sky_finish.sky_top_color != SKY_TOPS[zone] or sky_finish.sky_horizon_color != horizon:
		sky_finish.sky_top_color = SKY_TOPS[zone]
		sky_finish.sky_horizon_color = horizon
		sky_finish.ground_horizon_color = horizon
		sky_finish.ground_bottom_color = horizon.darkened(.46)

func make_zone(index: int) -> void:
	var room := Node3D.new()
	room.name = course.zoneNames[index]
	add_child(room)
	room_roots.append(room)
	Scenery.room_mesh(room,index)
	var lantern_tint := Color("#f6a462")
	for block in course.blocks[index]:
		var center := v(block)
		var size := Vector3(block[3],block[4],block[5])
		var top := center.y + size.y * .5
		var floor_body := StaticBody3D.new()
		room.add_child(floor_body)
		floor_body.position = center
		var collider := CollisionShape3D.new()
		var shape := BoxShape3D.new()
		shape.size = size
		collider.shape = shape
		floor_body.add_child(collider)
		for side in [-1,1]:
			var at := Vector3(center.x + side * (size.x*.5-.52),top+.69,center.z+size.z*.24)
			Scenery.lantern(room,at)
			light_at(at+Vector3.UP*.24,lantern_tint,1.75,4.3)
	var shrine := v(course.shrines[index])
	var token := Scenery.shrine(room,shrine,GLOWS[index])
	shrine_nodes.append(token)
	light_at(shrine+Vector3(0,1.45,0),GLOWS[index],2.25,6)
	var gate := v(course.gates[index])
	gate_lights.append(light_at(gate+Vector3(0,1.8,.56),Color("#e9675c"),1.45,5.9))
	for x in [-1.12,1.12]:
		Scenery.lantern(room,gate+Vector3(x,.96,.31),true)
	for pos in course.foes[index]:
		make_foe(v(pos),index)
	Scenery.atmosphere(room,v(course.starts[index])+Vector3(0,3.6,-9),index)
	if index == 0:
		for z in [6.65,1.8,-3.05,-7.9,-12.75]:
			Scenery.beam(room,Vector3(6.60,4.0,z),Vector3(-5.8,-.77,z+3.6),Color("#6dbfbf"),.27,1.72)
			light_at(Vector3(6.18,3.18,z),Color("#6dced0"),1.7,8.0)
	elif index == 1:
		for z in [-19.5,-25.3,-30.1,-37.75]:
			Scenery.beam(room,Vector3(-6.5,10.6,z-2.8),Vector3(4.2,1.0,z+1.6),Color("#f7db9a"),.23,2.39)
			light_at(Vector3(-3.9,5.3,z),Color("#f2d99c"),1.9,7.7)

func make_foe(pos: Vector3, index: int) -> void:
	var foe := Node3D.new()
	room_roots[index].add_child(foe)
	foe.position = pos
	var iron := Scenery.material(Color("#353d46"),.48,.51)
	var edges := Scenery.material(Color("#917b67"),.64,.39)
	var fabric := Scenery.material(Color("#59313d"))
	var fire := Scenery.material(Color("#ff8b60"),0,.48,.85)
	for side in [-1,1]:
		Scenery.cylinder(foe,Vector3(side*.21,.23,0),.13,.129,.45,iron,8)
		Scenery.sphere(foe,Vector3(side*.30,.74,0),Vector3(.40,.33,.4),edges,9)
		Scenery.cylinder(foe,Vector3(side*.32,.53,.035),.11,.09,.39,iron,7)
	Scenery.cylinder(foe,Vector3(0,.52,0),.35,.24,.56,fabric,8)
	Scenery.cylinder(foe,Vector3(0,.79,0),.33,.24,.40,iron,8)
	Scenery.cylinder(foe,Vector3(0,.97,0),.16,.31,.09,edges,8)
	Scenery.sphere(foe,Vector3(0,1.13,.01),Vector3(.43,.55,.40),iron,10)
	Scenery.cylinder(foe,Vector3(0,1.13,.041),.213,.162,.087,edges,8)
	cube(foe,Vector3(0,1.138,.234),Vector3(.231,.038,.022),fire)
	cube(foe,Vector3(0,1.138,-.16),Vector3(.22,.025,.019),fire)
	Scenery.halo(foe,Vector3(0,1.13,.25),Color("#f69f64"),.59,.43)
	Scenery.cylinder(foe,Vector3(.37,.37,.16),.075,.028,.56,edges,6).rotation_degrees.z = -18
	var tell := Scenery.crystal(foe,Vector3(0,1.87,0),.37,fire)
	Scenery.halo(tell,Vector3.ZERO,Color("#ff8566"),.82,.7)
	tell.hide()
	enemies.append({node=foe, home=pos, zone=index, hp=2+index, cooldown=.5, wind=0.0, stun=0.0, tell=tell})

func make_player() -> void:
	add_child(body)
	body.position = v(course.starts[0])
	body.floor_snap_length = .18
	var collider := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = .34
	capsule.height = 1.32
	collider.shape = capsule
	collider.position.y = .68
	body.add_child(collider)
	body.add_child(avatar)
	body.add_child(pivot)
	pivot.position.y = 1.41
	pivot.add_child(arm)
	arm.spring_length = 4.65
	arm.position.x = .18
	arm.margin = .2
	arm.add_excluded_object(body.get_rid())
	arm.add_child(camera)
	camera.fov = 68
	camera.current = true

func hud_label(layer: CanvasLayer, size: int, alignment: HorizontalAlignment) -> Label:
	var label := Label.new()
	label.horizontal_alignment = alignment
	label.add_theme_font_size_override("font_size",size)
	label.add_theme_color_override("font_color",Color("#e8e6d7"))
	label.add_theme_color_override("font_shadow_color",Color("#060c12"))
	label.add_theme_constant_override("shadow_offset_y",2)
	layer.add_child(label)
	return label

func make_hud() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var grade := ColorRect.new()
	var frame_shader := ShaderMaterial.new()
	frame_shader.shader = Scenery.VIGNETTE
	grade.material = frame_shader
	grade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(grade)
	grade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	hud = hud_label(layer,25,HORIZONTAL_ALIGNMENT_LEFT)
	hud.position = Vector2(56,45)
	progress = hud_label(layer,22,HORIZONTAL_ALIGNMENT_RIGHT)
	progress.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	progress.offset_right = -56
	progress.offset_left = -390
	progress.offset_top = 45
	progress.add_theme_color_override("font_color",Color("#ecce96"))
	prompt = hud_label(layer,25,HORIZONTAL_ALIGNMENT_CENTER)
	prompt.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	prompt.offset_top = -112
	controls_help = hud_label(layer,19,HORIZONTAL_ALIGNMENT_CENTER)
	controls_help.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	controls_help.offset_top = -67
	controls_help.add_theme_color_override("font_color",Color("#d2d4ce"))
	controls_help.text = "WASD  Move     Mouse / Q E  Orbit     Space  Jump     Shift  Dash     Click / J  Strike     R  Retry"
	banner = hud_label(layer,49,HORIZONTAL_ALIGNMENT_CENTER)
	banner.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	banner.offset_left = -650
	banner.offset_right = 650
	banner.offset_top = 102
	var title_font := SystemFont.new()
	title_font.font_names = PackedStringArray(["DejaVu Serif","Georgia","Noto Serif"])
	banner.add_theme_font_override("font",title_font)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		yaw -= event.relative.x * .0034
		pitch = clampf(pitch-event.relative.y*.0032,-.85,.26)
	if event.is_action_pressed("ui_cancel"):
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if Input.mouse_mode == Input.MOUSE_MODE_CAPTURED else Input.MOUSE_MODE_CAPTURED
	if event is InputEventKey and event.pressed and not event.echo:
		match event.physical_keycode:
			KEY_SPACE: jump_buffer = .15
			KEY_SHIFT: begin_dash()
			KEY_J: attack_buffer = .17
			KEY_R: respawn()
			KEY_F1: help_pinned = not help_pinned
	if event is InputEventMouseButton and event.pressed:
		if Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
		elif event.button_index == MOUSE_BUTTON_LEFT:
			attack_buffer = .17
		elif event.button_index == MOUSE_BUTTON_RIGHT:
			begin_dash()

func axes() -> Vector2:
	return Vector2(float(Input.is_physical_key_pressed(KEY_D))-float(Input.is_physical_key_pressed(KEY_A)),
		float(Input.is_physical_key_pressed(KEY_S))-float(Input.is_physical_key_pressed(KEY_W))).limit_length()

func begin_dash() -> void:
	if victory:
		return
	if dash_cool > 0:
		dash_buffer = .14
		return
	dash_buffer = 0.0
	attack_pending = false
	attack_left = 0.0
	avatar.cancel_strike()
	var input := axes()
	dash_dir = (Vector3(input.x,0,input.y).rotated(Vector3.UP,yaw)).normalized() if input.length_squared() > .01 else look
	dash_left = .19
	dash_cool = .54
	hurt = maxf(hurt, .23)
	burst(body.position+Vector3.UP*.48,GLOWS[zone],9)

func strike() -> void:
	if victory:
		return
	attack_buffer = 0
	chain = chain % 3 + 1 if chain_left > 0 else 1
	chain_left = .48
	attack_left = Hero.ATTACK_DURATION[chain-1]
	attack_pending = true
	avatar.play_strike(chain)
	# Choose a target before the swing so the body and blade turn together.
	var foe := strike_target()
	if not foe.is_empty():
		var face: Vector3 = foe.node.position - body.position
		face.y = 0.0
		if face.length_squared() > .01:
			look = face.normalized()

func strike_target() -> Dictionary:
	var closest: Dictionary = {}
	var nearest := 3.15
	for foe in enemies:
		if foe.hp <= 0 or foe.zone != zone:
			continue
		var delta: Vector3 = foe.node.position - body.position
		var dist := delta.length()
		delta.y = 0
		if dist < nearest and look.dot(delta.normalized()) > -.14:
			closest = foe
			nearest = dist
	return closest

func resolve_strike() -> void:
	attack_pending = false
	var foe := strike_target()
	if foe.is_empty():
		return
	foe.hp -= 2 if chain == 3 else 1
	foe.stun = .47
	foe.wind = 0.0
	foe.cooldown = .55
	burst(foe.node.position+Vector3.UP*.9,Color("#ffb987"),14)
	if foe.hp <= 0:
		foe.node.hide()
		burst(foe.node.position+Vector3.UP*.9,GLOWS[zone],18)

func burst(pos: Vector3, tint: Color, count: int) -> void:
	var glow := Scenery.material(tint,0,.68,1.15)
	for i in range(count):
		var part := cube(self,pos,Vector3.ONE*rng.randf_range(.045,.13),glow)
		var velocity := Vector3(rng.randf_range(-1.8,1.8),rng.randf_range(.4,3.5),rng.randf_range(-1.8,1.8))
		effects.append({node=part, velocity=velocity, life=rng.randf_range(.14,.34)})

func show_active_room() -> void:
	for i in range(room_roots.size()):
		var active := i == zone
		room_roots[i].visible = active
		room_roots[i].process_mode = Node.PROCESS_MODE_INHERIT if active else Node.PROCESS_MODE_DISABLED

func respawn() -> void:
	show_active_room()
	body.position = v(course.starts[zone])
	body.velocity = Vector3.ZERO
	look = Vector3.FORWARD
	yaw = 0.0
	pitch = -.25
	hp = 5
	hurt = .5
	jump_buffer = 0
	attack_buffer = 0
	attack_left = 0
	attack_pending = false
	chain_left = 0
	avatar.rotation = Vector3.ZERO
	avatar.reset_pose()
	body.reset_physics_interpolation()
	dash_left = 0
	dash_cool = 0
	dash_buffer = 0
	coyote = 0
	air_jump = true
	for foe in enemies:
		if foe.zone == zone and not cleared[zone]:
			foe.hp = 2+zone
			foe.node.position = foe.home
			foe.node.show()
			foe.wind = 0.0
			foe.stun = 0.0
			foe.cooldown = .6

func _physics_process(dt: float) -> void:
	elapsed += dt
	jump_buffer = maxf(0,jump_buffer-dt)
	dash_cool = maxf(0,dash_cool-dt)
	hurt = maxf(0,hurt-dt)
	attack_left = maxf(0,attack_left-dt)
	attack_buffer = maxf(0,attack_buffer-dt)
	dash_buffer = maxf(0,dash_buffer-dt)
	if dash_buffer > 0.0 and dash_cool <= 0.0:
		begin_dash()
	if attack_pending and attack_left <= (.145 if chain < 3 else .172):
		resolve_strike()
	if attack_buffer > 0.0 and attack_left <= .13 and dash_left <= .10:
		if dash_left > 0.0:
			dash_left = 0.0
		strike()
	chain_left = maxf(0,chain_left-dt)
	banner_time = maxf(0,banner_time-dt)
	if Input.is_physical_key_pressed(KEY_Q):
		yaw += dt*2.1
	if Input.is_physical_key_pressed(KEY_E):
		yaw -= dt*2.1
	pivot.rotation.y = yaw
	arm.rotation.x = pitch
	var input := axes() if not victory else Vector2.ZERO
	var direction := Vector3(input.x,0,input.y).rotated(Vector3.UP,yaw)
	var planar := Vector3(body.velocity.x,0,body.velocity.z)
	var grounded := body.is_on_floor()
	if grounded:
		air_jump = true
		coyote = .105
	else:
		coyote = maxf(0,coyote-dt)
	if direction.length_squared() > .01 and dash_left <= 0 and attack_left <= .12:
		look = direction.normalized()
	if dash_left > 0 and dash_left <= .10 and jump_buffer > 0 and (coyote > 0 or air_jump):
		dash_left = 0.0
	if dash_left > 0:
		dash_left -= dt
		body.velocity = dash_dir * 18.0
		look = dash_dir
		if Engine.get_physics_frames() % 3 == 0:
			burst(body.position + Vector3.UP*.5,GLOWS[zone],2)
	else:
		var target := direction * 8.6
		if attack_left > .14 and direction.length_squared() <= .01:
			target = look * 3.3
		var accel := 74.0 if grounded else 46.0
		if grounded and (target.length_squared() < .01 or planar.dot(target) < 0.0):
			accel = 91.0
		planar = planar.move_toward(target,dt*accel)
		body.velocity.x = planar.x
		body.velocity.z = planar.z
		if jump_buffer > 0 and (coyote > 0 or air_jump):
			avatar.play_jump(coyote <= 0)
			if coyote <= 0:
				air_jump = false
				burst(body.position, GLOWS[zone],8)
			body.velocity.y = 9.4 if coyote > 0 else 8.8
			jump_buffer = 0
			coyote = 0
		elif not grounded:
			var gravity := 23.0 if body.velocity.y > 0 and Input.is_physical_key_pressed(KEY_SPACE) else 32.0
			body.velocity.y = maxf(-21.0,body.velocity.y-gravity*dt)
		else:
			body.velocity.y = -.7
	var fall_speed := -body.velocity.y
	body.move_and_slide()
	if not grounded and body.is_on_floor() and fall_speed > 2.0:
		avatar.play_land(fall_speed)
	avatar.motion(dt,body.velocity,look,body.is_on_floor(),dash_left > 0.0)
	camera.fov = lerpf(camera.fov,72.0 if dash_left > 0 else 67.0,1.0-exp(-dt*14.0))
	if body.position.y < v(course.starts[zone]).y-4.0 or hp <= 0:
		respawn()
	update_foes(dt)
	update_course(dt)
	for i in range(effects.size()-1,-1,-1):
		var effect := effects[i]
		effect.life -= dt
		if effect.life <= 0:
			effect.node.queue_free()
			effects.remove_at(i)
		else:
			effect.node.position += effect.velocity*dt
			effect.velocity.y -= dt*9
			effect.node.scale = Vector3.ONE*clampf(effect.life*6,.02,1)

func update_foes(dt: float) -> void:
	for foe in enemies:
		if foe.hp <= 0 or foe.zone != zone:
			continue
		var node: Node3D = foe.node
		var delta := body.position-node.position
		var distance := Vector2(delta.x,delta.z).length()
		var reachable := absf(delta.y) < 1.25 and (zone != 0 or elapsed > 4.9 or body.position.distance_to(v(course.starts[0])) > 1.55)
		foe.cooldown = maxf(0,foe.cooldown-dt)
		foe.stun = maxf(0,foe.stun-dt)
		if foe.wind > 0:
			foe.wind -= dt
			if foe.wind <= 0:
				foe.cooldown = .85
				if reachable and distance < 1.7 and hurt <= 0 and not victory:
					hp -= 1
					hurt = .8
					avatar.play_hurt()
					burst(body.position+Vector3.UP*.8,Color("#ff695d"),14)
		elif foe.stun <= 0 and reachable and distance < 5.2:
			if distance > 1.28:
				var home: Vector3 = foe.home
				var next := node.position + Vector3(delta.x,0,delta.z).normalized()*dt*2.65
				node.position = home + (next-home).limit_length(1.55)
			elif foe.cooldown <= 0:
				foe.wind = .36
		node.rotation.y = atan2(delta.x,delta.z)
		node.scale.y = .84 if foe.stun > 0 else 1.0 + sin(elapsed*5)*.06
		foe.tell.visible = foe.wind > 0

func update_course(dt: float) -> void:
	for i in range(shrine_nodes.size()):
		var token := shrine_nodes[i]
		token.rotation.y += dt*1.8
		token.position.y = float(course.shrines[i][1])+1+sin(elapsed*2.7)*.14
	if not cleared[zone] and body.position.distance_to(v(course.shrines[zone])) < 1.55:
		cleared[zone] = true
		sigils += 1
		shrine_nodes[zone].hide()
		gate_lights[zone].light_color = GLOWS[zone]
		hp = 5
		burst(v(course.shrines[zone])+Vector3.UP,GLOWS[zone],24)
	if cleared[zone] and body.position.distance_to(v(course.gates[zone])) < 1.32 and not victory:
		if zone == 2:
			victory = true
			banner_time = INF
			banner.text = "THE WATCH IS YOURS"
		else:
			zone += 1
			respawn()
			banner_time = 3.1
			banner.text = course.zoneNames[zone]
	update_atmosphere(minf(1.0,dt*2.6))
	hud.text = "%s\n%s%s" % [course.zoneNames[zone],"◆ ".repeat(maxi(0,hp)), "◇ ".repeat(5-hp)]
	progress.text = "SIGILS    %d / 3" % sigils
	banner.visible = banner_time > 0
	banner.modulate.a = minf(banner_time,1.0)
	var goal := "Cross the lit arch" if cleared[zone] else "Recover the glowing sigil"
	if victory:
		goal = "All three sigils recovered"
	prompt.text = goal
	controls_help.modulate.a = 1.0 if help_pinned else clampf(17.0-elapsed,.40,1.0)
