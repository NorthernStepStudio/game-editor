extends SceneTree

const MiniFigure = preload("res://scripts/mini_figure.gd")
const GAMEPLAY_SCALE := 1.2


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	var results: Array[Dictionary] = []
	for index in MiniFigure.count():
		var host := Node3D.new()
		host.name = "RosterProbe_%d" % index
		get_root().add_child(host)
		var figure = MiniFigure.new()
		var mounted: bool = figure.mount(host, index, Color.WHITE, GAMEPLAY_SCALE, false)
		if not mounted:
			printerr("ROSTER_SIZE_PROBE_ERROR index=", index, " ", figure.last_mount_error)
			quit(1)
			return
		await process_frame
		var bounds := _node_bounds(host)
		results.append({
			"index": index,
			"name": MiniFigure.display_name(index),
			"asset": MiniFigure.model_path(index),
			"runtimeScale": GAMEPLAY_SCALE,
			"bounds": bounds,
		})
		host.free()
		await process_frame
	print("ROSTER_SIZE_PROBE_OK ", JSON.stringify(results))
	quit(0)


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
