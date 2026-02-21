extends Node

const DEFAULT_INTEL := {
	"naru": {"flavor_genre": "", "flavor_detail": "", "presentation": ""},
	"adam": {"flavor_genre": "", "flavor_detail": "", "presentation": ""},
	"minto": {"flavor_genre": "", "flavor_detail": "", "presentation": ""},
}

var intel: Dictionary = DEFAULT_INTEL.duplicate(true)


func reset_data() -> void:
	intel = DEFAULT_INTEL.duplicate(true)


func add_intel(rival_id: String, intel_type: String, info: String) -> void:
	if not intel.has(rival_id):
		return
	if not intel[rival_id].has(intel_type):
		return
	intel[rival_id][intel_type] = info


func get_intel(rival_id: String) -> Dictionary:
	if not intel.has(rival_id):
		return {}
	return intel[rival_id]


func get_intel_level(rival_id: String) -> int:
	if not intel.has(rival_id):
		return 0

	var level = 0
	for key in intel[rival_id].keys():
		if str(intel[rival_id].get(key, "")) != "":
			level += 1
	return level


func to_save_data() -> Dictionary:
	return intel.duplicate(true)


func from_save_data(data: Dictionary) -> void:
	intel = DEFAULT_INTEL.duplicate(true)
	for rival_id in data.keys():
		if intel.has(rival_id):
			intel[rival_id] = data[rival_id]
