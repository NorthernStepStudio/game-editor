extends SceneTree

const TEST_ROOT := "res://tests/_matterhorn_house_production_scale"
const OUTPUT_DIR := TEST_ROOT + "/output"
const HOUSE_01 := TEST_ROOT + "/yun_caribbean_house_01.glb"
const HOUSE_02 := TEST_ROOT + "/yun_caribbean_house_02.glb"
const HOUSE_02_LOD1 := TEST_ROOT + "/yun_caribbean_house_02_lod1.glb"
const MiniFigure = preload("res://scripts/mini_figure.gd")
const LOCKED_BUILDING_SCALE := 0.55
const GAMEPLAY_CHARACTER_SCALE := 1.2
const PACO_ID := 2
const TITO_ID := 0
const NENO_ID := 4
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
	var house02_lod1 := ResourceLoader.load(HOUSE_02_LOD1) as PackedScene
	if house01 == null or house02 == null or house02_lod1 == null:
		printerr("HOUSE_PRODUCTION_SCALE_ERROR required house PackedScene missing")
		quit(1)
		return
	for character_id in [PACO_ID, TITO_ID, NENO_ID]:
		if not _mount_character(character_id):
			quit(1)
			return

	var house01_audit := _scene_audit(house01)
	var house02_audit := _scene_audit(house02)
	var house02_lod1_audit := _scene_audit(house02_lod1)
	var screenshots := {}

	_clear_houses()
	_place_house(house01, "House01", Vector3(0.0, 0.0, -2.50))
	_show_characters([TITO_ID])
	_move_character(TITO_ID, Vector3(-0.75, 0.08, 1.75), PI)
	_set_title("HOUSE 01  •  NATIVE SCALE 1.0  •  CURRENT TITO")
	_set_camera(Vector3(0.0, 4.8, 11.5), Vector3(0.0, 1.75, -1.1))
	await _wait_frames(60)
	screenshots.house01 = _capture("house01-native-scale-tito.png")

	_move_character(TITO_ID, Vector3(2.08, 0.08, -0.10), PI * 0.5)
	_set_title("HOUSE 01 STAIR + COLLISION  •  NATIVE SCALE 1.0")
	_set_camera(Vector3(8.3, 4.5, 5.6), Vector3(0.65, 1.65, -1.85))
	await _wait_frames(45)
	screenshots.house01_side = _capture("house01-native-scale-stair-side.png")
	var house01_collision_probes := await _collision_probes_house01()

	_clear_houses()
	_place_house(house02, "House02", Vector3(0.0, 0.0, -2.50))
	_show_characters([TITO_ID])
	_move_character(TITO_ID, Vector3(1.20, 0.08, 1.75), PI)
	_set_title("HOUSE 02  •  NATIVE SCALE 1.0  •  CURRENT TITO")
	_set_camera(Vector3(0.0, 4.8, 11.5), Vector3(0.0, 1.75, -1.1))
	await _wait_frames(60)
	screenshots.house02 = _capture("house02-native-scale-tito.png")
	var house02_collision_probes := await _collision_probes_house02()

	_clear_houses()
	_place_pair(house01, house02)
	_show_characters([PACO_ID, TITO_ID, NENO_ID])
	_move_character(PACO_ID, Vector3(-3.35, 0.08, 2.15), PI)
	_move_character(TITO_ID, Vector3(0.0, 0.08, 2.45), PI)
	_move_character(NENO_ID, Vector3(3.45, 0.08, 2.15), PI)
	_set_title("PRODUCTION-SCALE PAIR  •  PACO / TITO / NENO  •  GAMEPLAY CAMERA")
	_set_camera(Vector3(0.0, 8.6, 20.5), Vector3(0.0, 2.1, -1.5))
	await _wait_frames(75)
	screenshots.two_houses = _capture("two-house-native-scale-gameplay-camera.png")
	var two_house_performance := await _measure(240)

	_clear_houses()
	_show_characters([])
	_place_ten_houses(house01, house02)
	_set_title("PRODUCTION PERFORMANCE  •  10 NATIVE-SCALE LOD0 HOUSES")
	_set_camera(Vector3(18.0, 12.0, 24.0), Vector3(0.0, 2.0, 0.0))
	await _wait_frames(90)
	screenshots.ten_houses = _capture("ten-house-native-scale-performance.png")
	var ten_house_performance := await _measure(360)

	var characters := {}
	for character_id in [PACO_ID, TITO_ID, NENO_ID]:
		var host := character_hosts[character_id] as Node3D
		characters[MiniFigure.display_name(character_id)] = {
			"rosterIndex": character_id,
			"asset": MiniFigure.model_path(character_id),
			"runtimeScale": GAMEPLAY_CHARACTER_SCALE,
			"bounds": _node_bounds(host),
		}

	var checks := {
		"screenshotsComplete": _screenshots_complete(screenshots),
		"house01RootScaleOne": house01_audit.rootScaleOne,
		"house02RootScaleOne": house02_audit.rootScaleOne,
		"house02Lod1RootScaleOne": house02_lod1_audit.rootScaleOne,
		"house01NoScaledParentTrick": house01_audit.allNodeScalesOne,
		"house02NoScaledParentTrick": house02_audit.allNodeScalesOne,
		"house02Lod1NoScaledParentTrick": house02_lod1_audit.allNodeScalesOne,
		"house01GroundAligned": abs(float(house01_audit.bounds.minimum[1])) <= 0.005,
		"house02GroundAligned": abs(float(house02_audit.bounds.minimum[1])) <= 0.005,
		"house01CollisionImported": int(house01_audit.collisionShapes) >= 16,
		"house02CollisionImported": int(house02_audit.collisionShapes) >= 3,
		"house02Lod1CollisionImported": int(house02_lod1_audit.collisionShapes) >= 3,
		"house01CollisionProbesHit": _all_probes_hit(house01_collision_probes),
		"house02CollisionProbesHit": _all_probes_hit(house02_collision_probes),
		"currentRosterCharactersMounted": characters.size() == 3,
		"characterScaleUnchanged": GAMEPLAY_CHARACTER_SCALE == 1.2,
		"cameraMatchesGameplayReference": is_equal_approx(camera.fov, 46.0) and is_equal_approx(camera.near, 0.12),
	}
	var status := "PASS"
	for check_value in checks.values():
		if not bool(check_value):
			status = "FAIL"
			break

	var report := {
		"schemaVersion": "1.0.0",
		"status": status,
		"lockedBuildingScale": LOCKED_BUILDING_SCALE,
		"nativeImportScale": 1.0,
		"projectName": ProjectSettings.get_setting("application/config/name", "unknown"),
		"runtime": {
			"godotVersion": Engine.get_version_info(),
			"videoAdapter": RenderingServer.get_video_adapter_name(),
			"videoVendor": RenderingServer.get_video_adapter_vendor(),
		},
		"camera": {
			"fov": camera.fov,
			"near": camera.near,
			"far": camera.far,
			"viewport": [EVALUATION_SIZE.x, EVALUATION_SIZE.y],
		},
		"house01": house01_audit,
		"house02": house02_audit,
		"house02Lod1": house02_lod1_audit,
		"characters": characters,
		"collisionProbes": {
			"house01": house01_collision_probes,
			"house02": house02_collision_probes,
		},
		"twoHouseTest": {
			"houseCount": 2,
			"triangles": int(house01_audit.triangles) + int(house02_audit.triangles),
			"meshSurfaces": int(house01_audit.surfaces) + int(house02_audit.surfaces),
			"performance": two_house_performance,
		},
		"tenHouseTest": {
			"houseCount": 10,
			"triangles": 5 * int(house01_audit.triangles) + 5 * int(house02_audit.triangles),
			"meshSurfaces": 5 * int(house01_audit.surfaces) + 5 * int(house02_audit.surfaces),
			"performance": ten_house_performance,
		},
		"checks": checks,
		"screenshots": screenshots,
		"temporaryOnly": true,
		"liveYunMapChanged": false,
		"characterScaleChanged": false,
	}
	var report_file := FileAccess.open(OUTPUT_DIR + "/production-scale-validation-report.json", FileAccess.WRITE)
	if report_file == null:
		printerr("HOUSE_PRODUCTION_SCALE_ERROR cannot write report")
		quit(1)
		return
	report_file.store_string(JSON.stringify(report, "  "))
	report_file.close()
	print("HOUSE_PRODUCTION_SCALE_OK ", JSON.stringify(report))
	quit(0 if status == "PASS" else 1)


func _mount_character(character_id: int) -> bool:
	var host := Node3D.new()
	host.name = MiniFigure.display_name(character_id)
	world.add_child(host)
	var figure = MiniFigure.new()
	if not figure.mount(host, character_id, Color.WHITE, GAMEPLAY_CHARACTER_SCALE, false):
		printerr("HOUSE_PRODUCTION_SCALE_ERROR character mount failed: ", figure.last_mount_error)
		host.free()
		return false
	character_hosts[character_id] = host
	character_figures.append(figure)
	return true


func _show_characters(ids: Array) -> void:
	for character_id in character_hosts.keys():
		(character_hosts[character_id] as Node3D).visible = ids.has(character_id)


func _move_character(character_id: int, position: Vector3, yaw: float) -> void:
	var host := character_hosts[character_id] as Node3D
	host.position = position
	host.rotation = Vector3(0.0, yaw, 0.0)


func _place_house(scene: PackedScene, instance_name: String, position: Vector3, yaw: float = 0.0) -> Node3D:
	var instance := scene.instantiate() as Node3D
	instance.name = instance_name
	instance.position = position
	instance.rotation.y = yaw
	instance.scale = Vector3.ONE
	world.add_child(instance)
	houses.append(instance)
	return instance


func _place_pair(house01: PackedScene, house02: PackedScene) -> void:
	_place_house(house01, "House01", Vector3(-2.53, 0.0, -2.50))
	_place_house(house02, "House02", Vector3(2.56, 0.0, -2.50))


func _place_ten_houses(house01: PackedScene, house02: PackedScene) -> void:
	var x_positions := [-10.0, -5.0, 0.0, 5.0, 10.0]
	for index in x_positions.size():
		var front_scene: PackedScene = house01 if index % 2 == 0 else house02
		var back_scene: PackedScene = house02 if index % 2 == 0 else house01
		_place_house(front_scene, "FrontHouse_%d" % index, Vector3(x_positions[index], 0.0, -3.2))
		_place_house(back_scene, "BackHouse_%d" % index, Vector3(x_positions[index], 0.0, 6.2), PI)


func _clear_houses() -> void:
	for house in houses:
		if is_instance_valid(house):
			house.free()
	houses.clear()


func _build_world() -> void:
	world = Node3D.new()
	world.name = "TemporaryProductionHouseScaleValidation"
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
	var p95_index := clampi(int(ceil(frame_ms.size() * 0.95)) - 1, 0, frame_ms.size() - 1)
	return {
		"sampleFrames": frame_count,
		"averageFrameTimeMs": snappedf(average_ms, 0.001),
		"p95FrameTimeMs": snappedf(frame_ms[p95_index], 0.001),
		"maxFrameTimeMs": snappedf(frame_ms[-1], 0.001),
		"observedFpsFromAverage": snappedf(1000.0 / maxf(average_ms, 0.001), 0.1),
		"engineReportedFps": Engine.get_frames_per_second(),
		"averageDrawCalls": snappedf(_average_int(draw_calls), 0.1),
		"averageRenderedPrimitives": snappedf(_average_int(primitives), 0.1),
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


func _scene_audit(scene: PackedScene) -> Dictionary:
	var instance := scene.instantiate() as Node3D
	# Bounds based on global transforms are only valid after the imported scene
	# enters a SceneTree. The audit instance is temporary and freed immediately.
	world.add_child(instance)
	var stats := {
		"meshNodes": 0,
		"surfaces": 0,
		"vertices": 0,
		"triangles": 0,
		"materials": {},
		"staticBodies": 0,
		"collisionShapes": 0,
		"collisionShapeTypes": {},
		"allNodeScalesOne": true,
	}
	_collect_scene_audit(instance, stats)
	var bounds := _node_bounds(instance)
	var result := {
		"rootName": instance.name,
		"rootScale": [instance.scale.x, instance.scale.y, instance.scale.z],
		"rootScaleOne": instance.scale.is_equal_approx(Vector3.ONE),
		"allNodeScalesOne": stats.allNodeScalesOne,
		"bounds": bounds,
		"meshNodes": stats.meshNodes,
		"surfaces": stats.surfaces,
		"vertices": stats.vertices,
		"triangles": stats.triangles,
		"materialCount": stats.materials.size(),
		"staticBodies": stats.staticBodies,
		"collisionShapes": stats.collisionShapes,
		"collisionShapeTypes": stats.collisionShapeTypes.keys(),
	}
	instance.free()
	return result


func _collect_scene_audit(node: Node, stats: Dictionary) -> void:
	if node is Node3D and not (node as Node3D).scale.is_equal_approx(Vector3.ONE):
		stats.allNodeScalesOne = false
	if node is StaticBody3D:
		stats.staticBodies += 1
	if node is CollisionShape3D:
		var collision_shape := node as CollisionShape3D
		stats.collisionShapes += 1
		if collision_shape.shape != null:
			stats.collisionShapeTypes[collision_shape.shape.get_class()] = true
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
		_collect_scene_audit(child, stats)


func _collision_probes_house01() -> Dictionary:
	await physics_frame
	await physics_frame
	return {
		"buildingShell": _ray_hit(Vector3(0.0, 6.0, -2.5), Vector3(0.0, -1.0, -2.5)),
		"exteriorStair": _ray_hit(Vector3(1.77, 4.0, 0.22), Vector3(1.77, -1.0, 0.22)),
		"balconyBoundary": _ray_hit(Vector3(0.23, 2.02, 1.3), Vector3(0.23, 2.02, 0.2)),
	}


func _collision_probes_house02() -> Dictionary:
	await physics_frame
	await physics_frame
	return {
		"buildingShell": _ray_hit(Vector3(0.0, 6.0, -2.5), Vector3(0.0, -1.0, -2.5)),
		"garageFront": _ray_hit(Vector3(-0.85, 0.80, 2.5), Vector3(-0.85, 0.80, -2.5)),
		"balconyBoundary": _ray_hit(Vector3(-0.86, 2.05, 1.2), Vector3(-0.86, 2.05, 0.0)),
	}


func _ray_hit(from: Vector3, to: Vector3) -> Dictionary:
	var query := PhysicsRayQueryParameters3D.create(from, to)
	query.collide_with_areas = false
	query.collide_with_bodies = true
	var result := world.get_world_3d().direct_space_state.intersect_ray(query)
	return {
		"hit": not result.is_empty(),
		"collider": String(result.get("collider").name) if not result.is_empty() else "",
		"position": [result.position.x, result.position.y, result.position.z] if not result.is_empty() else [],
	}


func _all_probes_hit(probes: Dictionary) -> bool:
	for probe in probes.values():
		if not bool(probe.hit):
			return false
	return true


func _screenshots_complete(screenshots: Dictionary) -> bool:
	if screenshots.size() != 5:
		return false
	for path in screenshots.values():
		if String(path).is_empty():
			return false
	return true


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
