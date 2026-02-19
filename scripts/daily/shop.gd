extends Control

@onready var info_label: Label = %InfoLabel
@onready var item_container: VBoxContainer = %ItemContainer
@onready var money_label: Label = $Panel/VBox/HeaderHBox/MoneyLabel
@onready var purchase_confirm_dialog: ConfirmationDialog = %PurchaseConfirmDialog

var _advance_on_exit = false
var _did_shop_transaction = false
var _shop_visit_paid = false
var _pending_purchase_kind: String = ""
var _pending_purchase_item: Dictionary = {}
const SHOP_VISIT_COST := 3500


func _ready() -> void:
	GameManager.play_daily_bgm()
	purchase_confirm_dialog.confirmed.connect(_on_purchase_confirmed)
	purchase_confirm_dialog.canceled.connect(_on_purchase_canceled)
	_advance_on_exit = bool(GameManager.pop_transient("advance_time_after_scene", false))
	_shop_visit_paid = _advance_on_exit
	if not _advance_on_exit:
		if CalendarManager.use_action():
			_advance_on_exit = true
		else:
			GameManager.play_ui_se("cancel")
			info_label.text = "行動コマが足りません。"
			return

	_load_shop_items()
	_refresh_header()
	_maybe_add_recipe_hint()


func _load_shop_items() -> void:
	_clear_items()
	_add_section_label("フレーバー")
	for flavor in _load_data("res://data/flavors.json", "flavors"):
		_add_flavor_button(flavor)

	var equipment_items: Array = []
	for equipment in _load_data("res://data/equipment.json", "equipment"):
		if _is_item_available_in_current_chapter(equipment):
			equipment_items.append(equipment)

	_add_section_label("機材")
	_add_compatibility_guide(equipment_items)
	for equipment in equipment_items:
		_add_equipment_entry(equipment, equipment_items)


func _refresh_header() -> void:
	money_label.text = "所持金: %d円 / セット: %s" % [PlayerData.money, PlayerData.get_equipment_set_name()]


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


func _add_flavor_button(item: Dictionary) -> void:
	var wrapper = VBoxContainer.new()
	wrapper.size_flags_horizontal = Control.SIZE_EXPAND_FILL

	var flavor_id = str(item.get("id", ""))
	var short_name = str(item.get("short_name", ""))
	var full_name = str(item.get("name", flavor_id))
	var display_name = short_name if short_name != "" else full_name
	var category = str(item.get("category", ""))
	if category == "":
		category = PlayerData.get_flavor_category(flavor_id)
	var category_label = PlayerData.get_flavor_specialty_label(category)
	var price = _get_buy_price(item)
	var title_label = Label.new()
	title_label.text = "%s [%s]  購入:%d円" % [display_name, category_label, price]
	title_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	wrapper.add_child(title_label)

	var button_row = HBoxContainer.new()
	button_row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button_row.add_theme_constant_override("separation", 6)

	var detail_button = Button.new()
	detail_button.text = "説明"
	detail_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	detail_button.pressed.connect(_on_flavor_select_pressed.bind(item))
	button_row.add_child(detail_button)

	var buy_button = Button.new()
	buy_button.text = "購入する"
	buy_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	buy_button.pressed.connect(_on_flavor_buy_pressed.bind(item))
	button_row.add_child(buy_button)

	wrapper.add_child(button_row)

	var separator = HSeparator.new()
	wrapper.add_child(separator)
	item_container.add_child(wrapper)


func _add_equipment_entry(item: Dictionary, equipment_items: Array) -> void:
	var equipment_type = str(item.get("type", ""))
	var equipment_value = str(item.get("value", ""))
	if equipment_type == "" or equipment_value == "":
		return

	var wrapper = VBoxContainer.new()
	wrapper.size_flags_horizontal = Control.SIZE_EXPAND_FILL

	var name = str(item.get("name", "機材"))
	var buy_price = _get_buy_price(item)
	var sell_price = _get_sell_price(item)
	var description = str(item.get("description", ""))
	var is_owned = PlayerData.has_owned_equipment(equipment_type, equipment_value)
	var is_equipped = PlayerData.get_equipped_value(equipment_type) == equipment_value

	var title_label = Label.new()
	title_label.text = "%s  購入:%d円 / 売却:%d円" % [name, buy_price, sell_price]
	wrapper.add_child(title_label)

	if description != "":
		var desc_label = Label.new()
		desc_label.text = description
		desc_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		wrapper.add_child(desc_label)

	var compatible_names: Array[String] = []
	if equipment_type == "charcoal":
		var charcoal_label = Label.new()
		charcoal_label.text = "対応: 全ハガル / 全ヒートマネジメント"
		charcoal_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		wrapper.add_child(charcoal_label)
	else:
		compatible_names = _get_compatible_counterpart_names(item, equipment_items)
		if not compatible_names.is_empty():
			var compatibility_label = Label.new()
			if equipment_type == "bowl":
				compatibility_label.text = "対応HMS: " + " / ".join(compatible_names)
			else:
				compatibility_label.text = "対応ハガル: " + " / ".join(compatible_names)
			compatibility_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			wrapper.add_child(compatibility_label)

	var status_label = Label.new()
	if is_equipped:
		status_label.text = "状態: 使用中"
	elif is_owned:
		status_label.text = "状態: 所持"
	else:
		status_label.text = "状態: 未所持"
	wrapper.add_child(status_label)

	var button_row = HBoxContainer.new()
	button_row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button_row.add_theme_constant_override("separation", 6)

	var detail_button = Button.new()
	detail_button.text = "説明"
	detail_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	detail_button.pressed.connect(_on_equipment_select_pressed.bind(item, compatible_names))
	button_row.add_child(detail_button)

	var primary_button = Button.new()
	primary_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	if is_equipped:
		primary_button.text = "使用中"
		primary_button.disabled = true
	elif is_owned:
		primary_button.text = "使用する"
	else:
		primary_button.text = "購入する"
	primary_button.pressed.connect(_on_equipment_primary_pressed.bind(item))
	button_row.add_child(primary_button)

	var sell_button = Button.new()
	sell_button.text = "売却"
	sell_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sell_button.disabled = (not is_owned) or is_equipped
	sell_button.pressed.connect(_on_equipment_sell_pressed.bind(item))
	button_row.add_child(sell_button)

	wrapper.add_child(button_row)

	var separator = HSeparator.new()
	wrapper.add_child(separator)
	item_container.add_child(wrapper)


func _on_flavor_buy_pressed(item: Dictionary) -> void:
	_on_flavor_select_pressed(item)
	var price = _get_buy_price(item)
	if PlayerData.money < price:
		GameManager.play_ui_se("cancel")
		info_label.text = "お金が足りません。"
		return
	_request_purchase("flavor", item, "このフレーバーを購入しますか？\n価格: %d円" % price)


func _buy_flavor_now(item: Dictionary) -> void:
	var price = _get_buy_price(item)
	if not PlayerData.spend_money(price):
		GameManager.play_ui_se("cancel")
		info_label.text = "お金が足りません。"
		return
	GameManager.log_money_change(-price)
	var flavor_id = str(item.get("id", ""))
	var flavor_name = str(item.get("name", flavor_id))
	PlayerData.add_flavor(flavor_id, 1)
	GameManager.log_flavor_change(flavor_name, 1)
	_did_shop_transaction = true
	GameManager.play_ui_se("purchase")
	info_label.text = "%s を購入しました。" % flavor_name
	_refresh_header()


func _on_equipment_primary_pressed(item: Dictionary) -> void:
	var equipment_type = str(item.get("type", ""))
	var equipment_value = str(item.get("value", ""))
	var name = str(item.get("name", "機材"))
	if equipment_type == "" or equipment_value == "":
		return

	_on_equipment_select_pressed(item, [])
	if PlayerData.has_owned_equipment(equipment_type, equipment_value):
		if not PlayerData.can_equip(equipment_type, equipment_value):
			GameManager.play_ui_se("cancel")
			info_label.text = "現在のもう一方の装備と対応していません。対応表を確認してください。"
			return
		if PlayerData.equip_item(equipment_type, equipment_value):
			GameManager.play_ui_se("confirm")
			info_label.text = "%s を使用中にしました。" % name
			_load_shop_items()
			_refresh_header()
		return

	var buy_price = _get_buy_price(item)
	if PlayerData.money < buy_price:
		GameManager.play_ui_se("cancel")
		info_label.text = "お金が足りません。"
		return
	_request_purchase("equipment", item, "%s を購入しますか？\n価格: %d円" % [name, buy_price])


func _buy_equipment_now(item: Dictionary) -> void:
	var equipment_type = str(item.get("type", ""))
	var equipment_value = str(item.get("value", ""))
	var name = str(item.get("name", "機材"))
	if equipment_type == "" or equipment_value == "":
		return

	var buy_price = _get_buy_price(item)
	if not PlayerData.spend_money(buy_price):
		GameManager.play_ui_se("cancel")
		info_label.text = "お金が足りません。"
		return

	if not PlayerData.add_owned_equipment(equipment_type, equipment_value):
		PlayerData.add_money(buy_price)
		GameManager.play_ui_se("cancel")
		info_label.text = "購入処理に失敗しました。"
		return

	GameManager.log_money_change(-buy_price)
	_did_shop_transaction = true
	GameManager.play_ui_se("purchase")
	info_label.text = "%s を購入しました。" % name
	if PlayerData.can_equip(equipment_type, equipment_value) and PlayerData.equip_item(equipment_type, equipment_value):
		info_label.text = "%s を購入して使用中にしました。" % name
	else:
		info_label.text += "\n今の組み合わせでは使用できないため、所持のみになりました。"
	var description = str(item.get("description", ""))
	if description != "":
		info_label.text += "\n" + description

	_load_shop_items()
	_refresh_header()


func _on_equipment_sell_pressed(item: Dictionary) -> void:
	var equipment_type = str(item.get("type", ""))
	var equipment_value = str(item.get("value", ""))
	var name = str(item.get("name", "機材"))
	if equipment_type == "" or equipment_value == "":
		return

	if PlayerData.get_equipped_value(equipment_type) == equipment_value:
		GameManager.play_ui_se("cancel")
		info_label.text = "使用中の機材は売却できません。"
		return

	if not PlayerData.has_owned_equipment(equipment_type, equipment_value):
		GameManager.play_ui_se("cancel")
		info_label.text = "未所持の機材は売却できません。"
		return

	if not PlayerData.remove_owned_equipment(equipment_type, equipment_value):
		GameManager.play_ui_se("cancel")
		info_label.text = "売却処理に失敗しました。"
		return

	var sell_price = _get_sell_price(item)
	PlayerData.add_money(sell_price)
	GameManager.log_money_change(sell_price)
	_did_shop_transaction = true
	GameManager.play_ui_se("confirm")
	info_label.text = "%s を売却しました。 +%d円" % [name, sell_price]

	_load_shop_items()
	_refresh_header()


func _get_buy_price(item: Dictionary) -> int:
	if item.has("buy_price"):
		return int(item.get("buy_price", 0))
	return int(item.get("price", 0))


func _get_sell_price(item: Dictionary) -> int:
	if item.has("sell_price"):
		return int(item.get("sell_price", 0))
	return int(_get_buy_price(item) * 0.5)


func _is_item_available_in_current_chapter(item: Dictionary) -> bool:
	var chapter = int(GameManager.current_chapter)
	var chapter_min = int(item.get("chapter_min", 1))
	var chapter_max = int(item.get("chapter_max", 999))
	return chapter >= chapter_min and chapter <= chapter_max


func _add_compatibility_guide(equipment_items: Array) -> void:
	var lines: Array[String] = []
	for item in equipment_items:
		if str(item.get("type", "")) != "hms":
			continue
		var compatible = _get_compatible_counterpart_names(item, equipment_items)
		if compatible.is_empty():
			continue
		lines.append("%s -> %s" % [str(item.get("name", "HMS")), " / ".join(compatible)])

	var charcoal_lines: Array[String] = []
	for item in equipment_items:
		if str(item.get("type", "")) != "charcoal":
			continue
		var name = str(item.get("name", "炭"))
		if str(item.get("value", "")) == "cube_charcoal":
			charcoal_lines.append("%s: 高火力。チキンレースで当てれば大きなリターン" % name)
		else:
			charcoal_lines.append("%s: 安定火力。有効範囲が広く扱いやすい" % name)

	if lines.is_empty() and charcoal_lines.is_empty():
		return

	var sections: Array[String] = []
	if not lines.is_empty():
		sections.append("対応表（ヒートマネジメント -> ハガル）\n" + "\n".join(lines))
	if not charcoal_lines.is_empty():
		sections.append("炭ガイド\n" + "\n".join(charcoal_lines))

	var guide_label = Label.new()
	guide_label.text = "\n\n".join(sections)
	guide_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	item_container.add_child(guide_label)

	var separator = HSeparator.new()
	item_container.add_child(separator)


func _get_compatible_counterpart_names(item: Dictionary, equipment_items: Array) -> Array[String]:
	var equipment_type = str(item.get("type", ""))
	var equipment_value = str(item.get("value", ""))
	var result: Array[String] = []
	if equipment_type == "" or equipment_value == "":
		return result
	if equipment_type != "bowl" and equipment_type != "hms":
		return result

	var target_type = "hms" if equipment_type == "bowl" else "bowl"
	for counterpart in equipment_items:
		if str(counterpart.get("type", "")) != target_type:
			continue
		var counterpart_value = str(counterpart.get("value", ""))
		if counterpart_value == "":
			continue

		var bowl_value = equipment_value if equipment_type == "bowl" else counterpart_value
		var hms_value = equipment_value if equipment_type == "hms" else counterpart_value
		if not PlayerData.is_equipment_pair_compatible(bowl_value, hms_value):
			continue
		result.append(str(counterpart.get("name", counterpart_value)))

	return result


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


func _on_flavor_select_pressed(item: Dictionary) -> void:
	GameManager.play_ui_se("cursor")
	info_label.text = _build_flavor_info(item)


func _on_equipment_select_pressed(item: Dictionary, compatible_names: Array) -> void:
	GameManager.play_ui_se("cursor")
	info_label.text = _build_equipment_info(item, compatible_names)


func _build_flavor_info(item: Dictionary) -> String:
	var flavor_id = str(item.get("id", ""))
	var full_name = str(item.get("name", flavor_id))
	var category = str(item.get("category", ""))
	if category == "":
		category = PlayerData.get_flavor_category(flavor_id)
	var category_label = PlayerData.get_flavor_specialty_label(category)
	var price = _get_buy_price(item)
	var lines: Array[String] = []
	lines.append(full_name)
	lines.append("属性: %s / 価格: %d円" % [category_label, price])
	var description = str(item.get("description", ""))
	if description != "":
		lines.append(description)
	return "\n".join(lines)


func _build_equipment_info(item: Dictionary, compatible_names: Array) -> String:
	var name = str(item.get("name", "機材"))
	var equipment_type = str(item.get("type", ""))
	var equipment_value = str(item.get("value", ""))
	var buy_price = _get_buy_price(item)
	var sell_price = _get_sell_price(item)
	var lines: Array[String] = []
	lines.append("%s" % name)
	lines.append("購入: %d円 / 売却: %d円" % [buy_price, sell_price])
	var description = str(item.get("description", ""))
	if description != "":
		lines.append(description)
	if equipment_type == "charcoal":
		lines.append("対応: 全ハガル / 全ヒートマネジメント")
	elif not compatible_names.is_empty():
		if equipment_type == "bowl":
			lines.append("対応HMS: " + " / ".join(compatible_names))
		else:
			lines.append("対応ハガル: " + " / ".join(compatible_names))
	var is_owned = PlayerData.has_owned_equipment(equipment_type, equipment_value)
	var is_equipped = PlayerData.get_equipped_value(equipment_type) == equipment_value
	if is_equipped:
		lines.append("状態: 使用中")
	elif is_owned:
		lines.append("状態: 所持")
	else:
		lines.append("状態: 未所持")
	return "\n".join(lines)


func _request_purchase(kind: String, item: Dictionary, message: String) -> void:
	_pending_purchase_kind = kind
	_pending_purchase_item = item.duplicate(true)
	purchase_confirm_dialog.dialog_text = message
	purchase_confirm_dialog.popup_centered()
	GameManager.play_ui_se("confirm")


func _on_purchase_confirmed() -> void:
	match _pending_purchase_kind:
		"flavor":
			_buy_flavor_now(_pending_purchase_item)
		"equipment":
			_buy_equipment_now(_pending_purchase_item)
	_pending_purchase_kind = ""
	_pending_purchase_item = {}


func _on_purchase_canceled() -> void:
	GameManager.play_ui_se("cancel")
	_pending_purchase_kind = ""
	_pending_purchase_item = {}


func _on_back_button_pressed() -> void:
	GameManager.play_ui_se("cancel")
	if _advance_on_exit:
		if _did_shop_transaction:
			CalendarManager.advance_time()
		else:
			if _shop_visit_paid:
				PlayerData.add_money(SHOP_VISIT_COST)
				GameManager.log_money_change(SHOP_VISIT_COST)
			CalendarManager.actions_remaining = mini(2, CalendarManager.actions_remaining + 1)
			GameManager.set_transient("morning_notice", "Dr.Hookahで下見だけして戻った。")
	if CalendarManager.current_time == "midnight":
		get_tree().change_scene_to_file("res://scenes/daily/night_end.tscn")
		return
	get_tree().change_scene_to_file("res://scenes/daily/map.tscn")


func _clear_items() -> void:
	for child in item_container.get_children():
		child.queue_free()
