extends SceneTree

const TEST_ROOT := "res://tests/_matterhorn_current_character_scale_eval"
const OUTPUT_DIR := TEST_ROOT + "/output"
const HOUSE_01 := TEST_ROOT + "/yun_caribbean_house_01.glb"
const HOUSE_02 := TEST_ROOT + "/yun_caribbean_house_02.glb"
const MiniFigure = preload("res://scripts/mini_figure.gd")
const TITO_ID := 0
const GAMEPLAY_CHARACTER_SCALE := 1.2
const EVALUATION_SIZE := Vector2i(1920, 1080)

var world: Node3D
var camera: Camera3D
var house_instances: Array[Node3D] = []
var tito_host: Node3D
var tito_figure
var title_label: Label


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)
	DisplayServer.window_set_size(EVALUATION_SIZE)
	get_root().size = EVALUATION_SIZE
	await process_frame

	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT_DIR))
	_build_world()
	var house01 := _load_scene(HOUSE_01)
	var house02 := _load_scene(HOUSE_02)
	if house01 == null or house02 == null:
		printerr("CURRENT_CHARACTER_SCALE_ERROR candidate house PackedScene missing")
		quit(1)
		return
	if not _mount_current_tito():
		printerr("CURRENT_CHARACTER_SCALE_ERROR Tito mount failed: ", tito_figure.last_mount_error)
		quit(1)
		return

	var screenshots := {}

	_clear_houses()
	_place_house(house01, "House01", Vector3(0.0, 0.0, -4.55))
	_move_tito(Vector3(-1.25, 0.08, 2.45), PI)
	_set_title("A  •  HOUSE 01 + CURRENT TITO  •  SHIPPING GAME SCALE")
	_set_camera(Vector3(0.0, 8.6, 20.5), Vector3(0.0, 3.0, -2.8))
	await _wait_frames(75)
	screenshots.house01 = _capture("A-house01-current-tito.png")

	_clear_houses()
	_place_house(house02, "House02", Vector3(0.0, 0.0, -4.55))
	_move_tito(Vector3(2.25, 0.08, 2.45), PI)
	_set_title("B  •  HOUSE 02 + CURRENT TITO  •  SHIPPING GAME SCALE")
	_set_camera(Vector3(0.0, 10.5, 26.5), Vector3(0.0, 3.0, -2.8))
	await _wait_frames(75)
	screenshots.house02 = _capture("B-house02-current-tito.png")

	_clear_houses()
	_place_house(house01, "House01", Vector3(-4.60, 0.0, -4.55))
	_place_house(house02, "House02", Vector3(4.65, 0.0, -4.55))
	_move_tito(Vector3(0.0, 0.08, 2.5), PI)
	_set_title("C  •  BOTH HOUSES + CURRENT TITO  •  GAMEPLAY CAMERA")
	_set_camera(Vector3(0.0, 8.6, 20.5), Vector3(0.0, 3.0, -2.8))
	await _wait_frames(75)
	screenshots.both = _capture("C-both-houses-current-tito-gameplay-camera.png")

	_clear_houses()
	_place_house(house01, "House01", Vector3(0.0, 0.0, -4.55))
	_move_tito(Vector3(3.70, 0.08, -0.20), PI * 0.5)
	_set_title("D  •  HOUSE 01 STAIR / BALCONY SIDE CHECK + CURRENT TITO")
	_set_camera(Vector3(13.5, 7.2, 8.0), Vector3(1.1, 2.9, -3.6))
	await _wait_frames(75)
	screenshots.side = _capture("D-house01-stair-side-current-tito.png")

	var tito_bounds := _node_bounds(tito_host)
	var report := {
		"schemaVersion": "1.0.0",
		"status": "PASS" if _all_screenshots_present(screenshots) else "FAIL",
		"projectName": ProjectSettings.get_setting("application/config/name", "unknown"),
		"projectVersion": ProjectSettings.get_setting("application/config/version", "unknown"),
		"character": {
			"name": MiniFigure.display_name(TITO_ID),
			"rosterIndex": TITO_ID,
			"asset": MiniFigure.model_path(TITO_ID),
			"loader": "res://scripts/mini_figure.gd",
			"runtimeScale": GAMEPLAY_CHARACTER_SCALE,
			"boundsMeters": tito_bounds,
		},
		"camera": {
			"fov": camera.fov,
			"near": camera.near,
			"far": camera.far,
			"viewport": [get_root().size.x, get_root().size.y],
			"sourceMatch": "games/Yun/scenes/match.tscn and scripts/match_camera.gd",
		},
		"houses": {
			"house01": {
				"asset": HOUSE_01,
				"geometryChanged": false,
			},
			"house02": {
				"asset": HOUSE_02,
				"geometryChanged": false,
			},
		},
		"screenshots": screenshots,
		"temporaryOnly": true,
		"gameplayModified": false,
	}
	var report_file := FileAccess.open(OUTPUT_DIR + "/current-character-scale-report.json", FileAccess.WRITE)
	if report_file == null:
		printerr("CURRENT_CHARACTER_SCALE_ERROR cannot write report")
		quit(1)
		return
	report_file.store_string(JSON.stringify(report, "  "))
	report_file.close()
	print("CURRENT_CHARACTER_SCALE_OK ", JSON.stringify(report))
	quit(0 if report.status == "PASS" else 1)


func _load_scene(path: String) -> PackedScene:
	return ResourceLoader.load(path) as PackedScene


func _mount_current_tito() -> bool:
	tito_host = Node3D.new()
	tito_host.name = "CurrentGameplayTito"
	world.add_child(tito_host)
	tito_figure = MiniFigure.new()
	return tito_figure.mount(tito_host, TITO_ID, Color(0.22, 1.0, 0.4, 1.0), GAMEPLAY_CHARACTER_SCALE, false)


func _build_world() -> void:
	world = Node3D.new()
	world.name = "TemporaryCurrentCharacterScaleEvaluation"
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
	world.add_child(camera)

	var overlay := CanvasLayer.new()
	overlay.layer = 10
	get_root().add_child(overlay)
	title_label = Label.new()
	title_label.position = Vector2(28, 24)
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


func _place_house(scene: PackedScene, instance_name: String, position: Vector3) -> void:
	var instance := scene.instantiate() as Node3D
	instance.name = instance_name
	instance.position = position
	world.add_child(instance)
	house_instances.append(instance)


func _clear_houses() -> void:
	for house in house_instances:
		if is_instance_valid(house):
			house.free()
	house_instances.clear()


func _move_tito(position: Vector3, yaw: float) -> void:
	tito_host.position = position
	tito_host.rotation = Vector3(0.0, yaw, 0.0)


func _set_camera(position: Vector3, target: Vector3) -> void:
	camera.position = position
	camera.look_at(target, Vector3.UP)


func _set_title(value: String) -> void:
	title_label.text = value
	title_label.reset_size()


func _wait_frames(count: int) -> void:
	for _index in count:
		await process_frame


func _capture(filename: String) -> String:
	var image := get_root().get_texture().get_image()
	if image == null or image.is_empty():
		printerr("CURRENT_CHARACTER_SCALE_CAPTURE_ERROR ", filename)
		return ""
	var path := OUTPUT_DIR + "/" + filename
	var error := image.save_png(ProjectSettings.globalize_path(path))
	if error != OK:
		printerr("CURRENT_CHARACTER_SCALE_CAPTURE_ERROR ", filename, " code=", error)
		return ""
	return path


func _all_screenshots_present(screenshots: Dictionary) -> bool:
	for path in screenshots.values():
		if String(path).is_empty():
			return false
	return screenshots.size() == 4


func _node_bounds(node: Node3D) -> Dictionary:
	var points: Array[Vector3] = []
	_collect_bounds(node, node, points)
	if points.is_empty():
		return {"minimum": [0, 0, 0], "maximum": [0, 0, 0], "dimensions": [0, 0, 0]}
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
