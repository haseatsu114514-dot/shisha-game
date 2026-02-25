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
const SHOP_VISIT_COST := 3500

const SPOT_POSITIONS_DAY: Dictionary = {
	"tonari": Vector2(300, 420),
	"shop": Vector2(1020, 486),
	"naru": Vector2(1030, 254),
	"adam": Vector2(720, 224),
	"minto": Vector2(498, 286),
	"choizap": Vector2(160, 300),
	"kannon": Vector2(600, 540),
	"cafe": Vector2(840, 340),
	"shotengai": Vector2(480, 460),
	"tv_tower_park": Vector2(180, 200),
	"mukai": Vector2(800, 150),
	"tokyo_shisha": Vector2(400, 100),
	"tokyo_sightseeing": Vector2(200, 150),
	"dubai_shisha": Vector2(600, 300),
	"dubai_souq": Vector2(300, 400),
	"dubai_cafe": Vector2(900, 400),
}

const SPOT_POSITIONS_NIGHT: Dictionary = {
	"tonari": Vector2(300, 420),
	"shop": Vector2(1020, 486),
	"naru": Vector2(1030, 254),
	"adam": Vector2(720, 224),
	"minto": Vector2(498, 286),
	"mukai": Vector2(800, 150),
	"tokyo_shisha": Vector2(400, 100),
	"dubai_shisha": Vector2(600, 300),
	"dubai_souq": Vector2(300, 400),
}

const FACE_BY_SPOT_ID: Dictionary = {
	"naru": "naru",
	"adam": "adam",
	"minto": "minto",
}


func _ready() -> void:
	GameManager.play_daily_bgm()
	confirm_dialog.confirmed.connect(_on_confirmed)
	confirm_dialog.canceled.connect(func() -> void:
		_pending_spot = {}
	)
	_load_marker_textures()

	# Check for forced story events first (mandatory, cannot skip)
	var forced_event = GameManager.get_forced_event_for_today(CalendarManager.current_time)
	if not forced_event.is_empty():
		GameManager.complete_forced_event(forced_event)
		var dialogue_file = str(forced_event.get("dialogue_file", ""))
		var dialogue_id = str(forced_event.get("dialogue_id", ""))
		var event_metadata: Dictionary = forced_event.get("metadata", {})
		if dialogue_file != "" and dialogue_id != "":
				GameManager.queue_dialogue(dialogue_file, dialogue_id, "res://scenes/daily/map.tscn", event_metadata)
				get_tree().change_scene_to_file("res://scenes/dialogue/dialogue_box.tscn")
				return

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
	var lines: Array[String] = []
	if CalendarManager.is_tournament_day():
		lines.append("本日は大会当日です！ [tonari] へ向かってください。")
	else:
		lines.append("行き先を選択　（残り行動：%d）" % CalendarManager.actions_remaining)
		lines.append_array(_build_map_rule_lines())
	message_label.text = "\n".join(lines)

	for spot in _build_spot_list():
		_add_spot_marker(spot)


func _build_spot_list() -> Array:
	var spots: Array = []
	
	if CalendarManager.is_interval and GameManager.current_chapter == 3:
		return _build_all_japan_spots()
	
	if GameManager.current_chapter == 3:
		return _build_ch3_spots()
	elif GameManager.current_chapter == 4:
		return _build_ch4_spots()
	elif GameManager.current_chapter == 5:
		return _build_ch5_spots()
		
	# Chapter 1 or 2 (Local)
	if CalendarManager.is_tournament_day():
		spots.append({"id": "tonari", "label": "tonari（大会会場）"})
		return spots

	if CalendarManager.current_time == "noon":
		spots.append({"id": "tonari", "label": "tonari"})
		spots.append({"id": "shop", "label": "Dr.Hookah [SHOP]"})
		spots.append({"id": "naru", "label": "ケムリクサ"})
		if _are_rival_shops_unlocked():
			spots.append({"id": "adam", "label": "Eden"})
			spots.append({"id": "minto", "label": "ぺぱーみんと"})
		spots.append({"id": "shotengai", "label": "商店街"})
		spots.append({"id": "kannon", "label": "観音"})
		spots.append({"id": "choizap", "label": "チョイザップ"})
		if GameManager.current_chapter >= 2:
			spots.append({"id": "tv_tower_park", "label": "テレビ塔公園"})
			if EventFlags.get_flag("spot_cafe_unlocked"):
				spots.append({"id": "cafe", "label": "カフェ"})
	elif CalendarManager.current_time == "night":
		spots.append({"id": "tonari", "label": "tonari（夜）"})
		spots.append({"id": "shop", "label": "Dr.Hookah [SHOP]（夜）"})
		spots.append({"id": "naru", "label": "ケムリクサ（夜）"})
		if _are_rival_shops_unlocked():
			spots.append({"id": "adam", "label": "Eden（夜）"})
			spots.append({"id": "minto", "label": "ぺぱーみんと（夜）"})
	return spots

func _build_all_japan_spots() -> Array:
	var spots: Array = []
	# 昼夜共通の拠点
	spots.append({"id": "shop", "label": "Dr.Hookah [SHOP]"})
	
	if CalendarManager.current_time == "noon":
		spots.append({"id": "tonari", "label": "tonari（地元）"})
		spots.append({"id": "mukai", "label": "mukai（東京）"})
		spots.append({"id": "naru", "label": "ケムリクサ"})
		if _are_rival_shops_unlocked():
			spots.append({"id": "adam", "label": "Eden"})
			spots.append({"id": "minto", "label": "ぺぱーみんと"})
		spots.append({"id": "tokyo_shisha", "label": "東京のシーシャ屋巡り"})
		spots.append({"id": "tokyo_sightseeing", "label": "東京観光"})
		if EventFlags.get_flag("spot_choizap_unlocked"):
			spots.append({"id": "choizap", "label": "チョイザップ"})
		if EventFlags.get_flag("spot_kannon_unlocked"):
			spots.append({"id": "kannon", "label": "観音"})
		if EventFlags.get_flag("spot_cafe_unlocked"):
			spots.append({"id": "cafe", "label": "カフェ"})
	elif CalendarManager.current_time == "night":
		spots.append({"id": "tonari", "label": "tonari（夜）"})
		spots.append({"id": "mukai", "label": "mukai（夜）"})
		spots.append({"id": "naru", "label": "ケムリクサ（夜）"})
		if _are_rival_shops_unlocked():
			spots.append({"id": "adam", "label": "Eden（夜）"})
			spots.append({"id": "minto", "label": "ぺぱーみんと（夜）"})
		spots.append({"id": "tokyo_shisha", "label": "東京のシーシャ屋巡り（夜）"})
	return spots

func _build_ch3_spots() -> Array:
	var spots: Array = []
	if CalendarManager.current_time == "noon":
		spots.append({"id": "mukai", "label": "mukai"})
		spots.append({"id": "shop", "label": "Dr.Hookah [SHOP]"})
		spots.append({"id": "tokyo_shisha", "label": "東京のシーシャ屋巡り"})
		spots.append({"id": "tokyo_sightseeing", "label": "東京観光"})
	elif CalendarManager.current_time == "night":
		spots.append({"id": "mukai", "label": "mukai（夜）"})
		spots.append({"id": "shop", "label": "Dr.Hookah [SHOP]（夜）"})
		spots.append({"id": "tokyo_shisha", "label": "東京のシーシャ屋巡り（夜）"})
	return spots

func _build_ch4_spots() -> Array:
	var spots: Array = []
	if CalendarManager.current_time == "noon":
		spots.append({"id": "dubai_shisha", "label": "現地のシーシャ屋"})
		spots.append({"id": "shop", "label": "Dr.Hookah Dubai [SHOP]"})
		spots.append({"id": "dubai_souq", "label": "スパイス・スーク（市場）"})
		spots.append({"id": "dubai_cafe", "label": "ドバイの高級カフェ"})
	elif CalendarManager.current_time == "night":
		spots.append({"id": "dubai_shisha", "label": "現地のシーシャ屋（夜）"})
		spots.append({"id": "shop", "label": "Dr.Hookah Dubai [SHOP]（夜）"})
		spots.append({"id": "dubai_souq", "label": "スパイス・スーク（夜）"})
	return spots


func _build_ch5_spots() -> Array:
	var spots: Array = []
	spots.append({"id": "shop", "label": "Dr.Hookah [SHOP]"})
	
	if CalendarManager.current_time == "noon":
		spots.append({"id": "tonari", "label": "tonari"})
		spots.append({"id": "mukai", "label": "mukai（東京）"})
		spots.append({"id": "dubai_souq", "label": "ドバイ観光"})
		spots.append({"id": "naru", "label": "ケムリクサ"})
		spots.append({"id": "adam", "label": "Eden"})
		spots.append({"id": "minto", "label": "ぺぱーみんと"})
		if EventFlags.get_flag("spot_choizap_unlocked"):
			spots.append({"id": "choizap", "label": "チョイザップ"})
		if EventFlags.get_flag("spot_kannon_unlocked"):
			spots.append({"id": "kannon", "label": "観音"})
		if EventFlags.get_flag("spot_cafe_unlocked"):
			spots.append({"id": "cafe", "label": "カフェ"})
	elif CalendarManager.current_time == "night":
		spots.append({"id": "tonari", "label": "tonari（夜）"})
		spots.append({"id": "mukai", "label": "mukai（夜）"})
		spots.append({"id": "dubai_souq", "label": "ドバイ観光（夜）"})
		spots.append({"id": "naru", "label": "ケムリクサ（夜）"})
		spots.append({"id": "adam", "label": "Eden（夜）"})
		spots.append({"id": "minto", "label": "ぺぱーみんと（夜）"})
	return spots


func _on_spot_pressed(spot: Dictionary) -> void:
	GameManager.play_ui_se("cursor")
	var id = str(spot.get("id", ""))
	if id == "shop":
		_open_shop_confirm(spot)
		return
	# Rival shops: check if the rival is present today
	if id in ["naru", "adam", "minto"]:
		if not _is_rival_present(id):
			var rival_name = {"naru": "なる", "adam": "アダム", "minto": "みんと"}.get(id, id)
			if not EventFlags.get_flag("known_name_" + id):
				rival_name = "店長"
			message_label.text = "今日は%sは出勤していないようだ。" % rival_name
			GameManager.play_ui_se("cancel")
			return
	# Roaming spots: check if character event is available
	if id in ["shotengai", "kannon", "choizap", "tv_tower_park"]:
		if not _has_roaming_event(id):
			message_label.text = "特に用事がないから、いいや。"
			GameManager.play_ui_se("cancel")
			return
	_enter_spot(spot)


func _on_confirmed() -> void:
	if _pending_spot.is_empty():
		return
	_enter_spot(_pending_spot)
	_pending_spot = {}


func _open_shop_confirm(spot: Dictionary) -> void:
	_pending_spot = spot.duplicate(true)
	confirm_dialog.title = "Dr.Hookah 入店確認"
	confirm_dialog.dialog_text = _build_shop_preview_text()
	confirm_dialog.ok_button_text = "入店する"
	confirm_dialog.popup_centered()


func _build_shop_preview_text() -> String:
	var lines: Array[String] = []
	lines.append("現在の所持金: %d円" % PlayerData.money)
	lines.append("※ショップへの移動では時間は経過しません。")
	lines.append("※在庫は章が進むと増えます。")
	return "\n".join(lines)


func _build_map_rule_lines() -> Array[String]:
	var lines: Array[String] = []
	lines.append("ルール: 移動1回で行動を1消費")
	if not _are_rival_shops_unlocked():
		lines.append("解放条件: チュートリアル完了後Eden/ぺぱーみんと解放")
	else:
		lines.append("ライバル店: 解放済み")

	if GameManager.current_chapter == 1 and not EventFlags.get_flag("ch1_tournament_completed"):
		lines.append("章進行条件: 地方大会で1位")
	elif GameManager.current_chapter >= 2:
		lines.append("章進行条件: 各章大会で1位")
	return lines


func _enter_spot(spot: Dictionary) -> void:
	var id = str(spot.get("id", ""))
	match id:
		"tonari":
			get_tree().change_scene_to_file("res://scenes/daily/baito.tscn")
		"shop":
			# No time progression for shop
			get_tree().change_scene_to_file("res://scenes/ui/shop_menu.tscn")
		"naru", "adam", "minto":
			if not CalendarManager.use_action():
				_try_auto_return_home()
				return
			GameManager.set_transient("interaction_target", id)
			GameManager.set_transient("advance_time_after_scene", true)
			get_tree().change_scene_to_file("res://scenes/daily/interaction.tscn")
		"choizap":
			if not CalendarManager.use_action():
				_try_auto_return_home()
				return
			if not EventFlags.get_flag("choizap_member"):
				# First visit - show membership dialogue with choice
				GameManager.set_transient("interaction_target", "choizap")
				GameManager.set_transient("advance_time_after_scene", true)
				GameManager.queue_dialogue("res://data/dialogue/ch1_spots.json", "ch1_choizap_first", "res://scenes/daily/map.tscn")
				get_tree().change_scene_to_file("res://scenes/dialogue/dialogue_box.tscn")
			else:
				# Member - free visit, charm UP
				PlayerData.add_stat("charm", 1)
				GameManager.log_stat_change("charm", 1)
				GameManager.set_transient("advance_time_after_scene", true)
				GameManager.queue_dialogue("res://data/dialogue/ch1_spots.json", "ch1_choizap_visit", "res://scenes/daily/map.tscn")
				get_tree().change_scene_to_file("res://scenes/dialogue/dialogue_box.tscn")
		"kannon":
			if not CalendarManager.use_action():
				_try_auto_return_home()
				return
			# Random stat +1.5, then forced save
			var stats = ["technique", "sense", "guts", "charm", "insight"]
			var chosen_stat = stats[randi() % stats.size()]
			PlayerData.add_stat(chosen_stat, 1.5)
			GameManager.log_stat_change(chosen_stat, 1.5)
			GameManager.set_transient("advance_time_after_scene", true)
			GameManager.queue_dialogue("res://data/dialogue/ch1_spots.json", "ch1_kannon_visit", "res://scenes/daily/map.tscn")
			get_tree().change_scene_to_file("res://scenes/dialogue/dialogue_box.tscn")
			# Force save after prayer
			GameManager.force_save()
		"cafe":
			if not CalendarManager.use_action():
				_try_auto_return_home()
				return
			PlayerData.add_stat("sense", 1.5)
			GameManager.log_stat_change("sense", 1.5)
			GameManager.set_transient("advance_time_after_scene", true)
			GameManager.queue_dialogue("res://data/dialogue/ch1_spots.json", "ch1_cafe_visit", "res://scenes/daily/map.tscn")
			get_tree().change_scene_to_file("res://scenes/dialogue/dialogue_box.tscn")
		"shotengai":
			if not CalendarManager.use_action():
				_try_auto_return_home()
				return
			var event_id = _get_roaming_event_id("shotengai")
			GameManager.set_transient("advance_time_after_scene", true)
			GameManager.queue_dialogue("res://data/dialogue/ch1_spots.json", event_id, "res://scenes/daily/map.tscn")
			get_tree().change_scene_to_file("res://scenes/dialogue/dialogue_box.tscn")
		"tv_tower_park":
			if not CalendarManager.use_action():
				_try_auto_return_home()
				return
			var event_id = _get_roaming_event_id("tv_tower_park")
			GameManager.set_transient("advance_time_after_scene", true)
			GameManager.queue_dialogue("res://data/dialogue/ch2_spots.json", event_id, "res://scenes/daily/map.tscn")
			get_tree().change_scene_to_file("res://scenes/dialogue/dialogue_box.tscn")

		# --- Chapter 3 (Tokyo) Spots ---
		"mukai":
			get_tree().change_scene_to_file("res://scenes/daily/baito.tscn")
		"tokyo_shisha":
			if not CalendarManager.use_action():
				_try_auto_return_home()
				return
			# Gain Technique & Sense
			PlayerData.add_stat("technique", 1.0)
			PlayerData.add_stat("sense", 1.0)
			GameManager.log_stat_change("technique", 1.0)
			GameManager.log_stat_change("sense", 1.0)
			GameManager.set_transient("advance_time_after_scene", true)
			GameManager.queue_dialogue("res://data/dialogue/ch3_spots.json", "ch3_tokyo_shisha", "res://scenes/daily/map.tscn")
			get_tree().change_scene_to_file("res://scenes/dialogue/dialogue_box.tscn")
		"tokyo_sightseeing":
			if not CalendarManager.use_action():
				_try_auto_return_home()
				return
			# Gain Guts & Insight
			PlayerData.add_stat("guts", 1.0)
			PlayerData.add_stat("insight", 1.0)
			GameManager.log_stat_change("guts", 1.0)
			GameManager.log_stat_change("insight", 1.0)
			GameManager.set_transient("advance_time_after_scene", true)
			GameManager.queue_dialogue("res://data/dialogue/ch3_spots.json", "ch3_tokyo_sightseeing", "res://scenes/daily/map.tscn")
			get_tree().change_scene_to_file("res://scenes/dialogue/dialogue_box.tscn")
			
		# --- Chapter 4 (Dubai) Spots ---
		"dubai_shisha":
			get_tree().change_scene_to_file("res://scenes/daily/baito.tscn")
		"dubai_souq":
			if not CalendarManager.use_action():
				_try_auto_return_home()
				return
			# Gain random stats massively
			var stats = ["technique", "sense", "guts", "charm", "insight"]
			var chosen_stat = stats[randi() % stats.size()]
			PlayerData.add_stat(chosen_stat, 2.0)
			GameManager.log_stat_change(chosen_stat, 2.0)
			GameManager.set_transient("advance_time_after_scene", true)
			GameManager.queue_dialogue("res://data/dialogue/ch4_spots.json", "ch4_dubai_souq", "res://scenes/daily/map.tscn")
			get_tree().change_scene_to_file("res://scenes/dialogue/dialogue_box.tscn")
		"dubai_cafe":
			if not CalendarManager.use_action():
				_try_auto_return_home()
				return
			# High sense & charm gain, but costs money
			var cost = 3000
			if PlayerData.money < cost:
				message_label.text = "高級カフェに入るには %d円 必要です。" % cost
				CalendarManager.undo_action() # refund action point
				return
			PlayerData.spend_money(cost)
			GameManager.log_money_change(-cost)
			PlayerData.add_stat("sense", 1.5)
			PlayerData.add_stat("charm", 1.5)
			GameManager.log_stat_change("sense", 1.5)
			GameManager.log_stat_change("charm", 1.5)
			GameManager.set_transient("advance_time_after_scene", true)
			GameManager.queue_dialogue("res://data/dialogue/ch4_spots.json", "ch4_dubai_cafe", "res://scenes/daily/map.tscn")
			get_tree().change_scene_to_file("res://scenes/dialogue/dialogue_box.tscn")


func _are_rival_shops_unlocked() -> bool:
	if GameManager.current_chapter != 1:
		return true
	return EventFlags.get_flag("ch1_rival_shops_open")


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

	# Show "let's go home" notice
	var notice = ""
	if CalendarManager.current_time == "noon":
		notice = "今日はもう動けない。……帰るか。"
	else:
		notice = "夜も遅い。もう帰ろう。"
	GameManager.set_transient("morning_notice", notice)
	while CalendarManager.current_time == "noon" or CalendarManager.current_time == "night":
		# Do not skip mandatory night events by auto-advancing directly to midnight.
		if CalendarManager.current_time == "night":
			var forced_event = GameManager.get_forced_event_for_today("night")
			if not forced_event.is_empty():
				break
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
	label_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE

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

	var label_button = Button.new()
	label_button.text = ""
	label_button.flat = true
	label_button.focus_mode = Control.FOCUS_NONE
	label_button.position = label_panel.position
	label_button.custom_minimum_size = label_panel.custom_minimum_size
	label_button.size_flags_horizontal = Control.SIZE_FILL
	label_button.modulate = Color(1, 1, 1, 0.0)
	label_button.pressed.connect(_on_spot_pressed.bind(spot))
	marker.add_child(label_button)

	spot_layer.add_child(marker)


func _get_marker_position(spot_id: String) -> Vector2:
	var table = SPOT_POSITIONS_NIGHT if CalendarManager.current_time == "night" else SPOT_POSITIONS_DAY
	var base = table.get(spot_id, Vector2(640, 360))
	return base - Vector2(75, 58)


func _is_event_spot(spot_id: String) -> bool:
	# tonari and shop are always accessible (no event mark needed)
	if spot_id in ["tonari", "shop"]:
		return false
	# Rival shops: show event mark only when rival is present
	if spot_id in ["naru", "adam", "minto"]:
		return _is_rival_present(spot_id)
	# Roaming spots: show event mark only when a character event exists
	if spot_id in ["shotengai", "kannon", "choizap", "tv_tower_park"]:
		return _has_roaming_event(spot_id)
	# Other spots (mukai, tokyo_shisha etc) are always active
	return true


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


# ======== Roaming Event System ========
# Spots like 商店街 / 観音 / チョイザップ / テレビ塔公園 have character encounters
# that appear randomly based on day seed. When no character is present,
# the spot shows "特に用事はなさそうだ" and cannot be entered.

const ROAMING_EVENTS := {
	"shotengai": [
		{"id": "ch1_shotengai_tsumugi", "chance": 0.30},
	],
	"tv_tower_park": [
		{"id": "ch2_tvtower_sumi", "chance": 0.35},
	],
}

var _roaming_event_cache: Dictionary = {}


func _has_roaming_event(spot_id: String) -> bool:
	return _get_roaming_event_id(spot_id) != ""


func _get_roaming_event_id(spot_id: String) -> String:
	if _roaming_event_cache.has(spot_id):
		return str(_roaming_event_cache[spot_id])

	var events = ROAMING_EVENTS.get(spot_id, [])
	if events.is_empty():
		_roaming_event_cache[spot_id] = ""
		return ""

	# Use day number as seed for deterministic daily randomness
	var day_seed = CalendarManager.current_day * 7 + spot_id.hash()
	var rng = RandomNumberGenerator.new()
	rng.seed = day_seed

	for event in events:
		var roll = rng.randf()
		if roll < float(event.get("chance", 0.3)):
			var eid = str(event.get("id", ""))
			_roaming_event_cache[spot_id] = eid
			return eid

	_roaming_event_cache[spot_id] = ""
	return ""


var _rival_absence_days_cache: Dictionary = {}

func _is_rival_present(rival_id: String) -> bool:
	var chapter = 1
	if GameManager:
		chapter = GameManager.current_chapter
		
	var cache_key = "%s_ch%d" % [rival_id, chapter]
	
	# Cache the specific days the rival is absent for the current chapter
	if not _rival_absence_days_cache.has(cache_key):
		var rng = RandomNumberGenerator.new()
		rng.seed = cache_key.hash()
		
		# Each rival is absent for exactly 2 days out of the typical 14-day chapter
		var absent_days = []
		while absent_days.size() < 2:
			var d = rng.randi_range(2, 13) # Avoid day 1 and 14
			if not absent_days.has(d):
				absent_days.append(d)
		_rival_absence_days_cache[cache_key] = absent_days
	
	var today = CalendarManager.current_day
	var is_absent = _rival_absence_days_cache[cache_key].has(today)
	
	return not is_absent

