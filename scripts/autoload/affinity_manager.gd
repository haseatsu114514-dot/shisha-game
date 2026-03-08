extends Node

const MAX_LEVEL := 5
const CHAPTER_AFFINITY_CAP := {1: 3, 2: 4, 3: 5, 4: 5}

const DEFAULT_AFFINITIES := {
	"sumi": {"level": 0, "lime_exchanged": false, "met": true, "romance": false, "affection": 0},
	"naru": {"level": 0, "lime_exchanged": false, "met": false, "romance": false, "affection": 0},
	"adam": {"level": 0, "lime_exchanged": false, "met": false, "romance": false, "affection": 0},
	"minto": {"level": 0, "lime_exchanged": false, "met": false, "romance": false, "affection": 0},
	"tsumugi": {"level": 0, "lime_exchanged": false, "met": false, "romance": false, "affection": 0},
	"ageha": {"level": 0, "lime_exchanged": false, "met": false, "romance": false, "affection": 0},
}

const ROMANCE_CANDIDATES := ["minto", "tsumugi", "ageha"]

var affinities: Dictionary = DEFAULT_AFFINITIES.duplicate(true)


func reset_data() -> void:
	affinities = DEFAULT_AFFINITIES.duplicate(true)


func spend_time_with(char_id: String) -> int:
	if not affinities.has(char_id):
		return -1
	var current = int(affinities[char_id].get("level", 0))
	var cap = _get_current_cap()
	if current >= cap:
		return current
	affinities[char_id]["level"] = current + 1
	return current + 1


func _get_current_cap() -> int:
	var ch = 1
	if GameManager:
		ch = GameManager.current_chapter
	return int(CHAPTER_AFFINITY_CAP.get(ch, MAX_LEVEL))


func get_level(char_id: String) -> int:
	if not affinities.has(char_id):
		return 0
	return int(affinities[char_id].get("level", 0))


func is_max_level(char_id: String) -> bool:
	return get_level(char_id) >= MAX_LEVEL


func is_romance_candidate(char_id: String) -> bool:
	return char_id in ROMANCE_CANDIDATES


func set_romance(char_id: String, value: bool = true) -> void:
	if not affinities.has(char_id):
		return
	affinities[char_id]["romance"] = value
	if value and EventFlags:
		EventFlags.set_flag("romance_" + char_id)


func is_in_romance(char_id: String) -> bool:
	if not affinities.has(char_id):
		return false
	return bool(affinities[char_id].get("romance", false))


func get_romance_count() -> int:
	var count = 0
	for char_id in affinities.keys():
		if bool(affinities[char_id].get("romance", false)):
			count += 1
	return count


func is_two_timing() -> bool:
	return get_romance_count() >= 2


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


func add_affinity(char_id: String, amount: int) -> int:
	var _requested_amount = amount
	return spend_time_with(char_id)


func get_affinity(char_id: String) -> int:
	return get_level(char_id)


func get_max_level() -> int:
	return _get_current_cap()


func get_affection(char_id: String) -> int:
	if not affinities.has(char_id):
		return 0
	return int(affinities[char_id].get("affection", 0))


func add_affection(char_id: String, amount: int) -> int:
	if not affinities.has(char_id):
		return -1
	var current = int(affinities[char_id].get("affection", 0))
	var new_val = mini(5, maxi(0, current + amount))
	affinities[char_id]["affection"] = new_val
	return new_val


func is_max_affection(char_id: String) -> bool:
	return get_affection(char_id) >= 5


func get_star_text(char_id: String) -> String:
	return _build_star_text(get_level(char_id))


func _build_star_text(level: int) -> String:
	var clamped_level = mini(MAX_LEVEL, maxi(0, level))
	var stars := ""
	for i in range(MAX_LEVEL):
		stars += "★" if i < clamped_level else "☆"
	return stars


func to_save_data() -> Dictionary:
	return affinities.duplicate(true)


func from_save_data(data: Dictionary) -> void:
	affinities = DEFAULT_AFFINITIES.duplicate(true)
	for char_id in data.keys():
		if affinities.has(char_id):
			affinities[char_id] = data[char_id]
