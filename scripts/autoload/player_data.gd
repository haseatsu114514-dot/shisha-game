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
	var value := get_stat_value(stat_name)
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
	recipe_note.append(recipe_data)


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
	unlocked_cards = data.get("unlocked_cards", []).duplicate(true)
