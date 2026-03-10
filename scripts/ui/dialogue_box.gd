extends Control

signal dialogue_finished(dialogue_id: String)

@export var dialogue_file: String = "res://data/dialogue/ch1_main.json"
@export var dialogue_id: String = ""
@export var next_scene_path: String = ""

@onready var speaker_label: Label = %SpeakerLabel
@onready var text_label: RichTextLabel = %TextLabel
@onready var choice_container: VBoxContainer = %ChoiceContainer
@onready var advance_button: Button = %AdvanceButton
@onready var auto_button: Button = %AutoButton
@onready var typing_timer: Timer = %TypingTimer
@onready var auto_timer: Timer = %AutoTimer
@onready var portrait_rect: TextureRect = %CharacterPortrait
@onready var background_image: TextureRect = %BackgroundImage
@onready var cg_rect: TextureRect = %CGRect
@onready var smoke_particles: GPUParticles2D = $SmokeParticles
@onready var log_button: Button = %LogButton
@onready var history_panel: Control = %HistoryPanel
@onready var history_vbox: VBoxContainer = %HistoryVBox
@onready var close_history_button: Button = %CloseHistoryButton
@onready var dialogue_panel: PanelContainer = $DialoguePanel

var _line_queue: Array[Dictionary] = []
var _history: Array[Dictionary] = []
var _branches: Dictionary = {}
var _metadata: Dictionary = {}

var _is_typing = false
var _full_text = ""
var _full_text_bbcode = ""
var _current_char = 0
var _current_speaker = ""
var _auto_enabled = false
var _dialogue_ending := false
var _advance_hold_timer: Timer
var _advance_repeat_timer: Timer
var _advance_hold_active := false
var _ignore_advance_press_once := false
var _portrait_texture_cache: Dictionary = {}
var _portrait_union_rect_cache: Dictionary = {}  # speaker_id -> Rect2i

const DIALOGUE_WRAP_CHARS := 20
const DIALOGUE_MAX_LINES := 2
const ADVANCE_HOLD_DELAY := 0.34
const ADVANCE_REPEAT_INTERVAL := 0.09
const PORTRAIT_CROP_PADDING := 20
const PORTRAIT_BOTTOM_TRIM_RATIO := 0.18
const PORTRAIT_BOTTOM_TRIM_MAX := 180
const PORTRAIT_MIN_VISIBLE_RATIO := 0.64
const NOTIFICATION_CARD_SIZE := Vector2(860, 108)
const NOTIFICATION_BASE_POSITION := Vector2(210, 304)

const SPEAKER_NAMES := {
	"hajime": "はじめ",
	"sumi": "スミさん",
	"naru": "なる",
	"adam": "アダム",
	"minto": "眠都(みんと)",
	"mashiro": "ましろ",
	"tsumugi": "つむぎ",
	"tumugi": "つむぎ",
	"hazime": "はじめ",
	"pakki": "パッキー",
	"salaryman": "サラリーマン",
	"nagumo": "南雲修二(なぐもしゅうじ)",
	"maezono": "前園壮一郎(まえぞのそういちろう)",
	"kirishima": "霧島レン(きりしまれん)",
	"staff_choizap": "チョイザップスタッフ"
}
const SPEAKER_ID_ALIASES := {
	"tumugi": "tsumugi",
	"hazime": "hajime",
	"takiguchi": "pakki",
}
const HIGHLIGHT_TAGS := [
	"[imp]", "[/imp]",
	"[warn]", "[/warn]",
	"[hint]", "[/hint]",
	"[red]", "[/red]",
	"[blue]", "[/blue]",
	"[sub]", "[/sub]"
]
const HIGHLIGHT_OPEN_REPLACEMENTS := {
	"[imp]": "[b][color=#ffd878]",
	"[red]": "[color=#ff5252]",
	"[blue]": "[color=#52a2ff]",
	"[sub]": "[font_size=18][color=#999999]",
	"[warn]": "[color=#ff8b8b]",
	"[hint]": "[color=#8bdcff]",
}
const HIGHLIGHT_CLOSE_REPLACEMENTS := {
	"[/imp]": "[/color][/b]",
	"[/red]": "[/color]",
	"[/blue]": "[/color]",
	"[/sub]": "[/color][/font_size]",
	"[/warn]": "[/color]",
	"[/hint]": "[/color]",
}


func _ready() -> void:
	if not GameManager:
		pass
		
	# Setup font and transparency
	# GameManager が root theme にフォントを設定済みのため override 不要
	# （override すると SystemFont fallback が失われてデバッグ実行で文字が消える）
	
	var panel_style = StyleBoxFlat.new()
	panel_style.bg_color = Color(0, 0, 0, 0.70)
	panel_style.corner_radius_top_left = 8
	panel_style.corner_radius_top_right = 8
	panel_style.corner_radius_bottom_right = 8
	panel_style.corner_radius_bottom_left = 8
	dialogue_panel.add_theme_stylebox_override("panel", panel_style)
	
	if advance_button:
		advance_button.pressed.connect(_on_advance_button_pressed)
		advance_button.button_down.connect(_on_advance_button_down)
		advance_button.button_up.connect(_on_advance_button_up)
	if auto_button:
		auto_button.pressed.connect(_on_auto_button_pressed)
	if typing_timer:
		typing_timer.timeout.connect(_on_typing_timer_timeout)
	if auto_timer:
		auto_timer.timeout.connect(_on_auto_timer_timeout)
	if log_button:
		log_button.pressed.connect(_on_log_button_pressed)
	if close_history_button:
		close_history_button.pressed.connect(_on_close_history_pressed)
	_set_auto_enabled(false)

	_advance_hold_timer = Timer.new()
	_advance_hold_timer.one_shot = true
	_advance_hold_timer.wait_time = ADVANCE_HOLD_DELAY
	_advance_hold_timer.timeout.connect(_on_advance_hold_timeout)
	add_child(_advance_hold_timer)

	_advance_repeat_timer = Timer.new()
	_advance_repeat_timer.one_shot = false
	_advance_repeat_timer.wait_time = ADVANCE_REPEAT_INTERVAL
	_advance_repeat_timer.timeout.connect(_on_advance_repeat_timeout)
	add_child(_advance_repeat_timer)
	
	if cg_rect:
		cg_rect.visible = false
		cg_rect.modulate = Color(1, 1, 1, 0)
	
	# Default smoke off
	if smoke_particles:
		smoke_particles.emitting = false
	
	_load_dialogue_request_if_exists()
	_apply_background_from_metadata()
	_apply_effects_from_metadata()
	
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


func _apply_effects_from_metadata() -> void:
	if not smoke_particles:
		return
	if _metadata.get("effect", "") == "smoke":
		smoke_particles.emitting = true
	else:
		smoke_particles.emitting = false


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
	background_image.modulate = Color(1.35, 1.35, 1.35, 1.0)
	background_image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	background_image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE


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

	_loaded_dialogue_root = parsed
	var target_dialogue = _find_dialogue(parsed, dialogue_id)
	if target_dialogue.is_empty():
		return false

	_line_queue.assign(target_dialogue.get("lines", []).duplicate(true))
	_branches = target_dialogue.get("branches", {}).duplicate(true)
	
	var metadata = target_dialogue.get("metadata", {})
	if metadata.has("bgm"):
		GameManager.play_bgm(str(metadata["bgm"]), -8.0, true)
	
	_loaded_dialogue_root = null
	return true

var _loaded_dialogue_root: Variant = null


func _find_dialogue(root: Dictionary, target_id: String) -> Dictionary:
	if root.has("dialogues"):
		for item in root["dialogues"]:
			if str(item.get("dialogue_id", "")) == target_id:
				return item
	if str(root.get("dialogue_id", "")) == target_id:
		return root
	return {}


func _on_advance_button_down() -> void:
	_ignore_advance_press_once = false
	if _advance_hold_timer != null:
		_advance_hold_timer.start()


func _on_advance_button_up() -> void:
	if _advance_hold_timer != null and not _advance_hold_timer.is_stopped():
		_advance_hold_timer.stop()
	if _advance_hold_active:
		_ignore_advance_press_once = true
	_stop_fast_advance()


func _on_advance_hold_timeout() -> void:
	if advance_button == null or advance_button.disabled:
		return
	_advance_hold_active = true
	_refresh_advance_button_label()
	_fast_advance_step()
	if _advance_repeat_timer != null and _advance_repeat_timer.is_stopped():
		_advance_repeat_timer.start()


func _on_advance_repeat_timeout() -> void:
	if not _advance_hold_active:
		return
	_fast_advance_step()


func _fast_advance_step() -> void:
	if _dialogue_ending or choice_container.get_child_count() > 0:
		_stop_fast_advance()
		return
	if _is_typing:
		_show_full_text_immediately()
		return
	_cancel_auto_advance()
	if _line_queue.is_empty():
		_stop_fast_advance()
		return
	_show_next_line()


func _stop_fast_advance() -> void:
	_advance_hold_active = false
	if _advance_hold_timer != null and not _advance_hold_timer.is_stopped():
		_advance_hold_timer.stop()
	if _advance_repeat_timer != null and not _advance_repeat_timer.is_stopped():
		_advance_repeat_timer.stop()
	_refresh_advance_button_label()


func _refresh_advance_button_label() -> void:
	if advance_button == null:
		return
	if _dialogue_ending:
		advance_button.text = "終了"
		return
	if _advance_hold_active:
		advance_button.text = "早送り中"
		return
	if choice_container != null and choice_container.get_child_count() > 0:
		advance_button.text = "選択"
		return
	if _is_typing:
		advance_button.text = "早送り"
		return
	advance_button.text = "次へ"


func _on_advance_button_pressed() -> void:
	if _dialogue_ending:
		return
	if _ignore_advance_press_once:
		_ignore_advance_press_once = false
		return
	GameManager.play_ui_se("cursor")
	if _is_typing:
		_show_full_text_immediately()
		return
	if choice_container.get_child_count() > 0:
		return
	_cancel_auto_advance()
	_show_next_line()


func _show_next_line() -> void:
	_cancel_auto_advance()
	if _line_queue.is_empty():
		_finish_dialogue()
		return

	var line: Dictionary = _line_queue.pop_front()
	
	# Condition check
	if str(line.get("type", "")) == "condition":
		var cond_type = str(line.get("condition_type", "stat"))
		var threshold = int(line.get("threshold", 0))
		var val = 0
		if cond_type == "stat":
			var stat = str(line.get("stat", ""))
			if stat != "":
				val = PlayerData.get_stat(stat)
		elif cond_type == "romance_count":
			val = AffinityManager.get_romance_count()
		elif cond_type == "has_romance":
			var char_id = str(line.get("char_id", ""))
			val = 1 if AffinityManager.is_in_romance(char_id) else 0
			threshold = 1
		elif cond_type == "has_romance_and_max_affection":
			var char_id = str(line.get("char_id", ""))
			val = 1 if (AffinityManager.is_in_romance(char_id) and AffinityManager.is_max_affection(char_id)) else 0
			threshold = 1
		
		var branch_key = ""
		if val >= threshold:
			branch_key = str(line.get("next_true", ""))
		else:
			branch_key = str(line.get("next_false", ""))
			
		if branch_key != "" and _branches.has(branch_key):
			var branch_lines: Array = _branches[branch_key]
			for i in range(branch_lines.size() - 1, -1, -1):
				_line_queue.push_front(branch_lines[i])
		
		# Immediately show next line after branching
		_show_next_line()
		return
	elif str(line.get("type", "")) == "jump":
		var next_id = str(line.get("next_id", ""))
		if typeof(_loaded_dialogue_root) == TYPE_DICTIONARY:
			var target_dialogue = _find_dialogue(_loaded_dialogue_root, next_id)
			if not target_dialogue.is_empty():
				_line_queue.clear()
				for item in target_dialogue.get("lines", []):
					_line_queue.push_back(item)
				_show_next_line()
				return
	
	elif str(line.get("type", "")) == "set_flag":
		var flag = str(line.get("flag", ""))
		if flag != "":
			EventFlags.set_flag(flag)
		
		# Immediately show next line after setting flag
		_show_next_line()
		return

	if str(line.get("type", "")) == "choice":
		_show_choices(line.get("choices", []))
		return

	_clear_choices()
	
	await _handle_cg_command(line)
	
	_current_speaker = str(line.get("speaker", ""))
	if _current_speaker in ["naru", "adam", "minto", "tsumugi", "ageha", "pakki"] and not EventFlags.get_flag("known_name_" + _current_speaker):
		speaker_label.text = "？？？"
	else:
		speaker_label.text = SPEAKER_NAMES.get(_current_speaker, _current_speaker)
		
	# キャラ別テーマカラーを名前ラベルに反映
	var resolved_id = str(SPEAKER_ID_ALIASES.get(_current_speaker, _current_speaker))
	var speaker_color = GameManager.get_speaker_color(resolved_id)
	speaker_label.add_theme_color_override("font_color", speaker_color)

	_update_portrait(line)
	
	var raw_text = str(line.get("text", ""))
	var processed_text = _process_text(raw_text)
	var pages = _paginate_dialogue_text(processed_text)
	var display_text = pages[0] if not pages.is_empty() else ""
	if pages.size() > 1:
		var continuation_base = line.duplicate(true)
		continuation_base["skip_history"] = true
		for i in range(pages.size() - 1, 0, -1):
			var continuation_line = continuation_base.duplicate(true)
			continuation_line["text"] = pages[i]
			_line_queue.push_front(continuation_line)
	
	if raw_text != "" and not bool(line.get("skip_history", false)):
		var history_text = display_text if pages.size() <= 1 else "\n".join(pages)
		_history.append({"speaker": _current_speaker, "text": _strip_highlight_tags(history_text)})
	
	_start_typing(display_text)


func _process_text(text: String) -> String:
	if "{attendees}" in text:
		var attendees = []
		for char_id in ["naru", "adam", "minto", "tsumugi", "ageha"]:
			if AffinityManager.is_max_level(char_id):
				attendees.append(SPEAKER_NAMES.get(char_id, char_id))
		
		var attendees_str = ""
		if attendees.size() > 0:
			attendees_str = "、".join(attendees) + "……。\n今まで戦ってきた仲間たちと一緒に"
		else:
			attendees_str = "今まで戦ってきた日々を思い出しながら"
			
		text = text.replace("{attendees}", attendees_str)
	return text


func _paginate_dialogue_text(text: String) -> Array[String]:
	if text == "":
		return [""]
	var wrapped_text = _wrap_dialogue_text(text)
	var lines = wrapped_text.split("\n", true)
	if lines.size() <= DIALOGUE_MAX_LINES:
		return [wrapped_text]
	var pages: Array[String] = []
	var current_lines: Array[String] = []
	for line in lines:
		current_lines.append(line)
		if current_lines.size() == DIALOGUE_MAX_LINES:
			pages.append("\n".join(current_lines))
			current_lines.clear()
	if not current_lines.is_empty():
		pages.append("\n".join(current_lines))
	return pages


func _wrap_dialogue_text(text: String) -> String:
	var plain_text = _strip_highlight_tags(text)
	var wrapped_plain_text = GameManager.format_story_text(plain_text, DIALOGUE_WRAP_CHARS)
	if wrapped_plain_text == plain_text:
		return text
	return _apply_wrap_to_tagged_text(text, wrapped_plain_text)


func _apply_wrap_to_tagged_text(source_text: String, wrapped_plain_text: String) -> String:
	var line_lengths: Array[int] = []
	for line in wrapped_plain_text.split("\n", true):
		line_lengths.append(line.length())
	if line_lengths.size() <= 1:
		return source_text

	var output = ""
	var source_index = 0
	var visible_count = 0
	var line_index = 0
	while source_index < source_text.length():
		while line_index < line_lengths.size() - 1 and visible_count >= line_lengths[line_index]:
			output += "\n"
			line_index += 1
			visible_count = 0
		if source_text.substr(source_index, 1) == "[":
			var close_index = source_text.find("]", source_index)
			if close_index != -1:
				output += source_text.substr(source_index, close_index - source_index + 1)
				source_index = close_index + 1
				continue
		var current_char = source_text.substr(source_index, 1)
		output += current_char
		source_index += 1
		if current_char == "\n":
			line_index += 1
			visible_count = 0
		else:
			visible_count += 1
	return output

func _start_typing(text: String) -> void:
	_full_text = _strip_highlight_tags(text)
	_full_text_bbcode = _build_highlighted_text(text)
	_current_char = 0
	text_label.text = _full_text_bbcode
	text_label.visible_characters = 0
	_is_typing = true
	advance_button.disabled = false
	_refresh_advance_button_label()
	if _full_text.is_empty():
		_show_full_text_immediately()
		return

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
	text_label.visible_characters = _current_char


func _show_full_text_immediately() -> void:
	_is_typing = false
	typing_timer.stop()
	text_label.text = _full_text_bbcode
	text_label.visible_characters = -1
	_refresh_advance_button_label()
	_queue_auto_advance()


func _show_choices(choices: Array) -> void:
	_stop_fast_advance()
	_clear_choices()
	_cancel_auto_advance()
	advance_button.disabled = true
	_refresh_advance_button_label()

	for choice in choices:
		var c_type = str(choice.get("condition_type", ""))
		if c_type == "has_romance":
			if not AffinityManager.is_in_romance(str(choice.get("char_id", ""))):
				continue
				
		var button = Button.new()
		button.text = str(choice.get("text", "選択肢"))
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.custom_minimum_size = Vector2(0, 52)
		button.add_theme_font_size_override("font_size", 24)
		# ペルソナ風スタイリング: アンバーゴールドアクセント
		var normal_style = StyleBoxFlat.new()
		normal_style.bg_color = Color("3a4466", 0.92)
		normal_style.border_color = Color("feae34", 0.4)
		normal_style.border_width_left = 3
		normal_style.border_width_bottom = 1
		normal_style.border_width_right = 1
		normal_style.border_width_top = 1
		normal_style.corner_radius_bottom_left = 2
		normal_style.corner_radius_bottom_right = 6
		normal_style.corner_radius_top_left = 6
		normal_style.corner_radius_top_right = 2
		normal_style.content_margin_left = 20
		normal_style.content_margin_right = 16
		normal_style.content_margin_top = 10
		normal_style.content_margin_bottom = 10
		button.add_theme_stylebox_override("normal", normal_style)
		var hover_style = normal_style.duplicate()
		hover_style.bg_color = Color("3a4466").lightened(0.15)
		hover_style.border_color = Color("feae34", 0.85)
		hover_style.border_width_left = 4
		button.add_theme_stylebox_override("hover", hover_style)
		button.add_theme_color_override("font_hover_color", Color("feae34"))
		var pressed_style = normal_style.duplicate()
		pressed_style.bg_color = Color("feae34").darkened(0.4)
		pressed_style.border_color = Color("feae34")
		pressed_style.border_width_left = 4
		button.add_theme_stylebox_override("pressed", pressed_style)
		button.pressed.connect(_on_choice_selected.bind(str(choice.get("next", ""))))
		choice_container.add_child(button)


func _on_choice_selected(branch_key: String) -> void:
	GameManager.play_ui_se("confirm")
	_clear_choices()
	advance_button.disabled = false
	_refresh_advance_button_label()
	if _branches.has(branch_key):
		var branch_lines: Array = _branches[branch_key]
		for i in range(branch_lines.size() - 1, -1, -1):
			_line_queue.push_front(branch_lines[i])
	_show_next_line()


func _clear_choices() -> void:
	for child in choice_container.get_children():
		child.queue_free()


func _on_auto_button_pressed() -> void:
	GameManager.play_ui_se("cursor")
	_set_auto_enabled(not _auto_enabled)
	if _auto_enabled:
		_queue_auto_advance()
	else:
		_cancel_auto_advance()


func _on_auto_timer_timeout() -> void:
	if not _auto_enabled:
		return
	if _is_typing:
		return
	if choice_container.get_child_count() > 0:
		return
	_show_next_line()


func _set_auto_enabled(enabled: bool) -> void:
	_auto_enabled = enabled
	if auto_button == null:
		return
	auto_button.text = "オート ON" if _auto_enabled else "オート OFF"

func _on_log_button_pressed() -> void:
	GameManager.play_ui_se("select")
	_stop_fast_advance()
	_cancel_auto_advance()
	for child in history_vbox.get_children():
		child.queue_free()
	
	for entry in _history:
		var name_label = Label.new()
		var resolved_id = str(SPEAKER_ID_ALIASES.get(entry["speaker"], entry["speaker"]))
		name_label.text = SPEAKER_NAMES.get(entry["speaker"], entry["speaker"]) if str(entry["speaker"]) != "" else ""
		if name_label.text == "": name_label.text = "――"
		name_label.add_theme_color_override("font_color", GameManager.get_speaker_color(resolved_id))
		name_label.add_theme_font_size_override("font_size", 20)

		var txt_label = Label.new()
		txt_label.text = entry["text"]
		txt_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		txt_label.add_theme_font_size_override("font_size", 20)
		
		var entry_box = VBoxContainer.new()
		entry_box.add_theme_constant_override("separation", 2)
		entry_box.add_child(name_label)
		entry_box.add_child(txt_label)
		history_vbox.add_child(entry_box)
		
	history_panel.visible = true

func _on_close_history_pressed() -> void:
	GameManager.play_ui_se("cancel")
	history_panel.visible = false


func _queue_auto_advance() -> void:
	if not _auto_enabled:
		return
	if _is_typing:
		return
	if choice_container.get_child_count() > 0:
		return
	if _line_queue.is_empty():
		return
	var wait_time = clampf(0.9 + float(_full_text.length()) * 0.035, 1.0, 3.2)
	auto_timer.wait_time = wait_time
	auto_timer.start()


func _cancel_auto_advance() -> void:
	if auto_timer == null:
		return
	if auto_timer.is_stopped():
		return
	auto_timer.stop()


func _strip_highlight_tags(text: String) -> String:
	var output = text
	for tag in HIGHLIGHT_TAGS:
		output = output.replace(tag, "")
	return output


func _build_highlighted_text(text: String) -> String:
	var output = text
	var placeholders: Dictionary = {}
	var token_index = 0
	for open_tag in HIGHLIGHT_OPEN_REPLACEMENTS.keys():
		var open_token = "__HIGHLIGHT_OPEN_%d__" % token_index
		token_index += 1
		placeholders[open_token] = str(HIGHLIGHT_OPEN_REPLACEMENTS[open_tag])
		output = output.replace(open_tag, open_token)
	for close_tag in HIGHLIGHT_CLOSE_REPLACEMENTS.keys():
		var close_token = "__HIGHLIGHT_CLOSE_%d__" % token_index
		token_index += 1
		placeholders[close_token] = str(HIGHLIGHT_CLOSE_REPLACEMENTS[close_tag])
		output = output.replace(close_tag, close_token)
	output = output.replace("[", "[lb]")
	output = output.replace("]", "[rb]")
	for token in placeholders.keys():
		output = output.replace(str(token), str(placeholders[token]))
	return output


func _update_portrait(line: Dictionary) -> void:
	var speaker = str(line.get("speaker", ""))
	if speaker == "":
		portrait_rect.visible = false
		portrait_rect.texture = null
		return
	speaker = str(SPEAKER_ID_ALIASES.get(speaker, speaker))

	var face = str(line.get("face", "normal"))
	var path = "res://assets/sprites/characters/%s/chr_%s_%s.png" % [speaker, speaker, face]
	if not ResourceLoader.exists(path):
		path = "res://assets/sprites/characters/%s/chr_%s_normal.png" % [speaker, speaker]
	if not ResourceLoader.exists(path):
		portrait_rect.visible = false
		portrait_rect.texture = null
		return

	var texture = _get_portrait_texture(path)
	if texture == null:
		portrait_rect.visible = false
		portrait_rect.texture = null
		return

	portrait_rect.texture = texture
	portrait_rect.visible = true


func _get_portrait_union_rect(speaker: String) -> Rect2i:
	if _portrait_union_rect_cache.has(speaker):
		return _portrait_union_rect_cache[speaker]

	# 全表情の used_rect の和集合を計算して、表情切替時のサイズ変動を防ぐ
	var faces := ["normal", "smile", "serious", "sad", "surprise", "shy", "focus",
		"smug", "wink", "evil", "excited", "thinking", "fired_up", "intense",
		"silent", "angry", "smoke", "cry", "grin", "shout",
		"ura_normal", "ura_smile", "ura_serious", "ura_sad", "ura_surprise"]
	var union := Rect2i()
	var found := false
	for face in faces:
		var p := "res://assets/sprites/characters/%s/chr_%s_%s.png" % [speaker, speaker, face]
		if not ResourceLoader.exists(p):
			continue
		var tex = load(p)
		if tex == null or not tex is Texture2D:
			continue
		var img: Image = tex.get_image()
		if img == null or img.is_empty():
			continue
		var r: Rect2i = img.get_used_rect()
		if r.size.x <= 0 or r.size.y <= 0:
			continue
		if not found:
			union = r
			found = true
		else:
			union = union.merge(r)

	_portrait_union_rect_cache[speaker] = union
	return union


func _get_portrait_texture(path: String) -> Texture2D:
	if _portrait_texture_cache.has(path):
		return _portrait_texture_cache[path]

	var source = load(path)
	if source == null or not source is Texture2D:
		return null

	var texture: Texture2D = source
	var image: Image = texture.get_image()
	if image == null or image.is_empty():
		_portrait_texture_cache[path] = texture
		return texture

	# パスから speaker を抽出して union rect を取得
	var parts := path.get_file().trim_suffix(".png").split("_")
	var speaker := parts[1] if parts.size() >= 3 else ""
	var union_rect := _get_portrait_union_rect(speaker)

	var used_rect: Rect2i
	if union_rect.size.x > 0 and union_rect.size.y > 0:
		used_rect = union_rect
	else:
		used_rect = image.get_used_rect()

	if used_rect.size.x <= 0 or used_rect.size.y <= 0:
		_portrait_texture_cache[path] = texture
		return texture

	var crop_left: int = maxi(used_rect.position.x - PORTRAIT_CROP_PADDING, 0)
	var crop_top: int = maxi(used_rect.position.y - PORTRAIT_CROP_PADDING, 0)
	var crop_right: int = mini(used_rect.end.x + PORTRAIT_CROP_PADDING, image.get_width())
	var bottom_trim = mini(int(float(used_rect.size.y) * PORTRAIT_BOTTOM_TRIM_RATIO), PORTRAIT_BOTTOM_TRIM_MAX)
	var min_visible_height = int(float(used_rect.size.y) * PORTRAIT_MIN_VISIBLE_RATIO)
	var trimmed_bottom = used_rect.end.y - bottom_trim
	var visible_bottom = maxi(trimmed_bottom, used_rect.position.y + min_visible_height)
	var crop_bottom: int = mini(visible_bottom + PORTRAIT_CROP_PADDING, image.get_height())
	var crop_rect := Rect2i(crop_left, crop_top, crop_right - crop_left, crop_bottom - crop_top)
	if crop_rect.position == Vector2i.ZERO and crop_rect.size == image.get_size():
		_portrait_texture_cache[path] = texture
		return texture

	var cropped_image: Image = image.get_region(crop_rect)
	var cropped_texture := ImageTexture.create_from_image(cropped_image)
	_portrait_texture_cache[path] = cropped_texture
	return cropped_texture


func _handle_cg_command(line: Dictionary) -> void:
	if not cg_rect:
		return
	var type = str(line.get("type", ""))
	if type == "show_cg":
		var cg_id = str(line.get("cg_id", ""))
		if cg_id != "":
			var path = "res://assets/cgs/%s.png" % cg_id
			if ResourceLoader.exists(path):
				var tex = load(path)
				if tex:
					cg_rect.texture = tex
					cg_rect.visible = true
					SystemData.unlock_cg(cg_id)
					
					var tween = create_tween()
					tween.tween_property(cg_rect, "modulate:a", 1.0, 1.0)
					
					# Pause dialogue while fading
					typing_timer.stop()
					_cancel_auto_advance()
					advance_button.disabled = true
					await tween.finished
					advance_button.disabled = false
					_start_typing(str(line.get("text", "")))
					return
	elif type == "hide_cg":
		if cg_rect.visible:
			var tween = create_tween()
			tween.tween_property(cg_rect, "modulate:a", 0.0, 1.0)
			
			typing_timer.stop()
			_cancel_auto_advance()
			advance_button.disabled = true
			await tween.finished
			cg_rect.visible = false
			cg_rect.texture = null
			advance_button.disabled = false
			_start_typing(str(line.get("text", "")))
			return


func _finish_dialogue() -> void:
	if _dialogue_ending:
		return
	_dialogue_ending = true
	advance_button.disabled = true
	_stop_fast_advance()
	_cancel_auto_advance()
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
	if _metadata.has("exchange_lime"):
		AffinityManager.exchange_lime(str(_metadata["exchange_lime"]))

	var stat_changes: Array[Dictionary] = []
	if _metadata.has("add_stat"):
		var stats = _metadata["add_stat"]
		if typeof(stats) == TYPE_DICTIONARY:
			for stat_name in stats:
				var amount = int(stats[stat_name])
				if amount != 0:
					PlayerData.add_stat(str(stat_name), amount)
					GameManager.log_stat_change(str(stat_name), amount)
					var label = PlayerData.STAT_LABEL_MAP.get(str(stat_name), str(stat_name))
					stat_changes.append({"label": label, "amount": amount})

	# Show stat change notification (abstract expression, no numbers)
	if not stat_changes.is_empty():
		await _show_stat_notification(stat_changes)

	# Track affinity changes for notification
	var affinity_char_id := ""
	var affinity_delta := 0
	if _metadata.has("add_affinity"):
		var aff = _metadata["add_affinity"]
		if typeof(aff) == TYPE_DICTIONARY:
			for char_id in aff:
				var id = str(char_id)
				AffinityManager.set_met(id)
				var before = AffinityManager.get_affinity(id)
				var after = AffinityManager.add_affinity(id, int(aff[char_id]))
				if after >= 0:
					affinity_char_id = id
					affinity_delta = maxi(0, after - before)
	if _metadata.has("add_intel"):
		var intels = _metadata["add_intel"]
		if typeof(intels) == TYPE_ARRAY:
			for entry in intels:
				RivalIntel.add_intel(str(entry.get("id", "")), str(entry.get("key", "")), str(entry.get("value", "")))

	if dialogue_id == "ch1_opening":
		EventFlags.set_flag("ch1_sumi_tournament_talk", true)
		EventFlags.set_flag("ch1_forced_opening_done", true)

	# Show affinity notification before transitioning
	if affinity_char_id != "":
		await _show_affinity_notification(affinity_char_id, affinity_delta)

	if dialogue_id == "ch1_opening" and not EventFlags.get_flag("ch1_opening_tutorial_done"):
		var resume_scene = next_scene_path if next_scene_path != "" else "res://scenes/daily/map.tscn"
		GameManager.set_transient("post_tutorial_next_scene", resume_scene)
		get_tree().change_scene_to_file("res://scenes/daily/practice.tscn")
		return

	if next_scene_path != "":
		get_tree().change_scene_to_file(next_scene_path)
		return

	get_tree().change_scene_to_file("res://scenes/daily/map.tscn")


func _create_notification_card(layer: CanvasLayer, title: String, message: String, accent_color: Color, message_color: Color) -> Control:
	var card_root = Control.new()
	card_root.position = NOTIFICATION_BASE_POSITION
	card_root.size = NOTIFICATION_CARD_SIZE
	card_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	card_root.modulate = Color(1, 1, 1, 0)
	layer.add_child(card_root)

	var shadow = Panel.new()
	shadow.position = Vector2(8, 10)
	shadow.size = NOTIFICATION_CARD_SIZE
	shadow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var shadow_style = StyleBoxFlat.new()
	shadow_style.bg_color = Color(0, 0, 0, 0.30)
	shadow_style.corner_radius_top_left = 16
	shadow_style.corner_radius_top_right = 16
	shadow_style.corner_radius_bottom_left = 16
	shadow_style.corner_radius_bottom_right = 16
	shadow.add_theme_stylebox_override("panel", shadow_style)
	card_root.add_child(shadow)

	var panel = PanelContainer.new()
	panel.size = NOTIFICATION_CARD_SIZE
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var panel_style = StyleBoxFlat.new()
	panel_style.bg_color = Color(0.05, 0.06, 0.11, 0.92)
	panel_style.border_color = accent_color.lightened(0.12)
	panel_style.border_width_left = 9
	panel_style.border_width_top = 2
	panel_style.border_width_right = 2
	panel_style.border_width_bottom = 2
	panel_style.corner_radius_top_left = 16
	panel_style.corner_radius_top_right = 16
	panel_style.corner_radius_bottom_left = 16
	panel_style.corner_radius_bottom_right = 16
	panel_style.content_margin_left = 24
	panel_style.content_margin_right = 22
	panel_style.content_margin_top = 14
	panel_style.content_margin_bottom = 14
	panel.add_theme_stylebox_override("panel", panel_style)
	card_root.add_child(panel)

	var content = VBoxContainer.new()
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content.size_flags_vertical = Control.SIZE_EXPAND_FILL
	content.alignment = BoxContainer.ALIGNMENT_CENTER
	content.add_theme_constant_override("separation", 2)
	panel.add_child(content)

	var title_label = Label.new()
	title_label.text = title
	title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	title_label.add_theme_font_size_override("font_size", 18)
	title_label.add_theme_color_override("font_color", accent_color.lightened(0.18))
	title_label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.92))
	title_label.add_theme_constant_override("outline_size", 4)
	content.add_child(title_label)

	var message_label = Label.new()
	message_label.text = message
	message_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	message_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	message_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	message_label.custom_minimum_size = Vector2(0, 54)
	message_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	message_label.add_theme_font_size_override("font_size", 28)
	message_label.add_theme_color_override("font_color", message_color)
	message_label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.95))
	message_label.add_theme_constant_override("outline_size", 8)
	content.add_child(message_label)

	return card_root


func _show_affinity_notification(char_id: String, _delta: int) -> void:
	var layer = CanvasLayer.new()
	layer.layer = 100
	add_child(layer)

	var char_name = SPEAKER_NAMES.get(char_id, char_id)
	var star_text = AffinityManager.get_star_text(char_id)
	var notif_color = GameManager.get_speaker_accent_color(char_id)
	var card = _create_notification_card(
		layer,
		"絆の変化",
		"♡ %sとの絆が深まった  %s" % [char_name, star_text],
		notif_color,
		Color("fff1db")
	)

	# Sparkle particles
	var particles = GPUParticles2D.new()
	var mat = ParticleProcessMaterial.new()
	mat.direction = Vector3(0, -1, 0)
	mat.spread = 180.0
	mat.initial_velocity_min = 15.0
	mat.initial_velocity_max = 50.0
	mat.gravity = Vector3(0, 15, 0)
	mat.lifetime_randomness = 0.3

	var scale_curve = CurveTexture.new()
	var sc = Curve.new()
	sc.add_point(Vector2(0, 0.6))
	sc.add_point(Vector2(0.4, 1.0))
	sc.add_point(Vector2(1, 0))
	scale_curve.curve = sc
	mat.scale_curve = scale_curve

	var alpha_curve = CurveTexture.new()
	var ac = Curve.new()
	ac.add_point(Vector2(0, 0))
	ac.add_point(Vector2(0.15, 1))
	ac.add_point(Vector2(0.6, 0.7))
	ac.add_point(Vector2(1, 0))
	alpha_curve.curve = ac
	mat.alpha_curve = alpha_curve

	mat.color = Color(1.0, 0.85, 0.3, 0.9)
	particles.process_material = mat
	particles.amount = 14
	particles.lifetime = 1.0
	particles.one_shot = true
	particles.position = NOTIFICATION_BASE_POSITION + Vector2(NOTIFICATION_CARD_SIZE.x * 0.5, 64)

	# Procedural circle texture for sparkles
	var img = Image.create(8, 8, false, Image.FORMAT_RGBA8)
	var center = Vector2(4, 4)
	for x in range(8):
		for y in range(8):
			var dist = Vector2(x, y).distance_to(center)
			if dist < 4.0:
				var alpha = clampf(1.0 - (dist / 4.0), 0, 1)
				img.set_pixel(x, y, Color(1, 1, 1, alpha))
			else:
				img.set_pixel(x, y, Color(0, 0, 0, 0))
	particles.texture = ImageTexture.create_from_image(img)
	layer.add_child(particles)
	particles.emitting = true

	var tween = create_tween()
	tween.set_parallel(true)
	tween.tween_property(card, "modulate:a", 1.0, 0.26).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tween.tween_property(card, "position:y", NOTIFICATION_BASE_POSITION.y - 18.0, 0.34).from(NOTIFICATION_BASE_POSITION.y + 12.0).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	await tween.finished

	await get_tree().create_timer(1.2).timeout

	var fade_tween = create_tween()
	fade_tween.set_parallel(true)
	fade_tween.tween_property(card, "modulate:a", 0.0, 0.38)
	fade_tween.tween_property(card, "position:y", NOTIFICATION_BASE_POSITION.y - 30.0, 0.38)
	await fade_tween.finished

	layer.queue_free()


func _show_stat_notification(stat_changes: Array[Dictionary]) -> void:
	# Build notification text using abstract expressions (no raw numbers)
	var parts: Array[String] = []
	for change in stat_changes:
		var change_label = PlayerData.get_stat_change_label(change["amount"])
		if change_label != "":
			parts.append("【%s】が%s" % [change["label"], change_label])
	if parts.is_empty():
		return
	var text = "……" + "、".join(parts) + "。"

	var layer = CanvasLayer.new()
	layer.layer = 100
	add_child(layer)

	var card = _create_notification_card(
		layer,
		"腕前の変化",
		text,
		Color("55d4ff"),
		Color("eaf8ff")
	)

	var tween = create_tween()
	tween.set_parallel(true)
	tween.tween_property(card, "modulate:a", 1.0, 0.26).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tween.tween_property(card, "position:y", NOTIFICATION_BASE_POSITION.y - 18.0, 0.34).from(NOTIFICATION_BASE_POSITION.y + 12.0).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	await tween.finished

	await get_tree().create_timer(1.5).timeout

	var fade_tween = create_tween()
	fade_tween.set_parallel(true)
	fade_tween.tween_property(card, "modulate:a", 0.0, 0.38)
	fade_tween.tween_property(card, "position:y", NOTIFICATION_BASE_POSITION.y - 30.0, 0.38)
	await fade_tween.finished

	layer.queue_free()
