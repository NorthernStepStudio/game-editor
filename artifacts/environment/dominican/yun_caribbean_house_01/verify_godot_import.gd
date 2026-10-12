@tool
extends SceneTree


func _init() -> void:
	var glb_path := "res://yun_caribbean_house_01.glb"
	if not FileAccess.file_exists(glb_path):
		printerr("HOUSE_GODOT_IMPORT_ERROR missing GLB")
		quit(1)
		return

	var resource := ResourceLoader.load(glb_path)
	if resource == null or not resource is PackedScene:
		printerr("HOUSE_GODOT_IMPORT_ERROR ResourceLoader did not return PackedScene")
		quit(1)
		return

	var instance := (resource as PackedScene).instantiate()
	if instance == null:
		printerr("HOUSE_GODOT_IMPORT_ERROR PackedScene instantiate failed")
		quit(1)
		return

	var counts := {"mesh_nodes": 0, "surfaces": 0, "vertices": 0}
	_collect_mesh_counts(instance, counts)
	if counts.mesh_nodes <= 0 or counts.surfaces <= 0 or counts.vertices <= 0:
		printerr("HOUSE_GODOT_IMPORT_ERROR empty mesh payload")
		quit(1)
		return

	print(
		"HOUSE_GODOT_IMPORT_OK root=", instance.name,
		" mesh_nodes=", counts.mesh_nodes,
		" surfaces=", counts.surfaces,
		" vertices=", counts.vertices
	)
	instance.queue_free()
	quit(0)


func _collect_mesh_counts(node: Node, counts: Dictionary) -> void:
	if node is MeshInstance3D:
		var mesh_instance := node as MeshInstance3D
		if mesh_instance.mesh != null:
			counts.mesh_nodes += 1
			counts.surfaces += mesh_instance.mesh.get_surface_count()
			for surface_index in mesh_instance.mesh.get_surface_count():
				var arrays := mesh_instance.mesh.surface_get_arrays(surface_index)
				if arrays.size() > Mesh.ARRAY_VERTEX and arrays[Mesh.ARRAY_VERTEX] != null:
					counts.vertices += arrays[Mesh.ARRAY_VERTEX].size()
	for child in node.get_children():
		_collect_mesh_counts(child, counts)
