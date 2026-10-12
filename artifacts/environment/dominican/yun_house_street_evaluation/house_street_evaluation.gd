extends SceneTree

const TEST_ROOT := "res://tests/_matterhorn_house_eval"
const OUTPUT_DIR := TEST_ROOT + "/output"
const HOUSE_01 := TEST_ROOT + "/yun_caribbean_house_01.glb"
const HOUSE_02 := TEST_ROOT + "/yun_caribbean_house_02.glb"
const HOUSE_02_LOD1 := TEST_ROOT + "/yun_caribbean_house_02_lod1.glb"
const CHARACTER := "res://assets/characters/yun_urban_gameplay_v2.glb"
const EVALUATION_SIZE := Vector2i(1920, 1080)

var world: Node3D
var camera: Camera3D
var house_instances: Array[Node3D] = []
var character_instance: Node3D
var title_label: Label


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)
	DisplayServer.window_set_size(EVALUATION_SIZE)
	get_root().size = EVALUATION_SIZE
	await process_frame
	var absolute_output := ProjectSettings.globalize_path(OUTPUT_DIR)
	DirAccess.make_dir_recursive_absolute(absolute_output)
	_build_world()
	var resources := {
		"house01": _load_scene(HOUSE_01),
		"house02": _load_scene(HOUSE_02),
		"house02_lod1": _load_scene(HOUSE_02_LOD1),
		"character": _load_scene(CHARACTER),
	}
	if resources.house01 == null or resources.house02 == null or resources.house02_lod1 == null or resources.character == null:
		printerr("HOUSE_STREET_EVAL_ERROR required PackedScene missing")
		quit(1)
		return

	_place_character(resources.character)
	_place_two_houses(resources.house01, resources.house02)
	title_label.text = "TEMP YUN EVALUATION  •  HOUSE 01 + HOUSE 02  •  CHARACTER SCALE"
	title_label.reset_size()
	camera.position = Vector3(0.0, 8.6, 20.5)
	camera.look_at(Vector3(0.0, 3.0, -2.8), Vector3.UP)
	await _wait_frames(60)
	var two_house_shot := _capture("two-house-gameplay-camera.png")
	var two_metrics := await _measure(240)
	var house01_stats := _scene_mesh_stats(resources.house01.instantiate())
	var house02_stats := _scene_mesh_stats(resources.house02.instantiate())
	var house02_lod1_stats := _scene_mesh_stats(resources.house02_lod1.instantiate())
	var character_bounds := _node_bounds(character_instance)

	_clear_houses()
	_place_ten_houses(resources.house01, resources.house02)
	title_label.text = "TEMP YUN PERFORMANCE EVALUATION  •  10 VISIBLE HOUSES  •  LOD0"
	title_label.reset_size()
	camera.position = Vector3(31.0, 22.0, 41.0)
	camera.look_at(Vector3(0.0, 2.7, 5.0), Vector3.UP)
	await _wait_frames(90)
	var ten_house_shot := _capture("ten-house-performance-camera.png")
	var ten_metrics := await _measure(360)

	var report := {
		"schemaVersion": "1.0.0",
		"status": "PASS" if two_house_shot and ten_house_shot else "FAIL",
		"projectName": ProjectSettings.get_setting("application/config/name", "unknown"),
		"projectVersion": ProjectSettings.get_setting("application/config/version", "unknown"),
		"viewport": {
			"width": get_root().size.x,
			"height": get_root().size.y,
			"cameraFov": camera.fov,
			"renderingMethodMobile": ProjectSettings.get_setting("rendering/renderer/rendering_method.mobile", "unknown"),
		},
		"runtime": {
			"godotVersion": Engine.get_version_info(),
			"videoAdapter": RenderingServer.get_video_adapter_name(),
			"videoVendor": RenderingServer.get_video_adapter_vendor(),
		},
		"house01": house01_stats,
		"house02": house02_stats,
		"house02Lod1": house02_lod1_stats,
		"characterScaleReference": {
			"asset": CHARACTER,
			"runtimeScale": 1.2,
			"boundsMeters": character_bounds,
			"doorReferenceHeightMeters": 2.15,
		},
		"twoHouseTest": {
			"houseCount": 2,
			"houseTriangles": int(house01_stats.triangles) + int(house02_stats.triangles),
			"houseMeshSurfaces": int(house01_stats.surfaces) + int(house02_stats.surfaces),
			"screenshot": two_house_shot,
			"performance": two_metrics,
		},
		"tenHouseTest": {
			"houseCount": 10,
			"houseTriangles": 5 * int(house01_stats.triangles) + 5 * int(house02_stats.triangles),
			"houseMeshSurfaces": 5 * int(house01_stats.surfaces) + 5 * int(house02_stats.surfaces),
			"screenshot": ten_house_shot,
			"performance": ten_metrics,
		},
		"temporaryOnly": true,
		"promoted": false,
	}
	var report_path := OUTPUT_DIR + "/street-evaluation-report.json"
	var file := FileAccess.open(report_path, FileAccess.WRITE)
	if file == null:
		printerr("HOUSE_STREET_EVAL_ERROR cannot write report")
		quit(1)
		return
	file.store_string(JSON.stringify(report, "  "))
	file.close()
	print("HOUSE_STREET_EVAL_OK ", JSON.stringify(report))
	quit(0 if report.status == "PASS" else 1)


func _load_scene(path: String) -> PackedScene:
	var resource := ResourceLoader.load(path)
	return resource as PackedScene


func _build_world() -> void:
	world = Node3D.new()
	world.name = "TemporaryYunHouseEvaluation"
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
	_add_box("NearSidewalk", Vector3(48.0, 0.16, 1.35), Vector3(0.0, 0.0, 1.15), Color(0.63, 0.57, 0.47, 1.0))
	_add_box("FarSidewalk", Vector3(48.0, 0.16, 1.35), Vector3(0.0, 0.0, 10.45), Color(0.63, 0.57, 0.47, 1.0))
	_add_box("HouseLots", Vector3(48.0, 0.08, 28.0), Vector3(0.0, -0.08, 0.0), Color(0.32, 0.29, 0.24, 1.0))

	camera = Camera3D.new()
	camera.name = "RepresentativeYunGameplayCamera"
	camera.current = true
	camera.fov = 46.0
	camera.near = 0.12
	camera.far = 180.0
	world.add_child(camera)

	var overlay := CanvasLayer.new()
	get_root().add_child(overlay)
	title_label = Label.new()
	title_label.position = Vector2(28, 24)
	title_label.add_theme_font_size_override("font_size", 30)
	title_label.add_theme_color_override("font_color", Color(1.0, 0.96, 0.78, 1.0))
	title_label.add_theme_color_override("font_outline_color", Color(0.03, 0.04, 0.05, 0.95))
	title_label.add_theme_constant_override("outline_size", 8)
	overlay.add_child(title_label)


func _add_box(name: String, size: Vector3, position: Vector3, color: Color) -> void:
	var mesh_instance := MeshInstance3D.new()
	mesh_instance.name = name
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh_instance.mesh = mesh
	mesh_instance.position = position
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.9
	mesh_instance.material_override = material
	world.add_child(mesh_instance)


func _place_character(scene: PackedScene) -> void:
	character_instance = scene.instantiate() as Node3D
	character_instance.name = "YunScaleReference"
	character_instance.scale = Vector3.ONE * 1.2
	character_instance.position = Vector3(0.0, 0.08, 2.5)
	character_instance.rotation.y = PI
	world.add_child(character_instance)


func _place_house(scene: PackedScene, name: String, position: Vector3, yaw: float = 0.0) -> Node3D:
	var instance := scene.instantiate() as Node3D
	instance.name = name
	instance.position = position
	instance.rotation.y = yaw
	world.add_child(instance)
	house_instances.append(instance)
	return instance


func _place_two_houses(house01: PackedScene, house02: PackedScene) -> void:
	_place_house(house01, "House01", Vector3(-4.60, 0.0, -4.55))
	_place_house(house02, "House02", Vector3(4.65, 0.0, -4.55))


func _place_ten_houses(house01: PackedScene, house02: PackedScene) -> void:
	var x_positions := [-18.0, -9.0, 0.0, 9.0, 18.0]
	for index in x_positions.size():
		var front_scene: PackedScene = house01 if index % 2 == 0 else house02
		var back_scene: PackedScene = house02 if index % 2 == 0 else house01
		_place_house(front_scene, "NorthHouse_%d" % index, Vector3(x_positions[index], 0.0, -7.2))
		_place_house(back_scene, "SouthHouse_%d" % index, Vector3(x_positions[index], 0.0, 18.8), PI)


func _clear_houses() -> void:
	for house in house_instances:
		if is_instance_valid(house):
			house.free()
	house_instances.clear()


func _wait_frames(count: int) -> void:
	for _index in count:
		await process_frame


func _capture(filename: String) -> String:
	var image := get_root().get_texture().get_image()
	if image == null or image.is_empty():
		printerr("HOUSE_STREET_EVAL_CAPTURE_ERROR ", filename)
		return ""
	var path := OUTPUT_DIR + "/" + filename
	var error := image.save_png(ProjectSettings.globalize_path(path))
	if error != OK:
		printerr("HOUSE_STREET_EVAL_CAPTURE_ERROR ", filename, " code=", error)
		return ""
	return path


func _measure(frame_count: int) -> Dictionary:
	var frame_ms: Array[float] = []
	var draw_calls: Array[int] = []
	var primitives: Array[int] = []
	for _index in frame_count:
		var started := Time.get_ticks_usec()
		await process_frame
		frame_ms.append((Time.get_ticks_usec() - started) / 1000.0)
		draw_calls.append(RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME))
		primitives.append(RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_PRIMITIVES_IN_FRAME))
	frame_ms.sort()
	var average_ms := _average_float(frame_ms)
	var average_draw_calls := _average_int(draw_calls)
	var average_primitives := _average_int(primitives)
	var p95_index := clampi(int(ceil(frame_ms.size() * 0.95)) - 1, 0, frame_ms.size() - 1)
	return {
		"sampleFrames": frame_count,
		"averageFrameTimeMs": snappedf(average_ms, 0.001),
		"p95FrameTimeMs": snappedf(frame_ms[p95_index], 0.001),
		"maxFrameTimeMs": snappedf(frame_ms[-1], 0.001),
		"observedFpsFromAverage": snappedf(1000.0 / maxf(average_ms, 0.001), 0.1),
		"engineReportedFps": Engine.get_frames_per_second(),
		"averageDrawCalls": snappedf(average_draw_calls, 0.1),
		"averageRenderedPrimitives": snappedf(average_primitives, 0.1),
	}


func _average_float(values: Array[float]) -> float:
	var total := 0.0
	for value in values:
		total += value
	return total / maxf(values.size(), 1.0)


func _average_int(values: Array[int]) -> float:
	var total := 0.0
	for value in values:
		total += value
	return total / maxf(values.size(), 1.0)


func _scene_mesh_stats(node: Node) -> Dictionary:
	var stats := {"meshNodes": 0, "surfaces": 0, "vertices": 0, "triangles": 0, "materials": {}}
	_collect_mesh_stats(node, stats)
	node.free()
	return {
		"meshNodes": stats.meshNodes,
		"surfaces": stats.surfaces,
		"vertices": stats.vertices,
		"triangles": stats.triangles,
		"uniqueMaterialCount": stats.materials.size(),
	}


func _collect_mesh_stats(node: Node, stats: Dictionary) -> void:
	if node is MeshInstance3D:
		var mesh_instance := node as MeshInstance3D
		if mesh_instance.mesh != null:
			stats.meshNodes += 1
			stats.surfaces += mesh_instance.mesh.get_surface_count()
			for surface_index in mesh_instance.mesh.get_surface_count():
				var arrays := mesh_instance.mesh.surface_get_arrays(surface_index)
				var vertex_count := 0
				if arrays.size() > Mesh.ARRAY_VERTEX and arrays[Mesh.ARRAY_VERTEX] != null:
					vertex_count = arrays[Mesh.ARRAY_VERTEX].size()
					stats.vertices += vertex_count
				if arrays.size() > Mesh.ARRAY_INDEX and arrays[Mesh.ARRAY_INDEX] != null and arrays[Mesh.ARRAY_INDEX].size() > 0:
					stats.triangles += arrays[Mesh.ARRAY_INDEX].size() / 3
				else:
					stats.triangles += vertex_count / 3
				var material := mesh_instance.mesh.surface_get_material(surface_index)
				if material != null:
					stats.materials[str(material.resource_path, "|", material.resource_name)] = true
	for child in node.get_children():
		_collect_mesh_stats(child, stats)


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

