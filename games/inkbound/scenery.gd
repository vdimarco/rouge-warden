extends RefCounted

const SURFACE := preload("res://shaders/surface.gdshader")
const BEAM := preload("res://shaders/beam.gdshader")
const HALO := preload("res://shaders/halo.gdshader")
const WATER := preload("res://shaders/water.gdshader")
const VIGNETTE := preload("res://shaders/vignette.gdshader")

static func place(parent: Node3D, mesh: Mesh, location: Vector3, material: Material = null) -> MeshInstance3D:
	var item := MeshInstance3D.new()
	item.mesh = mesh
	item.material_override = material
	parent.add_child(item)
	item.position = location
	return item

static func material(color: Color, metal := 0.0, rough := .75, emission := 0.0) -> StandardMaterial3D:
	var finish := StandardMaterial3D.new()
	finish.albedo_color = color
	finish.metallic = metal
	finish.roughness = rough
	if emission > 0:
		finish.emission_enabled = true
		finish.emission = color
		finish.emission_energy_multiplier = emission
	return finish

static func cylinder(parent: Node3D, location: Vector3, top: float, bottom: float, height: float, finish: Material, sides := 14) -> MeshInstance3D:
	var mesh := CylinderMesh.new()
	mesh.top_radius = top
	mesh.bottom_radius = bottom
	mesh.height = height
	mesh.radial_segments = sides
	mesh.rings = 1
	return place(parent,mesh,location,finish)

static func sphere(parent: Node3D, location: Vector3, scale_: Vector3, finish: Material, sides := 16) -> MeshInstance3D:
	var mesh := SphereMesh.new()
	mesh.radial_segments = sides
	mesh.rings = 8
	var item := place(parent,mesh,location,finish)
	item.scale = scale_
	return item

static func ring(parent: Node3D, location: Vector3, radius: float, thickness: float, finish: Material) -> MeshInstance3D:
	var mesh := TorusMesh.new()
	mesh.inner_radius = radius-thickness
	mesh.outer_radius = radius+thickness
	mesh.rings = 32
	mesh.ring_segments = 8
	return place(parent,mesh,location,finish)

static func crystal(parent: Node3D, location: Vector3, size: float, finish: Material, sides := 6) -> Node3D:
	var item := Node3D.new()
	parent.add_child(item)
	item.position = location
	cylinder(item,Vector3(0,.30,0)*size,0,.25*size,.40*size,finish,sides)
	cylinder(item,Vector3(0,0,0),.25*size,.25*size,.20*size,finish,sides)
	cylinder(item,Vector3(0,-.26,0)*size,.25*size,0,.32*size,finish,sides)
	return item

static func halo(parent: Node3D, position: Vector3, hue: Color, size: float, intensity: float) -> void:
	var mesh := QuadMesh.new()
	mesh.size = Vector2.ONE*size
	var glow := ShaderMaterial.new()
	glow.shader = HALO
	glow.set_shader_parameter("tint",hue)
	glow.set_shader_parameter("strength",intensity)
	var sprite := place(parent,mesh,position,glow)
	sprite.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

static func beam(parent: Node3D, from: Vector3, to: Vector3, hue: Color, strength: float, width: float) -> void:
	var shader := ShaderMaterial.new()
	shader.shader = BEAM
	shader.set_shader_parameter("tint",hue)
	shader.set_shader_parameter("strength",strength)
	var direction := to-from
	var u := direction.normalized().cross(Vector3.UP)
	if u.length_squared() < .01:
		u = Vector3.RIGHT
	var v := direction.normalized().cross(u).normalized()
	for lateral in [u.normalized(), v]:
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		var points := [
			from-lateral*width*.14, from+lateral*width*.14,
			to+lateral*width, to-lateral*width]
		var uv := [Vector2(0,0),Vector2(1,0),Vector2(1,1),Vector2(0,1)]
		for i in [0,1,2,0,2,3]:
			st.set_uv(uv[i])
			st.add_vertex(points[i])
		var item := place(parent,st.commit(),Vector3.ZERO,shader)
		item.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

static func atmosphere(parent: Node3D, center: Vector3, zone: int) -> void:
	var colors := [Color("#98e7dd"),Color("#efdf91"),Color("#cfeaff")]
	var motes := CPUParticles3D.new()
	motes.amount = [52,70,174][zone]
	motes.lifetime = [9.0,7.5,5.2][zone]
	motes.preprocess = motes.lifetime
	motes.visibility_aabb = AABB(Vector3(-16,-12,-21),Vector3(32,24,42))
	motes.local_coords = true
	motes.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	motes.emission_box_extents = Vector3(13,5.6,14)
	motes.direction = [Vector3(.2,.03,.25),Vector3(.1,.16,.3),Vector3(-.67,-.53,.17)][zone]
	motes.spread = 21.0
	motes.gravity = Vector3.ZERO
	motes.initial_velocity_min = .16 if zone < 2 else .78
	motes.initial_velocity_max = .45 if zone < 2 else 2.35
	motes.scale_amount_min = .40
	motes.scale_amount_max = 1.43
	var mesh := SphereMesh.new()
	mesh.radial_segments = 5
	mesh.rings = 3
	mesh.radius = .024 if zone < 2 else .033
	mesh.height = mesh.radius*2
	var drift := material(colors[zone],0,.9,.33)
	drift.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mesh.material = drift
	motes.mesh = mesh
	parent.add_child(motes)
	motes.position = center

static func water(parent: Node3D) -> void:
	var surface := ShaderMaterial.new()
	surface.shader = WATER
	var plane := PlaneMesh.new()
	plane.size = Vector2(95,112)
	plane.subdivide_width = 68
	plane.subdivide_depth = 68
	place(parent,plane,Vector3(0,-1.08,-30),surface).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

static func room_mesh(parent: Node3D, zone: int) -> void:
	var bytes := FileAccess.get_file_as_bytes("res://art/zone-%d.meshdata" % zone)
	var mesh := ArrayMesh.new()
	var offset := 4
	for surface in range(bytes.decode_u32(0)):
		var kind := bytes.decode_u32(offset)
		var vertex_count := bytes.decode_u32(offset+4)
		var index_count := bytes.decode_u32(offset+8)
		offset += 12
		var vertices := PackedVector3Array()
		var normals := PackedVector3Array()
		var colors := PackedColorArray()
		vertices.resize(vertex_count)
		normals.resize(vertex_count)
		colors.resize(vertex_count)
		for v in range(vertex_count):
			vertices[v] = Vector3(bytes.decode_float(offset),bytes.decode_float(offset+4),bytes.decode_float(offset+8))
			normals[v] = Vector3(bytes.decode_float(offset+12),bytes.decode_float(offset+16),bytes.decode_float(offset+20))
			colors[v] = Color(bytes.decode_float(offset+24),bytes.decode_float(offset+28),bytes.decode_float(offset+32))
			offset += 36
		var indices := bytes.slice(offset,offset+index_count*4).to_int32_array()
		offset += index_count*4
		var arrays := []
		arrays.resize(Mesh.ARRAY_MAX)
		arrays[Mesh.ARRAY_VERTEX] = vertices
		arrays[Mesh.ARRAY_NORMAL] = normals
		arrays[Mesh.ARRAY_COLOR] = colors
		arrays[Mesh.ARRAY_INDEX] = indices
		mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays)
		var finish := ShaderMaterial.new()
		finish.shader = SURFACE
		finish.set_shader_parameter("surface_kind",kind)
		finish.set_shader_parameter("room",zone)
		mesh.surface_set_material(surface,finish)
	place(parent,mesh,Vector3.ZERO)

static func lantern(parent: Node3D, at: Vector3, wide := false) -> void:
	var brass := material(Color("#615046"),.45,.46)
	var dark := material(Color("#2c3337"),.3,.68)
	var ember := material(Color("#ffbb63"),0,.4,1.20)
	var flame := material(Color("#ffe4a9"),0,.32,2.1)
	var scale_ := 1.32 if wide else 1.0
	var stand := Node3D.new()
	parent.add_child(stand)
	stand.position = at
	stand.scale *= scale_
	cylinder(stand,Vector3(0,-.59,0),.19,.29,.13,dark,8)
	cylinder(stand,Vector3(0,-.37,0),.07,.105,.38,brass,10)
	cylinder(stand,Vector3(0,-.15,0),.19,.105,.14,brass,8)
	cylinder(stand,Vector3(0,.13,0),.119,.11,.34,ember,8)
	crystal(stand,Vector3(0,.09,0),.46,flame)
	for i in range(6):
		var angle := TAU*i/6
		cylinder(stand,Vector3(cos(angle)*.148,.134,sin(angle)*.148),.019,.022,.43,dark,6)
	cylinder(stand,Vector3(0,.32,0),.095,.182,.128,brass,8)
	cylinder(stand,Vector3(0,.43,0),.026,.060,.10,brass,8)
	halo(stand,Vector3(0,.13,0),Color("#ffc77d"),1.9,.62)

static func shrine(parent: Node3D, at: Vector3, hue: Color) -> Node3D:
	var slate := material(Color("#374650"),.21,.54)
	var alloy := material(Color("#9c8152"),.52,.39)
	var core := material(hue,0,.34,1.44)
	cylinder(parent,at+Vector3.UP*.09,.73,.85,.20,slate)
	cylinder(parent,at+Vector3.UP*.22,.54,.66,.16,alloy)
	cylinder(parent,at+Vector3.UP*.34,.39,.53,.13,slate)
	ring(parent,at+Vector3.UP*.439,.435,.022,core)
	var token := crystal(parent,at+Vector3.UP,1.15,core)
	halo(token,Vector3.ZERO,hue,2.3,.50)
	ring(token,Vector3.ZERO,.54,.017,alloy).rotation_degrees = Vector3(22,0,-27)
	ring(token,Vector3.ZERO,.47,.010,core).rotation_degrees = Vector3(-25,0,17)
	for i in range(4):
		var angle := TAU*i/4
		crystal(token,Vector3(cos(angle)*.52,.03,sin(angle)*.52),.24,core)
	return token
