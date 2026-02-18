extends Node

signal game_state_changed(new_state: String)
signal chapter_started(chapter_num: int)

const SAVE_VERSION: int = 1
const SAVE_PATH_TEMPLATE := "user://save_slot_%d.json"

var current_chapter: int = 1
var current_phase: String = "daily"
var game_state: String = "title"

var transient: Dictionary = {}
var daily_summary: Dictionary = {
	"stats": {},
	"money": 0,
	"flavors": []
}


func _ready() -> void:
	_apply_default_font()


func _apply_default_font() -> void:
	var font_path := "res://assets/fonts/DotGothic16-Regular.ttf"
	if not ResourceLoader.exists(font_path):
		return
	var font_resource := load(font_path)
	if font_resource == null:
		return
	var theme := Theme.new()
	theme.default_font = font_resource
	theme.default_font_size = 24
	get_tree().root.theme = theme


func start_new_game() -> void:
	current_chapter = 1
	current_phase = "daily"
	game_state = "daily"
	PlayerData.reset_data()
	CalendarManager.reset_calendar(7, 8)
	AffinityManager.reset_data()
	RivalIntel.reset_data()
	EventFlags.reset_flags()
	reset_daily_summary()
	transient.clear()
	PlayerData.add_flavor("double_apple", 2)
	emit_signal("chapter_started", current_chapter)
	emit_signal("game_state_changed", game_state)


func start_chapter(chapter_num: int) -> void:
	current_chapter = chapter_num
	current_phase = "daily"
	game_state = "daily"
	if chapter_num == 1:
		CalendarManager.reset_calendar(7, 8)
	emit_signal("chapter_started", current_chapter)
	emit_signal("game_state_changed", game_state)


func transition_to_tournament() -> void:
	current_phase = "tournament"
	game_state = "tournament"
	emit_signal("game_state_changed", game_state)


func set_transient(key: String, value: Variant) -> void:
	transient[key] = value


func get_transient(key: String, default_value: Variant = null) -> Variant:
	return transient.get(key, default_value)


func pop_transient(key: String, default_value: Variant = null) -> Variant:
	var value := transient.get(key, default_value)
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
	var current := int(daily_summary["stats"].get(stat_name, 0))
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
	var snapshot := daily_summary.duplicate(true)
	reset_daily_summary()
	return snapshot


func save_game(slot: int) -> bool:
	var save_data: Dictionary = {
		"save_version": SAVE_VERSION,
		"chapter": current_chapter,
		"day": CalendarManager.current_day,
		"time": CalendarManager.current_time,
		"actions_remaining": CalendarManager.actions_remaining,
		"player_data": PlayerData.to_save_data(),
		"affinities": AffinityManager.to_save_data(),
		"rival_intel": RivalIntel.to_save_data(),
		"event_flags": EventFlags.to_save_data(),
	}

	var path := SAVE_PATH_TEMPLATE % slot
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		push_error("save failed: %s" % path)
		return false

	file.store_string(JSON.stringify(save_data, "\t"))
	file.close()
	return true


func load_game(slot: int) -> bool:
	var path := SAVE_PATH_TEMPLATE % slot
	if not FileAccess.file_exists(path):
		return false

	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return false

	var raw_text := file.get_as_text()
	file.close()

	var parsed := JSON.parse_string(raw_text)
	if typeof(parsed) != TYPE_DICTIONARY:
		return false

	var data: Dictionary = parsed
	current_chapter = int(data.get("chapter", 1))
	current_phase = "daily"
	game_state = "daily"
	transient.clear()
	reset_daily_summary()

	CalendarManager.current_day = int(data.get("day", 1))
	CalendarManager.current_time = str(data.get("time", "morning"))
	CalendarManager.actions_remaining = int(data.get("actions_remaining", 2))

	PlayerData.from_save_data(data.get("player_data", {}))
	AffinityManager.from_save_data(data.get("affinities", {}))
	RivalIntel.from_save_data(data.get("rival_intel", {}))
	EventFlags.from_save_data(data.get("event_flags", {}))

	emit_signal("chapter_started", current_chapter)
	emit_signal("game_state_changed", game_state)
	return true
