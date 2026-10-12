extends SceneTree

const TEST_ROOT := "res://tests/_matterhorn_house_scale_lock"
const OUTPUT_DIR := TEST_ROOT + "/output"
const HOUSE_01 := TEST_ROOT + "/yun_caribbean_house_01.glb"
const HOUSE_02 := TEST_ROOT + "/yun_caribbean_house_02.glb"
const MiniFigure = preload("res://scripts/mini_figure.gd")
const TITO_ID := 0
const CHARACTER_SCALE := 1.2
const HOUSE_SCALES := [0.55, 0.60, 0.65]
const EVALUATION_SIZE := Vector2i(1920, 1080)

var world: Node3D
var camera: Camera3D
var title_label: Label
var houses: Array[Node3D] = []
var tito_host: Node3D
var tito_figure


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)
	DisplayServer.window_set_size(EVALUATION_SIZE)
	get_root().size = EVALUATION_SIZE
	await process_frame

	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT_DIR))
	_build_world()
	var house01 := ResourceLoader.load(HOUSE_01) as PackedScene
	var house02 := ResourceLoader.load(HOUSE_02) as PackedScene
	if house01 == null or house02 == null:
		printerr("HOUSE_SCALE_BOARD_ERROR candidate house PackedScene missing")
		quit(1)
		return
	if not _mount_tito():
		printerr("HOUSE_SCALE_BOARD_ERROR Tito mount failed: ", tito_figure.last_mount_error)
		quit(1)
		return

	var captures: Array[String] = []
	for scale_value in HOUSE_SCALES:
		_clear_houses()
		_place_pair(house01, house02, scale_value)
		_set_title("HOUSE SCALE %.2f  •  CURRENT TITO  •  RUNTIME TRANSFORM ONLY" % scale_value)
		await _wait_frames(75)
		var scale_code := "%03d" % int(round(scale_value * 100.0))
		captures.append(_capture("scale-%s.png" % scale_code))

	var board_path := _make_board(captures, "house-scale-comparison-board.png")

	camera.position = Vector3(0.0, 6.0, 14.5)
	camera.look_at(Vector3(0.0, 2.0, -1.2), Vector3.UP)
	var feature_captures: Array[String] = []
	for scale_value in HOUSE_SCALES:
		_clear_houses()
		_place_pair(house01, house02, scale_value)
		_set_title("CLOSE SCALE %.2f  •  DOORS / WINDOWS / RAILS / GARAGE" % scale_value)
		await _wait_frames(60)
		var scale_code := "%03d" % int(round(scale_value * 100.0))
		feature_captures.append(_capture("feature-scale-%s.png" % scale_code))
	var feature_board_path := _make_board(feature_captures, "house-scale-feature-comparison-board.png")
	var report := {
		"schemaVersion": "1.0.0",
		"status": "PASS" if captures.size() == 3 and feature_captures.size() == 3 and not board_path.is_empty() and not feature_board_path.is_empty() else "FAIL",
		"projectName": ProjectSettings.get_setting("application/config/name", "unknown"),
		"projectVersion": ProjectSettings.get_setting("application/config/version", "unknown"),
		"houseScales": HOUSE_SCALES,
		"character": {
			"name": MiniFigure.display_name(TITO_ID),
			"rosterIndex": TITO_ID,
			"asset": MiniFigure.model_path(TITO_ID),
			"runtimeScale": CHARACTER_SCALE,
			"bounds": _node_bounds(tito_host),
		},
		"camera": {
			"fov": camera.fov,
			"near": camera.near,
			"far": camera.far,
			"position": [0.0, 8.6, 20.5],
			"target": [0.0, 3.0, -2.8],
			"viewport": [EVALUATION_SIZE.x, EVALUATION_SIZE.y],
		},
		"captures": captures,
		"comparisonBoard": board_path,
		"featureCaptures": feature_captures,
		"featureComparisonBoard": feature_board_path,
		"sourceHouseFilesChanged": false,
		"characterScaleChanged": false,
		"gameplayChanged": false,
	}
	var report_file := FileAccess.open(OUTPUT_DIR + "/scale-board-report.json", FileAccess.WRITE)
	if report_file == null:
		printerr("HOUSE_SCALE_BOARD_ERROR cannot write report")
		quit(1)
		return
	report_file.store_string(JSON.stringify(report, "  "))
	report_file.close()
	print("HOUSE_SCALE_BOARD_OK ", JSON.stringify(report))
	quit(0 if report.status == "PASS" else 1)


func _mount_tito() -> bool:
	tito_host = Node3D.new()
	tito_host.name = "CurrentGameplayTito"
	tito_host.position = Vector3(0.0, 0.08, 2.5)
	tito_host.rotation.y = PI
	world.add_child(tito_host)
	tito_figure = MiniFigure.new()
	return tito_figure.mount(tito_host, TITO_ID, Color.WHITE, CHARACTER_SCALE, false)


func _place_pair(house01: PackedScene, house02: PackedScene, scale_value: float) -> void:
	_place_house(house01, "House01", Vector3(-4.60 * scale_value, 0.0, -4.55 * scale_value), scale_value)
	_place_house(house02, "House02", Vector3(4.65 * scale_value, 0.0, -4.55 * scale_value), scale_value)


func _place_house(scene: PackedScene, instance_name: String, position: Vector3, scale_value: float) -> void:
	var instance := scene.instantiate() as Node3D
	instance.name = instance_name
	instance.position = position
	instance.scale = Vector3.ONE * scale_value
	world.add_child(instance)
	houses.append(instance)


func _clear_houses() -> void:
	for house in houses:
		if is_instance_valid(house):
			house.free()
	houses.clear()


func _build_world() -> void:
	world = Node3D.new()
	world.name = "TemporaryHouseScaleBoard"
	get_root().add_child(world)

	var environment_node := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color(0.55, 0.64, 0.74, 1.0)
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color(0.62, 0.66, 0.72, 1.0)
	environment.ambient_light_energy = 0.85
	environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	environment_node.environment = environment
	world.add_child(environment_node)

	var sun := DirectionalLight3D.new()
	sun.light_color = Color(1.0, 0.95, 0.86, 1.0)
	sun.light_energy = 1.15
	sun.shadow_enabled = true
	sun.rotation_degrees = Vector3(-48.0, -28.0, -18.0)
	world.add_child(sun)

	_add_box("Street", Vector3(48.0, 0.10, 8.0), Vector3(0.0, -0.05, 5.8), Color(0.16, 0.18, 0.20, 1.0))
	_add_box("Sidewalk", Vector3(48.0, 0.16, 1.35), Vector3(0.0, 0.0, 1.15), Color(0.63, 0.57, 0.47, 1.0))
	_add_box("HouseLot", Vector3(48.0, 0.08, 19.0), Vector3(0.0, -0.08, -8.5), Color(0.32, 0.29, 0.24, 1.0))

	camera = Camera3D.new()
	camera.name = "YunMatchCameraReference"
	camera.current = true
	camera.fov = 46.0
	camera.near = 0.12
	camera.far = 120.0
	camera.position = Vector3(0.0, 8.6, 20.5)
	world.add_child(camera)
	camera.look_at(Vector3(0.0, 3.0, -2.8), Vector3.UP)

	var overlay := CanvasLayer.new()
	overlay.layer = 10
	get_root().add_child(overlay)
	title_label = Label.new()
	title_label.position = Vector2(28, 24)
	title_label.size = Vector2(1850, 60)
	title_label.add_theme_font_size_override("font_size", 30)
	title_label.add_theme_color_override("font_color", Color(1.0, 0.96, 0.78, 1.0))
	title_label.add_theme_color_override("font_outline_color", Color(0.03, 0.04, 0.05, 0.95))
	title_label.add_theme_constant_override("outline_size", 8)
	overlay.add_child(title_label)


func _add_box(name: String, size: Vector3, position: Vector3, color: Color) -> void:
	var instance := MeshInstance3D.new()
	instance.name = name
	var mesh := BoxMesh.new()
	mesh.size = size
	instance.mesh = mesh
	instance.position = position
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.9
	instance.material_override = material
	world.add_child(instance)


func _set_title(value: String) -> void:
	title_label.text = value


func _wait_frames(count: int) -> void:
	for _index in count:
		await process_frame


func _capture(filename: String) -> String:
	var image := get_root().get_texture().get_image()
	if image == null or image.is_empty():
		return ""
	var path := OUTPUT_DIR + "/" + filename
	var error := image.save_png(ProjectSettings.globalize_path(path))
	return path if error == OK else ""


func _make_board(captures: Array[String], filename: String) -> String:
	if captures.size() != 3:
		return ""
	var board := Image.create_empty(3840, 720, false, Image.FORMAT_RGBA8)
	for index in captures.size():
		var image := Image.load_from_file(ProjectSettings.globalize_path(captures[index]))
		if image == null or image.is_empty():
			return ""
		image.resize(1280, 720, Image.INTERPOLATE_LANCZOS)
		image.convert(Image.FORMAT_RGBA8)
		board.blit_rect(image, Rect2i(0, 0, 1280, 720), Vector2i(index * 1280, 0))
	var path := OUTPUT_DIR + "/" + filename
	var error := board.save_png(ProjectSettings.globalize_path(path))
	return path if error == OK else ""


func _node_bounds(node: Node3D) -> Dictionary:
	var points: Array[Vector3] = []
	_collect_bounds(node, node, points)
	if points.is_empty():
		return {"dimensions": [0, 0, 0]}
	var minimum := points[0]
	var maximum := points[0]
	for point in points:
		minimum = minimum.min(point)
		maximum = maximum.max(point)
	var dimensions := maximum - minimum
	return {
		"minimum": [minimum.x, minimum.y, minimum.z],
		"maximum": [maximum.x, maximum.y, maximum.z],
		"dimensions": [dimensions.x, dimensions.y, dimensions.z],
	}


func _collect_bounds(node: Node, root_node: Node3D, points: Array[Vector3]) -> void:
	if node is MeshInstance3D:
		var mesh_instance := node as MeshInstance3D
		if mesh_instance.mesh != null:
			var relative := root_node.global_transform.affine_inverse() * mesh_instance.global_transform
			var aabb := mesh_instance.get_aabb()
			for x in [aabb.position.x, aabb.end.x]:
				for y in [aabb.position.y, aabb.end.y]:
					for z in [aabb.position.z, aabb.end.z]:
						points.append(relative * Vector3(x, y, z))
	for child in node.get_children():
		_collect_bounds(child, root_node, points)
