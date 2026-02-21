extends Node

signal game_state_changed(new_state: String)
signal chapter_started(chapter_num: int)

const SAVE_VERSION: int = 2
const SAVE_PATH_TEMPLATE := "user://save_slot_%d.json"
const SETTINGS_PATH := "user://settings.cfg"
const BGM_TITLE_PATH = "res://assets/audio/bgm/daily_part.mp3"
const BGM_DAILY_PATH = "res://assets/audio/bgm/daily_part.mp3"
const BGM_TONARI_PATH = "res://assets/audio/bgm/tonari.mp3"
const DEFAULT_BGM_LEVEL := 0.8
const DEFAULT_SE_LEVEL := 0.8
const SILENT_DB := -80.0

var current_chapter: int = 1
var current_phase: String = "daily"
var game_state: String = "title"

var transient: Dictionary = {}
var daily_summary: Dictionary = {
	"stats": {},
	"money": 0,
	"flavors": []
}

var _bgm_player: AudioStreamPlayer
var _bgm_base_volume_db: float = -8.0
var _current_bgm_path: String = ""
var _se_player: AudioStreamPlayer
var _se_stream_cache: Dictionary = {}

## Forced events loaded from data
var _forced_events: Array = []


func _ready() -> void:
	_setup_audio_player()
	_setup_se_player()
	_apply_default_font()
	_apply_default_theme()
	apply_audio_settings()


func _apply_default_font() -> void:
	var font_path = "res://assets/fonts/DotGothic16-Regular.ttf"
	if not ResourceLoader.exists(font_path):
		return
	var font_resource = load(font_path)
	if font_resource == null:
		return
	var theme = Theme.new()
	theme.default_font = font_resource
	theme.default_font_size = 22
	get_tree().root.theme = theme


func _apply_default_theme() -> void:
	var root_theme = get_tree().root.theme
	if root_theme == null:
		root_theme = Theme.new()
		get_tree().root.theme = root_theme

	var neon_text = Color("f7e8ff")
	var dim_text = Color("a8b2d9")
	var panel_bg = Color(0.03, 0.04, 0.11, 0.95)
	var panel_border = Color(0.12, 0.85, 1.0, 0.95)
	var button_bg = Color(0.09, 0.05, 0.15, 0.95)
	var button_hover = Color(0.14, 0.08, 0.22, 0.98)
	var button_pressed = Color(0.22, 0.08, 0.20, 1.0)
	var button_border = Color(1.0, 0.35, 0.78, 0.95)

	root_theme.set_color("font_color", "Label", neon_text)
	root_theme.set_color("font_color", "Button", neon_text)
	root_theme.set_color("font_hover_color", "Button", Color("fef4ff"))
	root_theme.set_color("font_pressed_color", "Button", Color("ffe6f7"))
	root_theme.set_color("font_disabled_color", "Button", dim_text)
	root_theme.set_color("default_color", "RichTextLabel", neon_text)
	root_theme.set_color("font_color", "LineEdit", neon_text)

	root_theme.set_stylebox("panel", "Panel", _make_stylebox(panel_bg, panel_border, 2, 10))
	root_theme.set_stylebox("panel", "PanelContainer", _make_stylebox(panel_bg, panel_border, 2, 10))
	root_theme.set_stylebox("normal", "Button", _make_stylebox(button_bg, button_border, 2, 8))
	root_theme.set_stylebox("hover", "Button", _make_stylebox(button_hover, panel_border, 2, 8))
	root_theme.set_stylebox("pressed", "Button", _make_stylebox(button_pressed, button_border, 2, 8))
	root_theme.set_stylebox("disabled", "Button", _make_stylebox(Color(0.08, 0.08, 0.1, 0.9), Color(0.24, 0.26, 0.35, 0.9), 1, 8))
	root_theme.set_stylebox("focus", "Button", _make_stylebox(button_hover, panel_border, 2, 8))

	root_theme.set_stylebox("normal", "RichTextLabel", _make_stylebox(Color(0.02, 0.03, 0.09, 0.85), Color(0.08, 0.44, 0.78, 0.6), 1, 6))
	root_theme.set_stylebox("normal", "LineEdit", _make_stylebox(Color(0.04, 0.04, 0.1, 1.0), panel_border, 2, 6))
	root_theme.set_stylebox("read_only", "LineEdit", _make_stylebox(Color(0.04, 0.04, 0.08, 0.9), Color(0.28, 0.30, 0.4, 0.9), 1, 6))


func _make_stylebox(bg: Color, border: Color, border_width: int, radius: int) -> StyleBoxFlat:
	var style = StyleBoxFlat.new()
	style.bg_color = bg
	style.border_color = border
	style.border_width_bottom = border_width
	style.border_width_left = border_width
	style.border_width_right = border_width
	style.border_width_top = border_width
	style.corner_radius_bottom_left = radius
	style.corner_radius_bottom_right = radius
	style.corner_radius_top_left = radius
	style.corner_radius_top_right = radius
	style.content_margin_left = 12
	style.content_margin_right = 12
	style.content_margin_top = 8
	style.content_margin_bottom = 8
	return style


func _setup_audio_player() -> void:
	if is_instance_valid(_bgm_player):
		return
	_bgm_player = AudioStreamPlayer.new()
	_bgm_player.name = "BGMPlayer"
	_bgm_player.bus = "Master"
	add_child(_bgm_player)


func _setup_se_player() -> void:
	if is_instance_valid(_se_player):
		return
	_se_player = AudioStreamPlayer.new()
	_se_player.name = "SEPlayer"
	_se_player.bus = "Master"
	add_child(_se_player)


func play_bgm(path: String, volume_db: float = -8.0, loop: bool = true) -> void:
	_setup_audio_player()
	if path == "":
		return
	if _current_bgm_path == path and _bgm_player.playing:
		_bgm_base_volume_db = volume_db
		_apply_bgm_volume_from_settings()
		return
	if not ResourceLoader.exists(path):
		return

	var stream_resource = load(path)
	if stream_resource == null:
		return

	var stream = stream_resource.duplicate()
	if stream is AudioStreamMP3:
		stream.loop = loop
	elif stream is AudioStreamOggVorbis:
		stream.loop = loop
	elif stream is AudioStreamWAV:
		stream.loop_mode = AudioStreamWAV.LOOP_FORWARD if loop else AudioStreamWAV.LOOP_DISABLED

	_bgm_player.stream = stream
	_bgm_base_volume_db = volume_db
	_apply_bgm_volume_from_settings()
	_bgm_player.play()
	_current_bgm_path = path


func stop_bgm() -> void:
	if not is_instance_valid(_bgm_player):
		return
	_bgm_player.stop()
	_current_bgm_path = ""


func play_daily_bgm() -> void:
	if ResourceLoader.exists(BGM_DAILY_PATH):
		play_bgm(BGM_DAILY_PATH, -11.0, true)
		return
	if ResourceLoader.exists(BGM_TONARI_PATH):
		play_bgm(BGM_TONARI_PATH, -10.0, true)


func apply_audio_settings() -> void:
	_apply_bgm_volume_from_settings()


func play_ui_se(kind: String = "cursor") -> void:
	_setup_se_player()
	var se_level = _get_audio_level("se", DEFAULT_SE_LEVEL)
	if se_level <= 0.001:
		return
	var stream = _get_ui_se_stream(kind)
	if stream == null:
		return
	_se_player.stop()
	_se_player.stream = stream
	_se_player.volume_db = _linear_level_to_db(se_level)
	_se_player.play()


func _apply_bgm_volume_from_settings() -> void:
	if not is_instance_valid(_bgm_player):
		return
	var bgm_level = _get_audio_level("bgm", DEFAULT_BGM_LEVEL)
	_bgm_player.volume_db = _bgm_base_volume_db + _linear_level_to_db(bgm_level)


func _get_audio_level(key: String, fallback: float) -> float:
	var cfg = ConfigFile.new()
	if cfg.load(SETTINGS_PATH) != OK:
		return fallback
	return clampf(float(cfg.get_value("audio", key, fallback)), 0.0, 1.0)


func _linear_level_to_db(level: float) -> float:
	if level <= 0.001:
		return SILENT_DB
	return linear_to_db(level)


func _get_ui_se_stream(kind: String) -> AudioStreamWAV:
	if _se_stream_cache.has(kind):
		return _se_stream_cache[kind]
	var profile = _get_ui_se_profile(kind)
	var stream = _build_ui_se_stream(profile)
	_se_stream_cache[kind] = stream
	return stream


func _get_ui_se_profile(kind: String) -> Dictionary:
	match kind:
		"confirm":
			return {"freq": 960.0, "duration": 0.07, "wave": "square"}
		"purchase":
			return {"freq": 740.0, "duration": 0.09, "wave": "sine"}
		"cancel":
			return {"freq": 520.0, "duration": 0.08, "wave": "triangle"}
		_:
			return {"freq": 820.0, "duration": 0.05, "wave": "square"}


func _build_ui_se_stream(profile: Dictionary) -> AudioStreamWAV:
	var freq = float(profile.get("freq", 820.0))
	var duration = clampf(float(profile.get("duration", 0.05)), 0.02, 0.2)
	var wave = str(profile.get("wave", "sine"))
	var sample_rate = 22050
	var frame_count = maxi(1, int(sample_rate * duration))
	var attack = maxi(1, int(sample_rate * 0.004))
	var release = maxi(1, int(sample_rate * 0.03))
	var amplitude = 0.35

	var data = PackedByteArray()
	data.resize(frame_count * 2)
	for i in range(frame_count):
		var phase = TAU * freq * float(i) / float(sample_rate)
		var oscillator = sin(phase)
		match wave:
			"square":
				oscillator = 1.0 if oscillator >= 0.0 else -1.0
			"triangle":
				oscillator = (2.0 / PI) * asin(sin(phase))
			_:
				oscillator = sin(phase)

		var env_attack = mini(1.0, float(i) / float(attack))
		var release_start = frame_count - release
		var env_release = 1.0
		if i > release_start:
			env_release = maxi(0.0, float(frame_count - i) / float(release))
		var env = env_attack * env_release
		var sample_value = int(clampi(int(oscillator * env * amplitude * 32767.0), -32768, 32767))
		var byte_index = i * 2
		data[byte_index] = sample_value & 0xFF
		data[byte_index + 1] = (sample_value >> 8) & 0xFF

	var stream = AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.mix_rate = sample_rate
	stream.stereo = false
	stream.loop_mode = AudioStreamWAV.LOOP_DISABLED
	stream.data = data
	return stream


func start_new_game() -> void:
	current_chapter = 1
	current_phase = "daily"
	game_state = "daily"
	PlayerData.reset_data()
	CalendarManager.setup_chapter(1)
	AffinityManager.reset_data()
	RivalIntel.reset_data()
	EventFlags.reset_flags()
	reset_daily_summary()
	transient.clear()
	PlayerData.add_flavor("double_apple", 2)
	_load_forced_events()
	emit_signal("chapter_started", current_chapter)
	emit_signal("game_state_changed", game_state)


func start_chapter(chapter_num: int) -> void:
	current_chapter = chapter_num
	current_phase = "daily"
	game_state = "daily"
	CalendarManager.setup_chapter(chapter_num)
	_load_forced_events()
	emit_signal("chapter_started", current_chapter)
	emit_signal("game_state_changed", game_state)


func transition_to_tournament() -> void:
	current_phase = "tournament"
	game_state = "tournament"
	emit_signal("game_state_changed", game_state)


func transition_to_interval() -> void:
	var config = CalendarManager.CHAPTER_CONFIG.get(current_chapter, {})
	var interval_days = int(config.get("interval_days", 0))
	if interval_days <= 0:
		return
	current_phase = "interval"
	game_state = "interval"
	CalendarManager.start_interval(interval_days)
	emit_signal("game_state_changed", game_state)


func end_interval_and_next_chapter() -> void:
	CalendarManager.end_interval()
	start_chapter(current_chapter + 1)


## Forced events system
func _load_forced_events() -> void:
	_forced_events.clear()
	if not FileAccess.file_exists("res://data/forced_events.json"):
		return
	var file = FileAccess.open("res://data/forced_events.json", FileAccess.READ)
	if file == null:
		return
	var parsed = JSON.parse_string(file.get_as_text())
	file.close()
	if typeof(parsed) != TYPE_DICTIONARY:
		return
	var key = "chapter_%d" % current_chapter
	var events = parsed.get(key, [])
	for event in events:
		_forced_events.append(event)


func get_forced_event_for_today(time_slot: String) -> Dictionary:
	var day = CalendarManager.current_day
	for event in _forced_events:
		if int(event.get("day", -1)) != day:
			continue
		if str(event.get("time_slot", "")) != time_slot:
			continue
		var flag = str(event.get("flag", ""))
		if flag != "" and EventFlags.get_flag(flag):
			continue
		return event
	return {}


func complete_forced_event(event: Dictionary) -> void:
	var flag = str(event.get("flag", ""))
	if flag != "":
		EventFlags.set_flag(flag)
	var stat_changes = event.get("stat_changes", {})
	if typeof(stat_changes) == TYPE_DICTIONARY:
		for stat_name in stat_changes:
			var amount = int(stat_changes[stat_name])
			if amount != 0:
				PlayerData.add_stat(stat_name, amount)
				log_stat_change(stat_name, amount)


func set_transient(key: String, value: Variant) -> void:
	transient[key] = value


func get_transient(key: String, default_value: Variant = null) -> Variant:
	return transient.get(key, default_value)


func pop_transient(key: String, default_value: Variant = null) -> Variant:
	var value = transient.get(key, default_value)
	transient.erase(key)
	return value


func queue_dialogue(dialogue_file: String, dialogue_id: String, next_scene: String, metadata: Dictionary = {}) -> void:
	set_transient("queued_dialogue", {
		"file": dialogue_file,
		"id": dialogue_id,
		"next_scene": next_scene,
		"metadata": metadata,
	})


func pop_queued_dialogue() -> Dictionary:
	return pop_transient("queued_dialogue", {})


func reset_daily_summary() -> void:
	daily_summary = {
		"stats": {},
		"money": 0,
		"flavors": []
	}


func log_stat_change(stat_name: String, amount: int) -> void:
	if amount == 0:
		return
	var current = int(daily_summary["stats"].get(stat_name, 0))
	daily_summary["stats"][stat_name] = current + amount


func log_money_change(amount: int) -> void:
	daily_summary["money"] = int(daily_summary.get("money", 0)) + amount


func log_flavor_change(flavor_name: String, amount: int) -> void:
	if amount == 0:
		return
	daily_summary["flavors"].append({
		"name": flavor_name,
		"amount": amount,
	})


func consume_daily_summary() -> Dictionary:
	var snapshot = daily_summary.duplicate(true)
	reset_daily_summary()
	return snapshot


func save_game(slot: int) -> bool:
	var save_data: Dictionary = {
		"save_version": SAVE_VERSION,
		"chapter": current_chapter,
		"phase": current_phase,
		"day": CalendarManager.current_day,
		"time": CalendarManager.current_time,
		"actions_remaining": CalendarManager.actions_remaining,
		"is_interval": CalendarManager.is_interval,
		"interval_day": CalendarManager.interval_day,
		"interval_max_days": CalendarManager.interval_max_days,
		"is_overseas": CalendarManager.is_overseas,
		"overseas_location": CalendarManager.overseas_location,
		"player_data": PlayerData.to_save_data(),
		"affinities": AffinityManager.to_save_data(),
		"rival_intel": RivalIntel.to_save_data(),
		"event_flags": EventFlags.to_save_data(),
	}

	var path = SAVE_PATH_TEMPLATE % slot
	var file = FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		push_error("save failed: %s" % path)
		return false

	file.store_string(JSON.stringify(save_data, "\t"))
	file.close()
	return true


func load_game(slot: int) -> bool:
	var path = SAVE_PATH_TEMPLATE % slot
	if not FileAccess.file_exists(path):
		return false

	var file = FileAccess.open(path, FileAccess.READ)
	if file == null:
		return false

	var raw_text = file.get_as_text()
	file.close()

	var parsed = JSON.parse_string(raw_text)
	if typeof(parsed) != TYPE_DICTIONARY:
		return false

	var data: Dictionary = parsed
	current_chapter = int(data.get("chapter", 1))
	current_phase = str(data.get("phase", "daily"))
	game_state = current_phase
	transient.clear()
	reset_daily_summary()

	CalendarManager.current_day = int(data.get("day", 1))
	CalendarManager.current_time = str(data.get("time", "morning"))
	CalendarManager.actions_remaining = int(data.get("actions_remaining", 2))
	CalendarManager.is_interval = bool(data.get("is_interval", false))
	CalendarManager.interval_day = int(data.get("interval_day", 0))
	CalendarManager.interval_max_days = int(data.get("interval_max_days", 0))
	CalendarManager.is_overseas = bool(data.get("is_overseas", false))
	CalendarManager.overseas_location = str(data.get("overseas_location", ""))

	PlayerData.from_save_data(data.get("player_data", {}))
	AffinityManager.from_save_data(data.get("affinities", {}))
	RivalIntel.from_save_data(data.get("rival_intel", {}))
	EventFlags.from_save_data(data.get("event_flags", {}))

	_load_forced_events()

	emit_signal("chapter_started", current_chapter)
	emit_signal("game_state_changed", game_state)
	return true
