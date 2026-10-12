extends SceneTree

const TEST_ROOT := "res://tests/_matterhorn_house_scale_lock"
const OUTPUT_DIR := TEST_ROOT + "/output"
const HOUSE_01 := TEST_ROOT + "/yun_caribbean_house_01.glb"
const HOUSE_02 := TEST_ROOT + "/yun_caribbean_house_02.glb"
const MiniFigure = preload("res://scripts/mini_figure.gd")
const SELECTED_HOUSE_SCALE := 0.55
const GAMEPLAY_CHARACTER_SCALE := 1.2
const TITO_ID := 0
const SMALLER_ID := 2 # Paco: shortest measured current roster model.
const LARGER_ID := 4 # Neno: tallest measured current roster model.
const EVALUATION_SIZE := Vector2i(1920, 1080)

var world: Node3D
var camera: Camera3D
var title_label: Label
var houses: Array[Node3D] = []
var character_hosts: Dictionary = {}
var character_figures: Array = []


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
		printerr("SELECTED_HOUSE_SCALE_ERROR candidate house PackedScene missing")
		quit(1)
		return
	for character_id in [TITO_ID, SMALLER_ID, LARGER_ID]:
		if not _mount_character(character_id):
			quit(1)
			return

	var screenshots := {}

	_clear_houses()
	_place_pair(house01, house02)
	_show_characters([TITO_ID, SMALLER_ID, LARGER_ID])
	_move_character(SMALLER_ID, Vector3(-3.35, 0.08, 2.15), PI)
	_move_character(TITO_ID, Vector3(0.0, 0.08, 2.45), PI)
	_move_character(LARGER_ID, Vector3(3.45, 0.08, 2.15), PI)
	_set_title("LOCK CANDIDATE 0.55  •  PACO / TITO / NENO  •  CURRENT ROSTER")
	_set_camera(Vector3(0.0, 8.6, 20.5), Vector3(0.0, 2.1, -1.5))
	await _wait_frames(75)
	screenshots.roster = _capture("selected-055-both-houses-three-current-characters.png")

	_clear_houses()
	_place_house(house01, "House01", Vector3(0.0, 0.0, -4.55 * SELECTED_HOUSE_SCALE), SELECTED_HOUSE_SCALE)
	_show_characters([TITO_ID])
	_move_character(TITO_ID, Vector3(-0.75, 0.08, 1.75), PI)
	_set_title("0.55  •  HOUSE 01 DOOR / WINDOWS / BALCONY + TITO")
	_set_camera(Vector3(0.0, 4.8, 11.5), Vector3(0.0, 1.75, -1.1))
	await _wait_frames(60)
	screenshots.house01_front = _capture("selected-055-house01-front-close.png")

	_move_character(TITO_ID, Vector3(2.08, 0.08, -0.10), PI * 0.5)
	_set_title("0.55  •  HOUSE 01 EXTERIOR STAIR + TITO")
	_set_camera(Vector3(8.3, 4.5, 5.6), Vector3(0.65, 1.65, -1.85))
	await _wait_frames(60)
	screenshots.house01_stair = _capture("selected-055-house01-stair-close.png")

	_clear_houses()
	_place_house(house02, "House02", Vector3(0.0, 0.0, -4.55 * SELECTED_HOUSE_SCALE), SELECTED_HOUSE_SCALE)
	_show_characters([TITO_ID])
	_move_character(TITO_ID, Vector3(1.20, 0.08, 1.75), PI)
	_set_title("0.55  •  HOUSE 02 DOOR / GARAGE / WINDOWS / BALCONY + TITO")
	_set_camera(Vector3(0.0, 4.8, 11.5), Vector3(0.0, 1.75, -1.1))
	await _wait_frames(60)
	screenshots.house02_front = _capture("selected-055-house02-front-close.png")

	var characters := {}
	for character_id in [TITO_ID, SMALLER_ID, LARGER_ID]:
		var host := character_hosts[character_id] as Node3D
		characters[MiniFigure.display_name(character_id)] = {
			"rosterIndex": character_id,
			"asset": MiniFigure.model_path(character_id),
			"runtimeScale": GAMEPLAY_CHARACTER_SCALE,
			"bounds": _node_bounds(host),
		}

	var report := {
		"schemaVersion": "1.0.0",
		"status": "PASS" if _screenshots_complete(screenshots) else "FAIL",
		"selectedHouseScale": SELECTED_HOUSE_SCALE,
		"testedHouseScales": [0.55, 0.60, 0.65],
		"characters": characters,
		"camera": {
			"fov": camera.fov,
			"near": camera.near,
			"far": camera.far,
			"viewport": [EVALUATION_SIZE.x, EVALUATION_SIZE.y],
		},
		"scaledFeatureMeasurements": {
			"house01DoorHeight": 2.14 * SELECTED_HOUSE_SCALE,
			"house02DoorHeight": 2.15 * SELECTED_HOUSE_SCALE,
			"house02GarageHeight": 2.30 * SELECTED_HOUSE_SCALE,
			"house01StairRise": 0.26 * SELECTED_HOUSE_SCALE,
			"house01BalconyGuardHeight": 0.92 * SELECTED_HOUSE_SCALE,
			"house02BalconyGuardHeightApprox": 0.93 * SELECTED_HOUSE_SCALE,
			"house01FloorToFloorApprox": 3.07 * SELECTED_HOUSE_SCALE,
		},
		"screenshots": screenshots,
		"sourceHouseFilesChanged": false,
		"characterScaleChanged": false,
		"gameplayChanged": false,
		"promoted": false,
	}
	var report_file := FileAccess.open(OUTPUT_DIR + "/selected-scale-validation-report.json", FileAccess.WRITE)
	if report_file == null:
		printerr("SELECTED_HOUSE_SCALE_ERROR cannot write report")
		quit(1)
		return
	report_file.store_string(JSON.stringify(report, "  "))
	report_file.close()
	print("SELECTED_HOUSE_SCALE_OK ", JSON.stringify(report))
	quit(0 if report.status == "PASS" else 1)


func _mount_character(character_id: int) -> bool:
	var host := Node3D.new()
	host.name = MiniFigure.display_name(character_id)
	world.add_child(host)
	var figure = MiniFigure.new()
	if not figure.mount(host, character_id, Color.WHITE, GAMEPLAY_CHARACTER_SCALE, false):
		printerr("SELECTED_HOUSE_SCALE_ERROR character mount failed: ", figure.last_mount_error)
		host.free()
		return false
	character_hosts[character_id] = host
	character_figures.append(figure)
	return true


func _show_characters(ids: Array) -> void:
	for character_id in character_hosts.keys():
		var host := character_hosts[character_id] as Node3D
		host.visible = ids.has(character_id)


func _move_character(character_id: int, position: Vector3, yaw: float) -> void:
	var host := character_hosts[character_id] as Node3D
	host.position = position
	host.rotation = Vector3(0.0, yaw, 0.0)


func _place_pair(house01: PackedScene, house02: PackedScene) -> void:
	_place_house(house01, "House01", Vector3(-4.60 * SELECTED_HOUSE_SCALE, 0.0, -4.55 * SELECTED_HOUSE_SCALE), SELECTED_HOUSE_SCALE)
	_place_house(house02, "House02", Vector3(4.65 * SELECTED_HOUSE_SCALE, 0.0, -4.55 * SELECTED_HOUSE_SCALE), SELECTED_HOUSE_SCALE)


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
	world.name = "TemporarySelectedHouseScaleValidation"
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


func _set_camera(position: Vector3, target: Vector3) -> void:
	camera.position = position
	camera.look_at(target, Vector3.UP)


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


func _screenshots_complete(screenshots: Dictionary) -> bool:
	if screenshots.size() != 4:
		return false
	for path in screenshots.values():
		if String(path).is_empty():
			return false
	return true


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
