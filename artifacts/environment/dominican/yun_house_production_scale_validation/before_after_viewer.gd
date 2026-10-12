extends Node3D

const TEST_ROOT := "res://tests/_matterhorn_house_production_scale"
const HOUSE_01_BEFORE := TEST_ROOT + "/yun_caribbean_house_01-before.glb"
const HOUSE_02_BEFORE := TEST_ROOT + "/yun_caribbean_house_02-before.glb"
const HOUSE_01_AFTER := TEST_ROOT + "/yun_caribbean_house_01.glb"
const HOUSE_02_AFTER := TEST_ROOT + "/yun_caribbean_house_02.glb"
const MiniFigure = preload("res://scripts/mini_figure.gd")
const CHARACTER_SCALE := 1.2

var house01_before: PackedScene
var house02_before: PackedScene
var house01_after: PackedScene
var house02_after: PackedScene
var camera: Camera3D
var title_label: Label
var before_label: Label
var after_label: Label
var footer_label: Label
var shown_houses: Array[Node3D] = []
var shown_characters: Array[Node3D] = []
var character_figures: Array = []
var mode := 1


func _ready() -> void:
	DisplayServer.window_set_title("Yun House Scale — Before / After")
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)
	DisplayServer.window_set_size(Vector2i(1920, 1080))
	house01_before = ResourceLoader.load(HOUSE_01_BEFORE) as PackedScene
	house02_before = ResourceLoader.load(HOUSE_02_BEFORE) as PackedScene
	house01_after = ResourceLoader.load(HOUSE_01_AFTER) as PackedScene
	house02_after = ResourceLoader.load(HOUSE_02_AFTER) as PackedScene
	_build_world()
	if house01_before == null or house02_before == null or house01_after == null or house02_after == null:
		title_label.text = "Comparison assets failed to load."
		return
	_show_house01_comparison()


func _unhandled_key_input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed or event.echo:
		return
	match event.keycode:
		KEY_1:
			_show_house01_comparison()
		KEY_2:
			_show_house02_comparison()
		KEY_3:
			_show_final_pair()
		KEY_ESCAPE:
			get_tree().quit()


func _show_house01_comparison() -> void:
	mode = 1
	_clear_content()
	_place_house(house01_before, "House01_Before", Vector3(-5.2, 0.0, -6.07))
	_place_house(house01_after, "House01_After", Vector3(4.2, 0.0, -3.41))
	_mount_character("Tito_Before", 0, Vector3(-5.2, 0.08, 1.15), PI)
	_mount_character("Tito_After", 0, Vector3(4.2, 0.08, 1.15), PI)
	title_label.text = "HOUSE 01 — SAME DESIGN, SAME CURRENT TITO, SAME CAMERA"
	before_label.text = "BEFORE\nARCHIVED OVERSIZED CANDIDATE"
	after_label.text = "AFTER\nNATIVE 0.55 GEOMETRY • IMPORT SCALE 1.0"
	_set_camera(Vector3(0.0, 7.4, 23.5), Vector3(0.0, 2.4, -2.2))


func _show_house02_comparison() -> void:
	mode = 2
	_clear_content()
	_place_house(house02_before, "House02_Before", Vector3(-5.2, 0.0, -5.84))
	_place_house(house02_after, "House02_After", Vector3(4.2, 0.0, -3.21))
	_mount_character("Tito_Before", 0, Vector3(-5.2, 0.08, 1.15), PI)
	_mount_character("Tito_After", 0, Vector3(4.2, 0.08, 1.15), PI)
	title_label.text = "HOUSE 02 — SAME DESIGN, SAME CURRENT TITO, SAME CAMERA"
	before_label.text = "BEFORE\nARCHIVED OVERSIZED CANDIDATE"
	after_label.text = "AFTER\nNATIVE 0.55 GEOMETRY • IMPORT SCALE 1.0"
	_set_camera(Vector3(0.0, 7.4, 23.5), Vector3(0.0, 2.4, -2.2))


func _show_final_pair() -> void:
	mode = 3
	_clear_content()
	_place_house(house01_after, "House01_Production", Vector3(-2.53, 0.0, -2.50))
	_place_house(house02_after, "House02_Production", Vector3(2.56, 0.0, -2.50))
	_mount_character("Paco", 2, Vector3(-3.35, 0.08, 2.15), PI)
	_mount_character("Tito", 0, Vector3(0.0, 0.08, 2.45), PI)
	_mount_character("Neno", 4, Vector3(3.45, 0.08, 2.15), PI)
	title_label.text = "AFTER — PRODUCTION PAIR WITH CURRENT PACO / TITO / NENO"
	before_label.text = ""
	after_label.text = "LOCKED BUILDING SCALE 0.55\nGLB ROOT SCALE 1.0 • CHARACTER SCALE UNCHANGED"
	_set_camera(Vector3(0.0, 8.6, 20.5), Vector3(0.0, 2.1, -1.5))


func _place_house(scene: PackedScene, instance_name: String, position: Vector3) -> void:
	var instance := scene.instantiate() as Node3D
	instance.name = instance_name
	instance.position = position
	instance.scale = Vector3.ONE
	add_child(instance)
	shown_houses.append(instance)


func _mount_character(instance_name: String, character_id: int, position: Vector3, yaw: float) -> void:
	var host := Node3D.new()
	host.name = instance_name
	host.position = position
	host.rotation.y = yaw
	add_child(host)
	var figure = MiniFigure.new()
	if figure.mount(host, character_id, Color.WHITE, CHARACTER_SCALE, false):
		shown_characters.append(host)
		character_figures.append(figure)
	else:
		host.queue_free()


func _clear_content() -> void:
	for house in shown_houses:
		if is_instance_valid(house):
			house.queue_free()
	for character in shown_characters:
		if is_instance_valid(character):
			character.queue_free()
	shown_houses.clear()
	shown_characters.clear()
	character_figures.clear()


func _build_world() -> void:
	var environment_node := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color(0.55, 0.64, 0.74, 1.0)
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color(0.62, 0.66, 0.72, 1.0)
	environment.ambient_light_energy = 0.85
	environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	environment_node.environment = environment
	add_child(environment_node)
	var sun := DirectionalLight3D.new()
	sun.light_color = Color(1.0, 0.95, 0.86, 1.0)
	sun.light_energy = 1.15
	sun.shadow_enabled = true
	sun.rotation_degrees = Vector3(-48.0, -28.0, -18.0)
	add_child(sun)
	_add_box("Ground", Vector3(36.0, 0.10, 28.0), Vector3(0.0, -0.08, -5.0), Color(0.34, 0.30, 0.24, 1.0))
	_add_box("Sidewalk", Vector3(36.0, 0.16, 1.35), Vector3(0.0, 0.0, 1.1), Color(0.64, 0.58, 0.48, 1.0))
	_add_box("Street", Vector3(36.0, 0.10, 8.0), Vector3(0.0, -0.05, 5.8), Color(0.16, 0.18, 0.20, 1.0))
	camera = Camera3D.new()
	camera.current = true
	camera.fov = 46.0
	camera.near = 0.12
	camera.far = 120.0
	add_child(camera)
	_build_overlay()


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
	add_child(instance)


func _build_overlay() -> void:
	var overlay := CanvasLayer.new()
	overlay.layer = 10
	add_child(overlay)
	title_label = _label(Vector2(28, 22), Vector2(1860, 52), 30, Color(1.0, 0.96, 0.78))
	overlay.add_child(title_label)
	before_label = _label(Vector2(130, 90), Vector2(720, 100), 26, Color(1.0, 0.78, 0.66))
	before_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	overlay.add_child(before_label)
	after_label = _label(Vector2(1070, 90), Vector2(720, 100), 26, Color(0.68, 1.0, 0.82))
	after_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	overlay.add_child(after_label)
	footer_label = _label(Vector2(28, 1005), Vector2(1860, 45), 22, Color.WHITE)
	footer_label.text = "PRESS 1: HOUSE 01   •   PRESS 2: HOUSE 02   •   PRESS 3: FINAL PRODUCTION PAIR   •   ESC: CLOSE"
	footer_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	overlay.add_child(footer_label)


func _label(position: Vector2, size: Vector2, font_size: int, color: Color) -> Label:
	var label := Label.new()
	label.position = position
	label.size = size
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	label.add_theme_color_override("font_outline_color", Color(0.03, 0.04, 0.05, 0.96))
	label.add_theme_constant_override("outline_size", 8)
	return label


func _set_camera(position: Vector3, target: Vector3) -> void:
	camera.position = position
	camera.look_at(target, Vector3.UP)

