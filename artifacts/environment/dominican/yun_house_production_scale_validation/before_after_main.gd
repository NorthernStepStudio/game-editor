extends SceneTree

const VIEWER_SCENE := "res://tests/_matterhorn_house_production_scale/before_after_viewer.tscn"


func _init() -> void:
	call_deferred("_open_viewer")


func _open_viewer() -> void:
	var packed := ResourceLoader.load(VIEWER_SCENE) as PackedScene
	if packed == null:
		printerr("YUN_HOUSE_BEFORE_AFTER_ERROR viewer scene failed to load")
		quit(1)
		return
	var viewer := packed.instantiate()
	get_root().add_child(viewer)
	print("YUN_HOUSE_BEFORE_AFTER_READY")


func _process(_delta: float) -> bool:
	# A custom SceneTree main loop exits when this returns true. Keep the visual
	# comparison alive until the user closes the window or presses Escape.
	return false
