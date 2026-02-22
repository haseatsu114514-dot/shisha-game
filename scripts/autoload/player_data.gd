extends Node

const FLAVOR_NAME_MAP := {
	"double_apple": "アルファーヘブン ダブルアップル",
	"mint": "アルファーヘブン ミント",
	"blueberry": "アルファーヘブン ブルーベリー",
	"mango": "マンゴー",
	"vanilla": "アルファーヘブン バニラ",
	"pineapple": "アルファーヘブン パイナップル",
	"coconut": "アルファーヘブン ココナッツ",
}

const DEFAULT_BOWL: String = "silicone_bowl"
const DEFAULT_HMS := "lotos_hagal"
const DEFAULT_CHARCOAL: String = "flat"
const DEFAULT_PIPE: String = "pipe_cheap"

const LEGACY_BOWL_MAP := {
	"standard": DEFAULT_BOWL,
	"funnel": "hagal_80beat",
	"funnel_bowl": "hagal_80beat",
	"suyaki_hagal": "suyaki",
}

const LEGACY_HMS_MAP := {
	"normal": DEFAULT_HMS,
	"kaloud": DEFAULT_HMS,
	"kaloud_hms": DEFAULT_HMS,
	"amaburst_hms": "amaburst",
}

const LEGACY_CHARCOAL_MAP := {
	"default_charcoal": DEFAULT_CHARCOAL,
	"flat": DEFAULT_CHARCOAL,
	"cube": "cube_charcoal",
}

const EQUIPMENT_NAME_MAP := {
	"silicone_bowl": "シリコンボウル",
	"hagal_80beat": "80beatハガル",
	"suyaki": "素焼きハガル",
	"lotos_hagal": "ロートスハガル",
	"tanukish_lid": "タヌキッシュリッド",
	"amaburst": "アマバースト",
	"winkwink_hagal": "winkwinkハガル",
	"flat_charcoal": "フラット炭",
	"cube_charcoal": "キューブ炭",
}

const BOWL_EQUIPMENT_IDS := [
	DEFAULT_BOWL,
	"hagal_80beat",
	"suyaki",
]

const HMS_EQUIPMENT_IDS := [
	DEFAULT_HMS,
	"tanukish_lid",
	"amaburst",
	"winkwink_hagal",
]

const CHARCOAL_EQUIPMENT_IDS := [
	DEFAULT_CHARCOAL,
	"cube_charcoal",
]

const STAT_LABEL_MAP := {
	"technique": "技術",
	"sense": "味覚",
	"taste": "味覚",
	"guts": "度胸",
	"charm": "魅力",
	"insight": "洞察",
}

const PRACTICE_LABEL_MAP := {
	"packing": "パッキング",
	"aroma": "香り",
	"presentation": "プレゼン",
	"rush": "忙しい時間帯",
}

const FLAVOR_SPECIALTY_KEYS := [
	"sweet",
	"cooling",
	"fruit",
	"spice",
	"floral",
	"special",
]

const FLAVOR_SPECIALTY_LABEL_MAP := {
	"sweet": "甘い系",
	"cooling": "清涼系",
	"fruit": "フルーツ系",
	"spice": "スパイス系",
	"floral": "フローラル系",
	"special": "特殊系",
}

const FLAVOR_SPECIALTY_ALIAS_MAP := {
	"sweet": "sweet",
	"甘い系": "sweet",
	"cooling": "cooling",
	"清涼系": "cooling",
	"fruit": "fruit",
	"フルーツ系": "fruit",
	"spice": "spice",
	"スパイス系": "spice",
	"floral": "floral",
	"フローラル系": "floral",
	"special": "special",
	"特殊系": "special",
}

const FLAVOR_PRIMARY_CATEGORY_MAP := {
	"vanilla": "sweet",
	"coconut": "sweet",
	"mint": "cooling",
	"pineapple": "fruit",
	"blueberry": "fruit",
	"mango": "fruit",
	"double_apple": "spice",
}

const DEFAULT_FLAVOR_SPECIALTIES := {
	"sweet": 10,
	"cooling": 10,
	"fruit": 10,
	"spice": 10,
	"floral": 10,
	"special": 10,
}

const CHARACTER_DATA_PATH := "res://data/characters.json"

const ALPHA_HEAVEN_FLAVOR_IDS := [
	"mint",
	"double_apple",
	"blueberry",
	"vanilla",
	"pineapple",
	"coconut",
]

const BOWL_PRACTICE_BONUS := {
	"silicone_bowl": {
		"packing": {"technique": 1},
		"rush": {"guts": 1},
	},
	"hagal_80beat": {
		"packing": {"technique": 1},
		"aroma": {"sense": 1},
	},
	"suyaki": {
		"aroma": {"sense": 1},
		"presentation": {"charm": 1},
	},
	"suyaki_naru": {
		"aroma": {"sense": 2},
		"presentation": {"charm": 1},
		"packing": {"technique": 1},
	},
	"suyaki_adam": {
		"packing": {"technique": 2},
		"aroma": {"sense": 1},
		"rush": {"guts": 1},
	},
	"suyaki_minto": {
		"presentation": {"charm": 2},
		"aroma": {"sense": 1},
		"packing": {"technique": 1},
	},
}

const HMS_PRACTICE_BONUS := {
	"lotos_hagal": {
		"packing": {"technique": 1},
		"aroma": {"sense": 1},
	},
	"tanukish_lid": {
		"packing": {"technique": 1},
		"rush": {"guts": 1},
	},
	"amaburst": {
		"packing": {"technique": 1},
		"rush": {"guts": 2},
		"presentation": {"charm": 1},
	},
	"winkwink_hagal": {
		"presentation": {"charm": 2},
		"aroma": {"sense": 1},
	},
}

const CHARCOAL_PRACTICE_BONUS := {
	"flat_charcoal": {
		"packing": {"technique": 1},
		"aroma": {"sense": 1},
	},
	"cube_charcoal": {
		"rush": {"guts": 1},
		"presentation": {"charm": 1},
	},
}

const COMBO_PRACTICE_BONUS := {
	"silicone_bowl:lotos_hagal": {
		"packing": {"technique": 1},
		"aroma": {"sense": 1},
	},
	"hagal_80beat:tanukish_lid": {
		"packing": {"technique": 1},
		"rush": {"guts": 2},
	},
	"hagal_80beat:amaburst": {
		"packing": {"technique": 1},
		"rush": {"guts": 1},
	},
	"hagal_80beat:winkwink_hagal": {
		"presentation": {"charm": 2},
	},
	"suyaki:lotos_hagal": {
		"aroma": {"sense": 1, "insight": 1},
	},
	"suyaki:amaburst": {
		"packing": {"technique": 1},
		"rush": {"guts": 1, "insight": 1},
		"presentation": {"charm": 1},
	},
	"suyaki:winkwink_hagal": {
		"aroma": {"sense": 2, "insight": 1},
		"presentation": {"charm": 1},
	},
}

const COMBO_NAME_MAP := {
	"silicone_bowl:lotos_hagal": "スターター安定セット",
	"hagal_80beat:tanukish_lid": "大会安定セット",
	"hagal_80beat:amaburst": "高火力コントロールセット",
	"hagal_80beat:winkwink_hagal": "魅せ煙セット",
	"suyaki:lotos_hagal": "基礎育成セット",
	"suyaki:amaburst": "素焼き高火力育成セット",
	"suyaki:winkwink_hagal": "育成特化セット",
}

var stat_technique: int = 10
var stat_sense: int = 10
var stat_guts: int = 10
var stat_charm: int = 15
var stat_insight: int = 20

var money: int = 30000

var flavor_inventory: Array = []
var flavor_specialties: Dictionary = DEFAULT_FLAVOR_SPECIALTIES.duplicate(true)
var character_flavor_profiles: Dictionary = {}

var equipment_hms: String = DEFAULT_HMS
var equipment_bowl: String = DEFAULT_BOWL
var equipment_charcoal: String = DEFAULT_CHARCOAL
var equipment_pipe: String = DEFAULT_PIPE
var owned_bowls: Array[String] = [DEFAULT_BOWL]
var owned_hms: Array[String] = [DEFAULT_HMS]
var owned_charcoals: Array[String] = [DEFAULT_CHARCOAL]
var owned_pipes: Array[String] = [DEFAULT_PIPE]

var recipe_note: Array = []
var memo_seen_ids: Dictionary = {}
var unlocked_cards: Array = []


func _ready() -> void:
	_load_character_flavor_profiles()
	_ensure_flavor_specialty_state()


func reset_data() -> void:
	stat_technique = 10
	stat_sense = 10
	stat_guts = 10
	stat_charm = 15
	stat_insight = 20
	money = 30000
	flavor_inventory.clear()
	flavor_specialties = DEFAULT_FLAVOR_SPECIALTIES.duplicate(true)
	equipment_bowl = DEFAULT_BOWL
	equipment_hms = DEFAULT_HMS
	equipment_charcoal = DEFAULT_CHARCOAL
	owned_bowls = [DEFAULT_BOWL]
	owned_hms = [DEFAULT_HMS]
	owned_charcoals = [DEFAULT_CHARCOAL]
	recipe_note.clear()
	memo_seen_ids.clear()
	unlocked_cards.clear()


func add_stat(stat_name: String, amount: int) -> void:
	var normalized = _normalize_stat_name(stat_name)
	match normalized:
		"technique":
			stat_technique = clampi(stat_technique + amount, 0, 100)
		"sense":
			stat_sense = clampi(stat_sense + amount, 0, 100)
		"guts":
			stat_guts = clampi(stat_guts + amount, 0, 100)
		"charm":
			stat_charm = clampi(stat_charm + amount, 0, 100)
		"insight":
			stat_insight = clampi(stat_insight + amount, 0, 100)


func get_stat_value(stat_name: String) -> int:
	var normalized = _normalize_stat_name(stat_name)
	match normalized:
		"technique":
			return stat_technique
		"sense":
			return stat_sense
		"guts":
			return stat_guts
		"charm":
			return stat_charm
		"insight":
			return stat_insight
		_:
			return 0


func get_stat_stars(stat_name: String) -> int:
	var value = get_stat_value(stat_name)
	return clampi(int(ceil(value / 20.0)), 1, 5)


func _normalize_stat_name(stat_name: String) -> String:
	if stat_name == "taste":
		return "sense"
	return stat_name


func add_money(amount: int) -> void:
	money = maxi(0, money + amount)


func has_item(type: String, item_id: String) -> bool:
	match type:
		"bowl":
			return owned_bowls.has(item_id)
		"hms":
			return owned_hms.has(item_id)
		"charcoal":
			return owned_charcoals.has(item_id)
		"pipe":
			return owned_pipes.has(item_id)
	return false

func get_equipped_item_name(type: String) -> String:
	match type:
		"bowl":
			return get_equipment_name_by_value(equipment_bowl)
		"hms":
			return get_equipment_name_by_value(equipment_hms)
		"charcoal":
			return get_equipment_name_by_value(equipment_charcoal)
		"pipe":
			return get_equipment_name_by_value(equipment_pipe)
	return "UNKNOWN"


func get_equipment_name_by_value(value: String) -> String:
	return str(EQUIPMENT_NAME_MAP.get(value, value))



func get_equipped_value(slot_type: String) -> String:
	if slot_type == "bowl":
		return equipment_bowl
	if slot_type == "hms":
		return equipment_hms
	if slot_type == "charcoal":
		return equipment_charcoal
	return ""

func get_equipped_item_name(slot_type: String) -> String:
	return get_equipment_name_by_value(get_equipped_value(slot_type))


func get_equipment_combo_key() -> String:
	return "%s:%s" % [equipment_bowl, equipment_hms]


func get_equipment_set_name() -> String:
	var combo_key = get_equipment_combo_key()
	var core_set_name = "汎用セッティング"
	if COMBO_NAME_MAP.has(combo_key):
		core_set_name = str(COMBO_NAME_MAP.get(combo_key, ""))
	return "%s / %s" % [core_set_name, get_charcoal_profile_name()]


func get_charcoal_profile_name() -> String:
	match equipment_charcoal:
		"flat_charcoal":
			return "安定火力"
		"cube_charcoal":
			return "高火力チキンレース"
		_:
			return get_equipment_name_by_value(equipment_charcoal)


func get_heat_strategy_hint() -> String:
	if equipment_charcoal == "cube_charcoal":
		return "有効範囲が狭い代わりに、成功時のリターンが大きい。"
	return "有効範囲が広く、安定して火力を乗せやすい。"


func has_owned_equipment(slot_type: String, value: String) -> bool:
	var normalized = _normalize_equipment_value(slot_type, value)
	if normalized == "":
		return false
	if slot_type == "bowl":
		return owned_bowls.has(normalized)
	if slot_type == "hms":
		return owned_hms.has(normalized)
	if slot_type == "charcoal":
		return owned_charcoals.has(normalized)
	return false


func add_owned_equipment(slot_type: String, value: String) -> bool:
	var normalized = _normalize_equipment_value(slot_type, value)
	if normalized == "":
		return false
	if slot_type == "bowl":
		if owned_bowls.has(normalized):
			return false
		owned_bowls.append(normalized)
		return true
	if slot_type == "hms":
		if owned_hms.has(normalized):
			return false
		owned_hms.append(normalized)
		return true
	if slot_type == "charcoal":
		if owned_charcoals.has(normalized):
			return false
		owned_charcoals.append(normalized)
		return true
	return false


func remove_owned_equipment(slot_type: String, value: String) -> bool:
	var normalized = _normalize_equipment_value(slot_type, value)
	if normalized == "":
		return false
	if slot_type == "bowl":
		if not owned_bowls.has(normalized):
			return false
		owned_bowls.erase(normalized)
		return true
	if slot_type == "hms":
		if not owned_hms.has(normalized):
			return false
		owned_hms.erase(normalized)
		return true
	if slot_type == "charcoal":
		if not owned_charcoals.has(normalized):
			return false
		owned_charcoals.erase(normalized)
		return true
	return false


func is_equipment_pair_compatible(bowl_value: String, hms_value: String) -> bool:
	var normalized_bowl = _normalize_equipment_value("bowl", bowl_value)
	var normalized_hms = _normalize_equipment_value("hms", hms_value)
	if normalized_bowl == "" or normalized_hms == "":
		return false
	return not (normalized_bowl == "suyaki" and normalized_hms == "tanukish_lid")


func can_equip(slot_type: String, value: String) -> bool:
	var normalized = _normalize_equipment_value(slot_type, value)
	if normalized == "":
		return false
	if slot_type == "charcoal":
		return true

	var next_bowl = equipment_bowl
	var next_hms = equipment_hms
	if slot_type == "bowl":
		next_bowl = normalized
	elif slot_type == "hms":
		next_hms = normalized
	else:
		return false

	return is_equipment_pair_compatible(next_bowl, next_hms)


func get_equipment_flavor_bonus(flavors: Array[String]) -> Dictionary:
	var spec = 0.0
	var aud = 0.0
	var has_mint = "mint" in flavors
	var has_double_apple = "double_apple" in flavors
	var has_vanilla = "vanilla" in flavors
	
	if equipment_bowl == "suyaki_minto" and has_mint:
		aud += 5.0
		spec += 2.0
	elif equipment_bowl == "suyaki_adam" and has_double_apple:
		spec += 6.0
		aud += 1.0
	elif equipment_bowl == "suyaki_naru" and has_vanilla:
		spec += 3.0
		aud += 4.0
		
	return {"specialist": spec, "audience": aud}


func equip_item(slot_type: String, value: String) -> bool:
	var normalized = _normalize_equipment_value(slot_type, value)
	if normalized == "":
		return false
	if not has_owned_equipment(slot_type, normalized):
		return false
	if not can_equip(slot_type, normalized):
		return false

	if slot_type == "bowl":
		equipment_bowl = normalized
	elif slot_type == "hms":
		equipment_hms = normalized
	elif slot_type == "charcoal":
		equipment_charcoal = normalized
	else:
		return false

	return true


func get_practice_equipment_bonus(practice_tag: String) -> Dictionary:
	var total_stats: Dictionary = {}
	var notes: Array[String] = []

	var bowl_name = get_equipped_item_name("bowl")
	var bowl_bonus: Dictionary = BOWL_PRACTICE_BONUS.get(equipment_bowl, {})
	_apply_practice_bonus(total_stats, notes, bowl_name, bowl_bonus, practice_tag)

	var hms_name = get_equipped_item_name("hms")
	var hms_bonus: Dictionary = HMS_PRACTICE_BONUS.get(equipment_hms, {})
	_apply_practice_bonus(total_stats, notes, hms_name, hms_bonus, practice_tag)

	var charcoal_name = get_equipped_item_name("charcoal")
	var charcoal_bonus: Dictionary = CHARCOAL_PRACTICE_BONUS.get(equipment_charcoal, {})
	_apply_practice_bonus(total_stats, notes, charcoal_name, charcoal_bonus, practice_tag)

	var combo_key = get_equipment_combo_key()
	var combo_bonus: Dictionary = COMBO_PRACTICE_BONUS.get(combo_key, {})
	_apply_practice_bonus(total_stats, notes, get_equipment_set_name(), combo_bonus, practice_tag)

	var alpha_heat_bonus = _get_alpha_heaven_heat_bonus(practice_tag)
	if not alpha_heat_bonus.is_empty():
		var changed = _merge_stat_bonus(total_stats, alpha_heat_bonus)
		if changed != "":
			notes.append("アルファーヘブン高温戦略: %s" % changed)

	return {
		"stats": total_stats,
		"notes": notes,
		"set_name": get_equipment_set_name(),
	}


func get_practice_bonus_preview_lines() -> Array[String]:
	var lines: Array[String] = []
	for practice_tag in ["packing", "aroma", "presentation", "rush"]:
		var bonus: Dictionary = get_practice_equipment_bonus(practice_tag)
		var stats: Dictionary = bonus.get("stats", {})
		if stats.is_empty():
			continue
		var parts: Array[String] = []
		for stat_name in ["technique", "sense", "guts", "charm", "insight"]:
			if not stats.has(stat_name):
				continue
			parts.append("%s %+d" % [str(STAT_LABEL_MAP.get(stat_name, stat_name)), int(stats.get(stat_name, 0))])
		if not parts.is_empty():
			lines.append("%s: %s" % [str(PRACTICE_LABEL_MAP.get(practice_tag, practice_tag)), ", ".join(parts)])
	return lines


func _apply_practice_bonus(target_stats: Dictionary, notes: Array[String], source_name: String, source_bonus: Dictionary, practice_tag: String) -> void:
	if source_bonus.is_empty():
		return
	var tag_bonus: Dictionary = source_bonus.get(practice_tag, {})
	if tag_bonus.is_empty():
		return
	var changed = _merge_stat_bonus(target_stats, tag_bonus)
	if changed != "":
		notes.append("%s: %s" % [source_name, changed])


func _merge_stat_bonus(target_stats: Dictionary, source_stats: Dictionary) -> String:
	var parts: Array[String] = []
	for stat_name in ["technique", "sense", "guts", "charm", "insight"]:
		if not source_stats.has(stat_name):
			continue
		var amount = int(source_stats.get(stat_name, 0))
		if amount == 0:
			continue
		target_stats[stat_name] = int(target_stats.get(stat_name, 0)) + amount
		parts.append("%s %+d" % [str(STAT_LABEL_MAP.get(stat_name, stat_name)), amount])
	return ", ".join(parts)


func _get_alpha_heaven_heat_bonus(practice_tag: String) -> Dictionary:
	if equipment_hms != "amaburst" and equipment_charcoal != "cube_charcoal":
		return {}
	if not _has_alpha_heaven_flavor_stock():
		return {}

	match practice_tag:
		"packing":
			return {"technique": 1}
		"rush":
			return {"guts": 1, "insight": 1}
		"presentation":
			return {"charm": 1}
		_:
			return {}


func _has_alpha_heaven_flavor_stock() -> bool:
	for flavor_id in ALPHA_HEAVEN_FLAVOR_IDS:
		if has_flavor(str(flavor_id)):
			return true
	return false


func roll_heat_chicken_race(practice_tag: String) -> Dictionary:
	if equipment_charcoal != "cube_charcoal":
		return {}
	if not ["packing", "rush", "presentation"].has(practice_tag):
		return {}

	var success_rate = 42 + int((stat_technique + stat_guts) / 5.0)
	if equipment_hms == "amaburst":
		success_rate -= 8
	if _has_alpha_heaven_flavor_stock():
		success_rate += 5
	success_rate = clampi(success_rate, 15, 90)

	var success = randf() < float(success_rate) / 100.0
	var stat_changes: Dictionary = {}
	if success:
		stat_changes["guts"] = 2
		match practice_tag:
			"packing":
				stat_changes["technique"] = 2
			"rush":
				stat_changes["guts"] = int(stat_changes.get("guts", 0)) + 1
				stat_changes["insight"] = 1
			"presentation":
				stat_changes["charm"] = 2
		if _has_alpha_heaven_flavor_stock():
			stat_changes["insight"] = int(stat_changes.get("insight", 0)) + 1
		return {
			"success": true,
			"rate": success_rate,
			"stats": stat_changes,
			"text": "キューブ炭チキンレース成功（成功率 %d%%）" % success_rate,
		}

	stat_changes["sense"] = -1
	if equipment_hms == "amaburst":
		stat_changes["technique"] = -1
	if practice_tag == "rush":
		stat_changes["guts"] = -1

	return {
		"success": false,
		"rate": success_rate,
		"stats": stat_changes,
		"text": "キューブ炭チキンレース失敗（成功率 %d%%）" % success_rate,
	}


func _normalize_equipment_value(slot_type: String, value: String) -> String:
	if slot_type == "bowl":
		var normalized_bowl = str(LEGACY_BOWL_MAP.get(value, value))
		if BOWL_EQUIPMENT_IDS.has(normalized_bowl):
			return normalized_bowl
		return ""
	if slot_type == "hms":
		var normalized_hms = str(LEGACY_HMS_MAP.get(value, value))
		if HMS_EQUIPMENT_IDS.has(normalized_hms):
			return normalized_hms
		return ""
	if slot_type == "charcoal":
		var normalized_charcoal = str(LEGACY_CHARCOAL_MAP.get(value, value))
		if CHARCOAL_EQUIPMENT_IDS.has(normalized_charcoal):
			return normalized_charcoal
		return ""
	return ""


func _sanitize_owned_list(raw_list: Array, slot_type: String) -> Array[String]:
	var result: Array[String] = []
	for raw_value in raw_list:
		var normalized = _normalize_equipment_value(slot_type, str(raw_value))
		if normalized == "":
			continue
		if result.has(normalized):
			continue
		result.append(normalized)
	return result


func _ensure_equipment_state() -> void:
	equipment_bowl = _normalize_equipment_value("bowl", equipment_bowl)
	equipment_hms = _normalize_equipment_value("hms", equipment_hms)
	equipment_charcoal = _normalize_equipment_value("charcoal", equipment_charcoal)
	equipment_pipe = _normalize_equipment_value("pipe", equipment_pipe) # Added for pipe
	if equipment_bowl == "":
		equipment_bowl = DEFAULT_BOWL
	if equipment_hms == "":
		equipment_hms = DEFAULT_HMS
	if equipment_charcoal == "":
		equipment_charcoal = DEFAULT_CHARCOAL
	if equipment_pipe == "": # Added for pipe
		equipment_pipe = DEFAULT_PIPE # Added for pipe

	if owned_bowls.is_empty():
		owned_bowls.append(DEFAULT_BOWL)
	if owned_hms.is_empty():
		owned_hms.append(DEFAULT_HMS)
	if owned_charcoals.is_empty():
		owned_charcoals.append(DEFAULT_CHARCOAL)
	if owned_pipes.is_empty(): # Added for pipe
		owned_pipes.append(DEFAULT_PIPE) # Added for pipe

	if not owned_bowls.has(equipment_bowl):
		owned_bowls.append(equipment_bowl)
	if not owned_hms.has(equipment_hms):
		owned_hms.append(equipment_hms)
	if not owned_charcoals.has(equipment_charcoal):
		owned_charcoals.append(equipment_charcoal)
	if not owned_pipes.has(equipment_pipe): # Added for pipe
		owned_pipes.append(equipment_pipe) # Added for pipe

	if not is_equipment_pair_compatible(equipment_bowl, equipment_hms):
		equipment_hms = DEFAULT_HMS
		if not owned_hms.has(equipment_hms):
			owned_hms.append(equipment_hms)


func add_flavor(flavor_id: String, amount: int = 50) -> void:
	for item in flavor_inventory:
		if item.get("id", "") == flavor_id:
			item["name"] = FLAVOR_NAME_MAP.get(flavor_id, flavor_id)
			item["amount"] = int(item.get("amount", 0)) + amount
			return

	flavor_inventory.append({
		"id": flavor_id,
		"name": FLAVOR_NAME_MAP.get(flavor_id, flavor_id),
		"amount": amount,
	})


func has_flavor(flavor_id: String) -> bool:
	for item in flavor_inventory:
		if item.get("id", "") == flavor_id and int(item.get("amount", 0)) > 0:
			return true
	return false


func get_flavor_amount(flavor_id: String) -> int:
	for item in flavor_inventory:
		if item.get("id", "") == flavor_id:
			return int(item.get("amount", 0))
	return 0


func can_use_flavor(flavor_id: String, grams: int) -> bool:
	return get_flavor_amount(flavor_id) >= grams


func use_flavor(flavor_id: String, grams: int) -> bool:
	if grams <= 0:
		return false
	for item in flavor_inventory:
		if item.get("id", "") != flavor_id:
			continue
		var current = int(item.get("amount", 0))
		if current < grams:
			return false
		item["amount"] = current - grams
		if int(item.get("amount", 0)) <= 0:
			flavor_inventory.erase(item)
		return true
	return false


func add_flavor_specialty(category_id: String, amount: int) -> void:
	var normalized = _normalize_flavor_category(category_id)
	if normalized == "" or amount == 0:
		return
	_ensure_flavor_specialty_state()
	var current = int(flavor_specialties.get(normalized, int(DEFAULT_FLAVOR_SPECIALTIES.get(normalized, 0))))
	flavor_specialties[normalized] = clampi(current + amount, 0, 100)


func get_flavor_specialty(category_id: String) -> int:
	var normalized = _normalize_flavor_category(category_id)
	if normalized == "":
		return 0
	_ensure_flavor_specialty_state()
	return int(flavor_specialties.get(normalized, int(DEFAULT_FLAVOR_SPECIALTIES.get(normalized, 0))))


func get_flavor_specialty_label(category_id: String) -> String:
	var normalized = _normalize_flavor_category(category_id)
	if normalized == "":
		return category_id
	return str(FLAVOR_SPECIALTY_LABEL_MAP.get(normalized, category_id))


func get_flavor_category(flavor_id: String) -> String:
	if FLAVOR_PRIMARY_CATEGORY_MAP.has(flavor_id):
		return str(FLAVOR_PRIMARY_CATEGORY_MAP.get(flavor_id, "special"))
	return "special"


func get_flavor_specialty_for_flavor(flavor_id: String) -> int:
	return get_flavor_specialty(get_flavor_category(flavor_id))


func get_flavor_specialty_summary_lines() -> Array[String]:
	_ensure_flavor_specialty_state()
	var lines: Array[String] = []
	for category_id in FLAVOR_SPECIALTY_KEYS:
		lines.append("%s %d" % [get_flavor_specialty_label(category_id), get_flavor_specialty(category_id)])
	return lines


func get_character_flavor_profile(character_id: String) -> Dictionary:
	if character_flavor_profiles.is_empty():
		_load_character_flavor_profiles()
	if character_flavor_profiles.has(character_id):
		return character_flavor_profiles[character_id].duplicate(true)
	return DEFAULT_FLAVOR_SPECIALTIES.duplicate(true)


func get_character_flavor_top_labels(character_id: String, top_count: int = 2) -> Array[String]:
	var profile = get_character_flavor_profile(character_id)
	var pairs: Array = []
	for category_id in FLAVOR_SPECIALTY_KEYS:
		pairs.append({
			"category": category_id,
			"value": int(profile.get(category_id, 0)),
		})
	pairs.sort_custom(func(a, b):
		return int(a.get("value", 0)) > int(b.get("value", 0))
	)

	var labels: Array[String] = []
	var limit = mini(top_count, pairs.size())
	for i in range(limit):
		var category_id = str(pairs[i].get("category", ""))
		if category_id == "":
			continue
		labels.append(get_flavor_specialty_label(category_id))
	return labels


func _normalize_flavor_category(category_id: String) -> String:
	return str(FLAVOR_SPECIALTY_ALIAS_MAP.get(category_id, ""))


func _ensure_flavor_specialty_state() -> void:
	if typeof(flavor_specialties) != TYPE_DICTIONARY:
		flavor_specialties = {}
	for category_id in FLAVOR_SPECIALTY_KEYS:
		var current = int(flavor_specialties.get(category_id, int(DEFAULT_FLAVOR_SPECIALTIES.get(category_id, 0))))
		flavor_specialties[category_id] = clampi(current, 0, 100)


func _load_character_flavor_profiles() -> void:
	character_flavor_profiles.clear()
	if not FileAccess.file_exists(CHARACTER_DATA_PATH):
		return
	var file = FileAccess.open(CHARACTER_DATA_PATH, FileAccess.READ)
	if file == null:
		return
	var parsed = JSON.parse_string(file.get_as_text())
	file.close()
	if typeof(parsed) != TYPE_DICTIONARY:
		return

	var characters: Array = parsed.get("characters", [])
	for raw in characters:
		if typeof(raw) != TYPE_DICTIONARY:
			continue
		var entry = raw as Dictionary
		var character_id = str(entry.get("id", ""))
		if character_id == "":
			continue
		var profile = DEFAULT_FLAVOR_SPECIALTIES.duplicate(true)
		var raw_profile = entry.get("flavor_specialties", {})
		if typeof(raw_profile) == TYPE_DICTIONARY:
			for key in raw_profile.keys():
				var normalized = _normalize_flavor_category(str(key))
				if normalized == "":
					continue
				profile[normalized] = clampi(int(raw_profile.get(key, profile[normalized])), 0, 100)
		character_flavor_profiles[character_id] = profile


func add_recipe(recipe_data: Dictionary) -> void:
	var memo_id = str(recipe_data.get("id", ""))
	var title = str(recipe_data.get("name", "攻略メモ"))
	var source = str(recipe_data.get("source", "system"))
	var body = "大会前に見返せるヒントを獲得した。"

	var flavors: Array = recipe_data.get("flavors", [])
	var amounts: Array = recipe_data.get("amounts", [])
	if not flavors.is_empty() and not amounts.is_empty():
		var parts: Array[String] = []
		var count = mini(flavors.size(), amounts.size())
		for i in range(count):
			var flavor_id = str(flavors[i])
			parts.append("%s %sg" % [FLAVOR_NAME_MAP.get(flavor_id, flavor_id), str(amounts[i])])
		body = "配合メモ: " + " / ".join(parts)

	add_tournament_memo(memo_id, title, body, source, 1)


func add_tournament_memo(memo_id: String, title: String, body: String, source: String = "system", chapter: int = 1) -> void:
	if memo_id == "":
		return
	if has_memo(memo_id):
		return

	recipe_note.append({
		"id": memo_id,
		"title": title,
		"body": body,
		"source": source,
		"chapter": chapter,
		"useful_for_tournament": true,
	})
	memo_seen_ids[memo_id] = false


func has_memo(memo_id: String) -> bool:
	if memo_id == "":
		return false
	for entry in recipe_note:
		if str(entry.get("id", "")) == memo_id:
			return true
	return false


func get_tournament_memos() -> Array:
	var result: Array = []
	for raw in recipe_note:
		if typeof(raw) != TYPE_DICTIONARY:
			continue
		var entry = _normalize_memo_entry(raw)
		if not bool(entry.get("useful_for_tournament", false)):
			continue
		result.append(entry)
	return result


func get_unread_tournament_memo_count() -> int:
	var unread = 0
	for entry in get_tournament_memos():
		var memo_id = str(entry.get("id", ""))
		if memo_id == "":
			continue
		if not bool(memo_seen_ids.get(memo_id, false)):
			unread += 1
	return unread


func mark_all_tournament_memos_read() -> void:
	for entry in get_tournament_memos():
		var memo_id = str(entry.get("id", ""))
		if memo_id == "":
			continue
		memo_seen_ids[memo_id] = true


func _normalize_memo_entry(raw: Dictionary) -> Dictionary:
	if raw.has("title") and raw.has("body"):
		return raw

	var memo_id = str(raw.get("id", "legacy_memo"))
	var title = str(raw.get("name", "攻略メモ"))
	var source = str(raw.get("source", "system"))
	var chapter = int(raw.get("chapter", 1))

	var body = str(raw.get("text", ""))
	var flavors: Array = raw.get("flavors", [])
	var amounts: Array = raw.get("amounts", [])
	if body == "" and not flavors.is_empty() and not amounts.is_empty():
		var parts: Array[String] = []
		var count = mini(flavors.size(), amounts.size())
		for i in range(count):
			var flavor_id = str(flavors[i])
			parts.append("%s %sg" % [FLAVOR_NAME_MAP.get(flavor_id, flavor_id), str(amounts[i])])
		body = "配合メモ: " + " / ".join(parts)
	if body == "":
		body = "大会で使えるヒント。"

	var useful = false
	if raw.has("useful_for_tournament"):
		useful = bool(raw.get("useful_for_tournament", false))
	elif str(raw.get("status", "")) == "hint":
		useful = true

	return {
		"id": memo_id,
		"title": title,
		"body": body,
		"source": source,
		"chapter": chapter,
		"useful_for_tournament": useful,
	}


func to_save_data() -> Dictionary:
	return {
		"stats": {
			"technique": stat_technique,
			"sense": stat_sense,
			"taste": stat_sense,
			"guts": stat_guts,
			"charm": stat_charm,
			"insight": stat_insight,
		},
		"money": money,
		"flavor_inventory": flavor_inventory,
		"flavor_specialties": flavor_specialties,
		"equipment_hms": equipment_hms,
		"equipment_bowl": equipment_bowl,
		"equipment_charcoal": equipment_charcoal,
		"equipment_pipe": equipment_pipe,
		"owned_bowls": owned_bowls,
		"owned_hms": owned_hms,
		"owned_charcoals": owned_charcoals,
		"owned_pipes": owned_pipes,
		"recipe_note": recipe_note,
		"memo_seen_ids": memo_seen_ids,
		"unlocked_cards": unlocked_cards,
	}


func from_save_data(data: Dictionary) -> void:
	var stats: Dictionary = data.get("stats", {})
	stat_technique = int(stats.get("technique", 10))
	stat_sense = int(stats.get("sense", stats.get("taste", 10)))
	stat_guts = int(stats.get("guts", 10))
	stat_charm = int(stats.get("charm", 15))
	stat_insight = int(stats.get("insight", 20))

	money = int(data.get("money", 30000))
	flavor_inventory = data.get("flavor_inventory", []).duplicate(true)
	flavor_specialties = data.get("flavor_specialties", DEFAULT_FLAVOR_SPECIALTIES).duplicate(true)
	_ensure_flavor_specialty_state()
	equipment_hms = str(data.get("equipment_hms", DEFAULT_HMS))
	equipment_bowl = str(data.get("equipment_bowl", DEFAULT_BOWL))
	equipment_charcoal = str(data.get("equipment_charcoal", DEFAULT_CHARCOAL))
	owned_bowls = _sanitize_owned_list(data.get("owned_bowls", [equipment_bowl]), "bowl")
	owned_hms = _sanitize_owned_list(data.get("owned_hms", [equipment_hms]), "hms")
	owned_charcoals = _sanitize_owned_list(data.get("owned_charcoals", [equipment_charcoal]), "charcoal")
	_ensure_equipment_state()

	recipe_note = data.get("recipe_note", []).duplicate(true)
	memo_seen_ids = data.get("memo_seen_ids", {}).duplicate(true)
	for raw in recipe_note:
		if typeof(raw) != TYPE_DICTIONARY:
			continue
		var memo_id = str(raw.get("id", ""))
		if memo_id == "":
			continue
		if not memo_seen_ids.has(memo_id):
			memo_seen_ids[memo_id] = false
	unlocked_cards = data.get("unlocked_cards", []).duplicate(true)
