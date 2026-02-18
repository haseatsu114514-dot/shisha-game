extends Node

const DEFAULT_AFFINITIES := {
	"nishio": {"level": 0, "lime_exchanged": false, "met": false},
	"adam": {"level": 0, "lime_exchanged": false, "met": false},
	"ryuji": {"level": 0, "lime_exchanged": false, "met": false},
	"tsumugi": {"level": 0, "lime_exchanged": false, "met": false},
}

var affinities: Dictionary = DEFAULT_AFFINITIES.duplicate(true)


func reset_data() -> void:
	affinities = DEFAULT_AFFINITIES.duplicate(true)


func add_affinity(char_id: String, amount: int) -> void:
	if not affinities.has(char_id):
		return
	affinities[char_id]["level"] = maxi(0, int(affinities[char_id].get("level", 0)) + amount)


func get_affinity(char_id: String) -> int:
	if not affinities.has(char_id):
		return 0
	return int(affinities[char_id].get("level", 0))


func exchange_lime(char_id: String) -> void:
	if not affinities.has(char_id):
		return
	affinities[char_id]["lime_exchanged"] = true
	affinities[char_id]["met"] = true


func has_lime(char_id: String) -> bool:
	if not affinities.has(char_id):
		return false
	return bool(affinities[char_id].get("lime_exchanged", false))


func set_met(char_id: String, met: bool = true) -> void:
	if not affinities.has(char_id):
		return
	affinities[char_id]["met"] = met


func is_met(char_id: String) -> bool:
	if not affinities.has(char_id):
		return false
	return bool(affinities[char_id].get("met", false))


func get_characters_with_lime() -> Array:
	var result: Array = []
	for char_id in affinities.keys():
		if bool(affinities[char_id].get("lime_exchanged", false)):
			result.append(char_id)
	return result


func to_save_data() -> Dictionary:
	return affinities.duplicate(true)


func from_save_data(data: Dictionary) -> void:
	affinities = DEFAULT_AFFINITIES.duplicate(true)
	for char_id in data.keys():
		if affinities.has(char_id):
			affinities[char_id] = data[char_id]
