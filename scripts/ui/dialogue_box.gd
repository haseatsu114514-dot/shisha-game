extends Control

signal dialogue_finished(dialogue_id: String)

@export var dialogue_file: String = "res://data/dialogue/ch1_main.json"
@export var dialogue_id: String = ""
@export var next_scene_path: String = ""

@onready var speaker_label: Label = %SpeakerLabel
@onready var text_label: RichTextLabel = %TextLabel
@onready var choice_container: VBoxContainer = %ChoiceContainer
@onready var advance_button: Button = %AdvanceButton
@onready var typing_timer: Timer = %TypingTimer
@onready var portrait_rect: TextureRect = %CharacterPortrait
@onready var background_image: TextureRect = %BackgroundImage

var _line_queue: Array = []
var _branches: Dictionary = {}
var _metadata: Dictionary = {}

var _is_typing = false
var _full_text = ""
var _current_char = 0
var _current_speaker = ""

const SPEAKER_NAMES := {
	"hajime": "はじめ",
	"sumi": "スミさん",
	"naru": "なる",
	"adam": "アダム",
	"kirara": "きらら",
	"tsumugi": "つむぎ",
	"packii": "パッキー",
	"salaryman": "サラリーマン",
	"toki_kotetsu": "土岐鋼鉄",
	"maezono": "前園壮一郎",
	"kirishima": "霧島レン",
	"takiguchi": "焚口ショウ",
	"staff_choizap": "チョイザップスタッフ"
}


func _ready() -> void:
	advance_button.pressed.connect(_on_advance_button_pressed)
	typing_timer.timeout.connect(_on_typing_timer_timeout)
	_load_dialogue_request_if_exists()
	_apply_background_from_metadata()
	if not _load_dialogue_data():
		text_label.text = "会話データを読み込めませんでした。"
		advance_button.text = "戻る"
		advance_button.disabled = false
		return
	_show_next_line()


func _load_dialogue_request_if_exists() -> void:
	var queued = GameManager.pop_queued_dialogue()
	if queued.is_empty():
		return
	dialogue_file = str(queued.get("file", dialogue_file))
	dialogue_id = str(queued.get("id", dialogue_id))
	next_scene_path = str(queued.get("next_scene", next_scene_path))
	_metadata = queued.get("metadata", {})


func _apply_background_from_metadata() -> void:
	background_image.texture = null
	if not _metadata.has("bg"):
		return
	var path = str(_metadata.get("bg", ""))
	if path == "":
		return
	if not ResourceLoader.exists(path):
		return
	var tex = load(path)
	if tex == null:
		return
	background_image.texture = tex


func _load_dialogue_data() -> bool:
	if dialogue_id == "":
		return false
	if not FileAccess.file_exists(dialogue_file):
		return false

	var file = FileAccess.open(dialogue_file, FileAccess.READ)
	if file == null:
		return false

	var parsed = JSON.parse_string(file.get_as_text())
	file.close()
	if typeof(parsed) != TYPE_DICTIONARY:
		return false

	var target_dialogue = _find_dialogue(parsed, dialogue_id)
	if target_dialogue.is_empty():
		return false

	_line_queue = target_dialogue.get("lines", []).duplicate(true)
	_branches = target_dialogue.get("branches", {}).duplicate(true)
	return true


func _find_dialogue(root: Dictionary, target_id: String) -> Dictionary:
	if root.has("dialogues"):
		for item in root["dialogues"]:
			if str(item.get("dialogue_id", "")) == target_id:
				return item
	if str(root.get("dialogue_id", "")) == target_id:
		return root
	return {}


func _on_advance_button_pressed() -> void:
	GameManager.play_ui_se("cursor")
	if _is_typing:
		_show_full_text_immediately()
		return
	if choice_container.get_child_count() > 0:
		return
	_show_next_line()


func _show_next_line() -> void:
	if _line_queue.is_empty():
		_finish_dialogue()
		return

	var line: Dictionary = _line_queue.pop_front()
	if str(line.get("type", "")) == "choice":
		_show_choices(line.get("choices", []))
		return

	_clear_choices()
	_current_speaker = str(line.get("speaker", ""))
	speaker_label.text = SPEAKER_NAMES.get(_current_speaker, _current_speaker)
	_update_portrait(line)
	_start_typing(str(line.get("text", "")))


func _start_typing(text: String) -> void:
	_full_text = text
	_current_char = 0
	text_label.text = ""
	_is_typing = true
	advance_button.disabled = false
	advance_button.text = "早送り"

	var cps = float(30.0)
	if FileAccess.file_exists("user://settings.cfg"):
		var cfg = ConfigFile.new()
		if cfg.load("user://settings.cfg") == OK:
			cps = float(cfg.get_value("text", "speed", 30.0))
	cps = clampf(cps, 10.0, 120.0)
	typing_timer.wait_time = 1.0 / cps
	typing_timer.start()


func _on_typing_timer_timeout() -> void:
	if not _is_typing:
		return
	_current_char += 1
	if _current_char >= _full_text.length():
		_show_full_text_immediately()
		return
	text_label.text = _full_text.substr(0, _current_char)


func _show_full_text_immediately() -> void:
	_is_typing = false
	typing_timer.stop()
	text_label.text = _full_text
	advance_button.text = "次へ"


func _show_choices(choices: Array) -> void:
	_clear_choices()
	advance_button.disabled = true
	advance_button.text = "選択"
	for choice in choices:
		var button = Button.new()
		button.text = str(choice.get("text", "選択肢"))
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.pressed.connect(_on_choice_selected.bind(str(choice.get("next", ""))))
		choice_container.add_child(button)


func _on_choice_selected(branch_key: String) -> void:
	GameManager.play_ui_se("confirm")
	_clear_choices()
	advance_button.disabled = false
	advance_button.text = "次へ"
	if _branches.has(branch_key):
		var branch_lines: Array = _branches[branch_key]
		for i in range(branch_lines.size() - 1, -1, -1):
			_line_queue.push_front(branch_lines[i])
	_show_next_line()


func _clear_choices() -> void:
	for child in choice_container.get_children():
		child.queue_free()


func _update_portrait(line: Dictionary) -> void:
	var speaker = str(line.get("speaker", ""))
	if speaker == "":
		portrait_rect.visible = false
		portrait_rect.texture = null
		return

	var face = str(line.get("face", "normal"))
	var path = "res://assets/sprites/characters/chr_%s_%s.png" % [speaker, face]
	if not ResourceLoader.exists(path):
		path = "res://assets/sprites/characters/chr_%s_normal.png" % speaker
	if not ResourceLoader.exists(path):
		portrait_rect.visible = false
		portrait_rect.texture = null
		return

	var texture = load(path)
	if texture == null:
		portrait_rect.visible = false
		portrait_rect.texture = null
		return

	portrait_rect.texture = texture
	portrait_rect.visible = true


func _finish_dialogue() -> void:
	emit_signal("dialogue_finished", dialogue_id)

	if _metadata.has("set_flag"):
		EventFlags.set_flag(str(_metadata["set_flag"]))
	if _metadata.has("set_flags"):
		var flags = _metadata["set_flags"]
		if typeof(flags) == TYPE_ARRAY:
			for flag in flags:
				EventFlags.set_flag(str(flag))
	if _metadata.has("morning_notice"):
		GameManager.set_transient("morning_notice", _metadata["morning_notice"])

	if dialogue_id == "ch1_opening":
		EventFlags.set_flag("ch1_sumi_tournament_talk", true)
		EventFlags.set_flag("ch1_forced_opening_done", true)

	if next_scene_path != "":
		get_tree().change_scene_to_file(next_scene_path)
		return

	get_tree().change_scene_to_file("res://scenes/daily/map.tscn")
