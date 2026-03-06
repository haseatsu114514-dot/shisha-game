extends Control

@onready var info_label: Label = %InfoLabel
@onready var item_container: VBoxContainer = %ItemContainer

var _advance_on_exit = false


func _ready() -> void:
	GameManager.play_daily_bgm()
	_advance_on_exit = bool(GameManager.pop_transient("advance_time_after_scene", false))
	if not _advance_on_exit:
		if CalendarManager.use_action():
			_advance_on_exit = true
		else:
			info_label.text = "行動コマが足りません。"
			return

	_load_shop_items()
	_maybe_add_recipe_hint()


func _load_shop_items() -> void:
	_clear_items()
	_add_section_label("フレーバー")
	for flavor in _load_data("res://data/flavors.json", "flavors"):
		_add_item_button(flavor, "flavor")

	_add_section_label("機材")
	for equipment in _load_data("res://data/equipment.json", "equipment"):
		_add_item_button(equipment, "equipment")


func _load_data(path: String, key: String) -> Array:
	if not FileAccess.file_exists(path):
		return []
	var file = FileAccess.open(path, FileAccess.READ)
	if file == null:
		return []
	var parsed = JSON.parse_string(file.get_as_text())
	file.close()
	if typeof(parsed) != TYPE_DICTIONARY:
		return []
	return parsed.get(key, [])


func _add_section_label(text: String) -> void:
	var label = Label.new()
	label.text = text
	item_container.add_child(label)


func _add_item_button(item: Dictionary, item_type: String) -> void:
	var button = Button.new()
	button.text = "%s  💰%d" % [str(item.get("name", "item")), int(item.get("price", 0))]
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.pressed.connect(_on_buy_pressed.bind(item, item_type))
	item_container.add_child(button)


func _on_buy_pressed(item: Dictionary, item_type: String) -> void:
	var price = int(item.get("price", 0))
	if not PlayerData.spend_money(price):
		info_label.text = "お金が足りません。"
		return

	GameManager.log_money_change(-price)

	if item_type == "flavor":
		var flavor_id = str(item.get("id", ""))
		var flavor_name = str(item.get("name", flavor_id))
		PlayerData.add_flavor(flavor_id, 1)
		GameManager.log_flavor_change(flavor_name, 1)
		info_label.text = "%s を購入しました。" % flavor_name
		return

	var equipment_type = str(item.get("type", ""))
	if equipment_type == "bowl":
		PlayerData.equipment_bowl = str(item.get("value", "standard"))
	elif equipment_type == "hms":
		PlayerData.equipment_hms = str(item.get("value", "normal"))
	info_label.text = "%s を購入しました。" % str(item.get("name", "機材"))


func _maybe_add_recipe_hint() -> void:
	if randi() % 100 >= 30:
		return
	PlayerData.add_recipe({
		"id": "hint_double_apple_mint",
		"name": "常連ヒント",
		"status": "hint",
		"flavors": ["double_apple", "mint"],
		"amounts": [7, 3],
		"source": "shop_owner"
	})
	info_label.text = "店主: 最近ダブルアップルとミントを一緒に買う人が多いよ"


func _on_back_button_pressed() -> void:
	if _advance_on_exit:
		CalendarManager.advance_time()
	if CalendarManager.current_time == "midnight":
		get_tree().change_scene_to_file("res://scenes/daily/night_end.tscn")
		return
	get_tree().change_scene_to_file("res://scenes/daily/map.tscn")


func _clear_items() -> void:
	for child in item_container.get_children():
		child.queue_free()
