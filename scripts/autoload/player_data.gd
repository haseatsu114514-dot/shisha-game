extends Node

const FLAVOR_NAME_MAP := {
	"double_apple": "ダブルアップル",
	"mint": "ミント",
	"blueberry": "ブルーベリー",
	"mango": "マンゴー",
	"vanilla": "バニラ",
	"pineapple": "パイナップル",
	"coconut": "ココナッツ",
}

var stat_technique: int = 10
var stat_sense: int = 10
var stat_guts: int = 10
var stat_charm: int = 15
var stat_insight: int = 20

var money: int = 5000

var flavor_inventory: Array = []

var equipment_hms: String = "normal"
var equipment_bowl: String = "standard"

var recipe_note: Array = []
var memo_seen_ids: Dictionary = {}
var unlocked_cards: Array = []


func reset_data() -> void:
	stat_technique = 10
	stat_sense = 10
	stat_guts = 10
	stat_charm = 15
	stat_insight = 20
	money = 5000
	flavor_inventory.clear()
	equipment_hms = "normal"
	equipment_bowl = "standard"
	recipe_note.clear()
	memo_seen_ids.clear()
	unlocked_cards.clear()


func add_stat(stat_name: String, amount: int) -> void:
	match stat_name:
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
	match stat_name:
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


func add_money(amount: int) -> void:
	money = maxi(0, money + amount)


func spend_money(amount: int) -> bool:
	if money < amount:
		return false
	money -= amount
	return true


func add_flavor(flavor_id: String, amount: int) -> void:
	for item in flavor_inventory:
		if item.get("id", "") == flavor_id:
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
			"guts": stat_guts,
			"charm": stat_charm,
			"insight": stat_insight,
		},
		"money": money,
		"flavor_inventory": flavor_inventory,
		"equipment_hms": equipment_hms,
		"equipment_bowl": equipment_bowl,
		"recipe_note": recipe_note,
		"memo_seen_ids": memo_seen_ids,
		"unlocked_cards": unlocked_cards,
	}


func from_save_data(data: Dictionary) -> void:
	var stats: Dictionary = data.get("stats", {})
	stat_technique = int(stats.get("technique", 10))
	stat_sense = int(stats.get("sense", 10))
	stat_guts = int(stats.get("guts", 10))
	stat_charm = int(stats.get("charm", 15))
	stat_insight = int(stats.get("insight", 20))

	money = int(data.get("money", 5000))
	flavor_inventory = data.get("flavor_inventory", []).duplicate(true)
	equipment_hms = str(data.get("equipment_hms", "normal"))
	equipment_bowl = str(data.get("equipment_bowl", "standard"))
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
