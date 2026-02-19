extends Control

@onready var map_background: TextureRect = %MapBackground
@onready var map_night_background: TextureRect = %MapNightBackground
@onready var night_overlay: ColorRect = %NightOverlay
@onready var spot_layer: Control = %SpotLayer
@onready var message_label: Label = %MessageLabel
@onready var confirm_dialog: ConfirmationDialog = %ConfirmDialog

var _pending_spot: Dictionary = {}
var _pin_texture: Texture2D
var _pin_event_texture: Texture2D
var _face_cache: Dictionary = {}

const SPOT_POSITIONS_DAY: Dictionary = {
	"chillhouse": Vector2(300, 420),
	"shop": Vector2(1020, 486),
	"naru": Vector2(1030, 254),
	"adam": Vector2(720, 224),
	"kirara": Vector2(498, 286),
	"home": Vector2(214, 544),
}

const SPOT_POSITIONS_NIGHT: Dictionary = {
	"chillhouse": Vector2(300, 420),
	"shop": Vector2(1020, 486),
	"naru": Vector2(1030, 254),
	"adam": Vector2(720, 224),
	"kirara": Vector2(498, 286),
	"home": Vector2(214, 544),
}

const FACE_BY_SPOT_ID: Dictionary = {
	"naru": "naru",
	"adam": "adam",
	"kirara": "kirara",
}


func _ready() -> void:
	GameManager.play_daily_bgm()
	confirm_dialog.confirmed.connect(_on_confirmed)
	_load_marker_textures()

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

	if _try_auto_return_home():
		return

	_refresh_spots()


func _refresh_spots() -> void:
	for child in spot_layer.get_children():
		child.queue_free()

	_apply_map_visuals()
	message_label.text = "行き先を選択　（残り行動：%d）" % CalendarManager.actions_remaining

	for spot in _build_spot_list():
		_add_spot_marker(spot)


func _build_spot_list() -> Array:
	var spots: Array = []
	if CalendarManager.current_time == "noon":
		spots.append({"id": "chillhouse", "label": "チルハウス"})
		spots.append({"id": "shop", "label": "シーシャショップ"})
		if CalendarManager.current_day >= 2:
			spots.append({"id": "naru", "label": "なるの店"})
			spots.append({"id": "adam", "label": "アダムの店"})
			spots.append({"id": "kirara", "label": "きららの店"})
	elif CalendarManager.current_time == "night":
		spots.append({"id": "chillhouse", "label": "チルハウス（夜）"})
		spots.append({"id": "home", "label": "自宅で休む"})
		if CalendarManager.current_day >= 2:
			spots.append({"id": "naru", "label": "なるの店（夜）"})
			spots.append({"id": "adam", "label": "アダムの店（夜）"})
			spots.append({"id": "kirara", "label": "きららの店（夜）"})
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
		"naru", "adam", "kirara":
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


func _try_auto_return_home() -> bool:
	if CalendarManager.actions_remaining > 0:
		return false
	if CalendarManager.current_time != "noon" and CalendarManager.current_time != "night":
		return false

	GameManager.set_transient("morning_notice", "行動コマが尽きたのでそのまま家に帰った。")
	while CalendarManager.current_time == "noon" or CalendarManager.current_time == "night":
		CalendarManager.advance_time()
	_go_next_phase()
	return true


func _apply_map_visuals() -> void:
	var is_night = CalendarManager.current_time == "night"
	map_background.visible = not is_night
	map_night_background.visible = is_night
	night_overlay.color = Color(0.02, 0.05, 0.08, 0.14) if is_night else Color(0, 0, 0, 0)


func _load_marker_textures() -> void:
	_pin_texture = _safe_load_texture("res://assets/ui/ui_map_pin.png")
	_pin_event_texture = _safe_load_texture("res://assets/ui/ui_map_pin_event.png")


func _add_spot_marker(spot: Dictionary) -> void:
	var id = str(spot.get("id", ""))
	var marker = Control.new()
	marker.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	marker.custom_minimum_size = Vector2(150, 120)
	marker.position = _get_marker_position(id)

	var pin = TextureButton.new()
	pin.custom_minimum_size = Vector2(64, 64)
	pin.position = Vector2(44, 8)
	pin.texture_normal = _pin_event_texture if _is_event_spot(id) else _pin_texture
	pin.ignore_texture_size = false
	pin.stretch_mode = TextureButton.STRETCH_KEEP_ASPECT_CENTERED
	pin.pressed.connect(_on_spot_pressed.bind(spot))
	marker.add_child(pin)

	var face_tex = _get_face_texture(id)
	if face_tex != null:
		var face = TextureRect.new()
		face.custom_minimum_size = Vector2(46, 46)
		face.position = Vector2(53, -26)
		face.texture = face_tex
		face.expand_mode = 1
		face.stretch_mode = 5
		pin.add_child(face)

	var label_panel = PanelContainer.new()
	label_panel.position = Vector2(16, 68)
	label_panel.custom_minimum_size = Vector2(118, 36)
	label_panel.self_modulate = Color(1, 1, 1, 0.9)

	var style = StyleBoxFlat.new()
	style.bg_color = Color(0.03, 0.05, 0.09, 0.86)
	style.border_color = Color(0.44, 0.76, 1.0, 0.96)
	style.border_width_top = 1
	style.border_width_bottom = 1
	style.border_width_left = 1
	style.border_width_right = 1
	style.corner_radius_top_left = 8
	style.corner_radius_top_right = 8
	style.corner_radius_bottom_left = 8
	style.corner_radius_bottom_right = 8
	label_panel.add_theme_stylebox_override("panel", style)

	var label = Label.new()
	label.anchor_right = 1.0
	label.anchor_bottom = 1.0
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.text = str(spot.get("label", "スポット"))
	label.add_theme_font_size_override("font_size", 15)
	label_panel.add_child(label)
	marker.add_child(label_panel)

	spot_layer.add_child(marker)


func _get_marker_position(spot_id: String) -> Vector2:
	var table = SPOT_POSITIONS_NIGHT if CalendarManager.current_time == "night" else SPOT_POSITIONS_DAY
	var base = table.get(spot_id, Vector2(640, 360))
	return base - Vector2(75, 58)


func _is_event_spot(spot_id: String) -> bool:
	if spot_id == "chillhouse" and CalendarManager.current_day >= 5 and not EventFlags.get_flag("ch1_day5_sumi_story"):
		return true
	if spot_id in ["naru", "adam", "kirara"] and not EventFlags.get_flag("ch1_%s_met" % spot_id):
		return true
	return false


func _get_face_texture(spot_id: String) -> Texture2D:
	if not FACE_BY_SPOT_ID.has(spot_id):
		return null
	var face_id = str(FACE_BY_SPOT_ID[spot_id])
	var met_flag = "ch1_%s_met" % face_id
	if not EventFlags.get_flag(met_flag):
		return null

	if _face_cache.has(face_id):
		return _face_cache[face_id]
	var path = "res://assets/sprites/faces/face_%s.png" % face_id
	var tex = _safe_load_texture(path)
	_face_cache[face_id] = tex
	return tex


func _safe_load_texture(path: String) -> Texture2D:
	if not ResourceLoader.exists(path):
		return null
	var loaded = load(path)
	return loaded as Texture2D
