extends Control

@onready var spot_container: VBoxContainer = %SpotContainer
@onready var message_label: Label = %MessageLabel
@onready var confirm_dialog: ConfirmationDialog = %ConfirmDialog

var _pending_spot: Dictionary = {}


func _ready() -> void:
	GameManager.stop_bgm()
	confirm_dialog.confirmed.connect(_on_confirmed)

	if CalendarManager.current_time == "noon":
		var noon_event = str(GameManager.pop_transient("forced_noon_action", ""))
		if noon_event != "":
			if CalendarManager.use_action():
				GameManager.set_transient("interaction_event", noon_event)
				GameManager.set_transient("advance_time_after_scene", true)
				get_tree().change_scene_to_file("res://scenes/daily/interaction.tscn")
				return

	if CalendarManager.current_time == "night":
		var night_event = str(GameManager.pop_transient("night_action", ""))
		if night_event != "":
			if CalendarManager.use_action():
				GameManager.set_transient("interaction_event", night_event)
				GameManager.set_transient("advance_time_after_scene", true)
				get_tree().change_scene_to_file("res://scenes/daily/interaction.tscn")
				return

	_refresh_spots()


func _refresh_spots() -> void:
	for child in spot_container.get_children():
		child.queue_free()

	message_label.text = "行き先を選択"

	for spot in _build_spot_list():
		var button = Button.new()
		button.text = spot["label"]
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.pressed.connect(_on_spot_pressed.bind(spot))
		spot_container.add_child(button)


func _build_spot_list() -> Array:
	var spots: Array = []
	if CalendarManager.current_time == "noon":
		spots.append({"id": "chillhouse", "label": "📍 チルハウス"})
		spots.append({"id": "shop", "label": "📍 シーシャショップ"})
		if CalendarManager.current_day >= 2:
			spots.append({"id": "nishio", "label": "📍 にしおの店"})
			spots.append({"id": "adam", "label": "📍 アダムの店"})
			spots.append({"id": "ryuji", "label": "📍 リュウジの店"})
	elif CalendarManager.current_time == "night":
		spots.append({"id": "chillhouse", "label": "📍 チルハウス（夜）"})
		spots.append({"id": "home", "label": "📍 自宅で休む"})
		if CalendarManager.current_day >= 2:
			spots.append({"id": "nishio", "label": "📍 にしおの店（夜）"})
			spots.append({"id": "adam", "label": "📍 アダムの店（夜）"})
			spots.append({"id": "ryuji", "label": "📍 リュウジの店（夜）"})
	return spots


func _on_spot_pressed(spot: Dictionary) -> void:
	_pending_spot = spot
	confirm_dialog.dialog_text = "%s に行く？" % str(spot.get("label", "この場所"))
	confirm_dialog.popup_centered()


func _on_confirmed() -> void:
	if _pending_spot.is_empty():
		return
	_enter_spot(_pending_spot)
	_pending_spot = {}


func _enter_spot(spot: Dictionary) -> void:
	var id = str(spot.get("id", ""))
	match id:
		"chillhouse":
			get_tree().change_scene_to_file("res://scenes/daily/baito.tscn")
		"shop":
			if not CalendarManager.use_action():
				message_label.text = "行動コマが足りません。"
				return
			GameManager.set_transient("advance_time_after_scene", true)
			get_tree().change_scene_to_file("res://scenes/daily/shop.tscn")
		"home":
			if not CalendarManager.use_action():
				message_label.text = "行動コマが足りません。"
				return
			PlayerData.add_stat("guts", 2)
			GameManager.log_stat_change("guts", 2)
			CalendarManager.advance_time()
			_go_next_phase()
		"nishio", "adam", "ryuji":
			if not CalendarManager.use_action():
				message_label.text = "行動コマが足りません。"
				return
			GameManager.set_transient("interaction_target", id)
			GameManager.set_transient("advance_time_after_scene", true)
			get_tree().change_scene_to_file("res://scenes/daily/interaction.tscn")


func _go_next_phase() -> void:
	if CalendarManager.current_time == "midnight":
		get_tree().change_scene_to_file("res://scenes/daily/night_end.tscn")
		return
	get_tree().change_scene_to_file("res://scenes/daily/map.tscn")
