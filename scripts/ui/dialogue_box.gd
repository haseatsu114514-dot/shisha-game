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

var _line_queue: Array = []
var _branches: Dictionary = {}
var _metadata: Dictionary = {}

var _is_typing = false
var _full_text = ""
var _full_text_bbcode = ""
var _current_char = 0
var _current_speaker = ""
var _auto_enabled = false

const SPEAKER_NAMES := {
	"hajime": "はじめ",
	"sumi": "スミさん",
	"naru": "なる",
	"adam": "アダム",
	"minto": "眠都",
	"tsumugi": "つむぎ",
	"tumugi": "つむぎ",
	"hazime": "はじめ",
	"packii": "パッキー",
	"salaryman": "サラリーマン",
	"toki_kotetsu": "土岐鋼鉄",
	"maezono": "前園壮一郎",
	"kirishima": "霧島レン",
	"takiguchi": "焚口ショウ",
	"staff_choizap": "チョイザップスタッフ"
}
const SPEAKER_ID_ALIASES := {
	"tumugi": "tsumugi",
	"hazime": "hajime",
}
const HIGHLIGHT_TAGS := [
	"[imp]", "[/imp]",
	"[warn]", "[/warn]",
	"[hint]", "[/hint]"
]
const HIGHLIGHT_OPEN_REPLACEMENTS := {
	"[imp]": "[font_size=42][color=#ffd878][b]",
	"[red]": "[color=#ff5252][b]",
	"[blue]": "[color=#52a2ff][b]",
	"[sub]": "[font_size=18][color=#999999]",
	"[warn]": "[color=#ff8b8b][b]",
	"[hint]": "[color=#8bdcff][b]",
}
const HIGHLIGHT_CLOSE_REPLACEMENTS := {
	"[/imp]": "[/b][/color][/font_size]",
	"[/warn]": "[/b][/color]",
	"[/hint]": "[/b][/color]",
}


func _ready() -> void:
	advance_button.pressed.connect(_on_advance_button_pressed)
	auto_button.pressed.connect(_on_auto_button_pressed)
	typing_timer.timeout.connect(_on_typing_timer_timeout)
	auto_timer.timeout.connect(_on_auto_timer_timeout)
	_set_auto_enabled(false)
	
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
	
	var metadata = target_dialogue.get("metadata", {})
	if metadata.has("bgm"):
		GameManager.play_bgm(str(metadata["bgm"]), -8.0, true)
	
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
		var stat = str(line.get("stat", ""))
		var threshold = int(line.get("threshold", 0))
		var val = 0
		if stat != "":
			val = PlayerData.get_stat(stat)
		
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

	if str(line.get("type", "")) == "choice":
		_show_choices(line.get("choices", []))
		return

	_clear_choices()
	
	_handle_cg_command(line)
	
	_current_speaker = str(line.get("speaker", ""))
	speaker_label.text = SPEAKER_NAMES.get(_current_speaker, _current_speaker)
	_update_portrait(line)
	_start_typing(str(line.get("text", "")))


func _start_typing(text: String) -> void:
	_full_text = _strip_highlight_tags(text)
	_full_text_bbcode = _build_highlighted_text(text)
	_current_char = 0
	text_label.text = ""
	_is_typing = true
	advance_button.disabled = false
	advance_button.text = "早送り"
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
	text_label.text = _full_text.substr(0, _current_char)


func _show_full_text_immediately() -> void:
	_is_typing = false
	typing_timer.stop()
	text_label.text = _full_text_bbcode
	advance_button.text = "次へ"
	_queue_auto_advance()


func _show_choices(choices: Array) -> void:
	_clear_choices()
	_cancel_auto_advance()
	advance_button.disabled = true
	advance_button.text = "選択"
	for choice in choices:
		var button = Button.new()
		button.text = str(choice.get("text", "選択肢"))
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.custom_minimum_size = Vector2(0, 48)
		button.add_theme_font_size_override("font_size", 24)
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
	auto_button.text = "オート: ON" if _auto_enabled else "オート: OFF"


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
			_start_typing(str(line.get("text", "")))
			return


func _finish_dialogue() -> void:
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

	# Track affinity changes for notification
	var affinity_char_id := ""
	var affinity_delta := 0
	if _metadata.has("add_affinity"):
		var aff = _metadata["add_affinity"]
		if typeof(aff) == TYPE_DICTIONARY:
			for char_id in aff:
				var id = str(char_id)
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


func _show_affinity_notification(char_id: String, delta: int) -> void:
	var layer = CanvasLayer.new()
	layer.layer = 100
	add_child(layer)

	# Label
	var label = Label.new()
	var char_name = SPEAKER_NAMES.get(char_id, char_id)
	var max_level = AffinityManager.get_max_level()
	var star_text = AffinityManager.get_star_text(char_id)
	if delta > 0:
		label.text = "♡ %s 好感度 +%d / %d  %s" % [char_name, delta, max_level, star_text]
	else:
		label.text = "♡ %s 好感度 %d / %d  %s" % [char_name, AffinityManager.get_affinity(char_id), max_level, star_text]
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.position = Vector2(290, 320)
	label.size = Vector2(700, 60)
	label.add_theme_font_size_override("font_size", 26)
	label.modulate = Color(1.0, 0.92, 0.75, 0)
	layer.add_child(label)

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
	particles.position = Vector2(640, 340)

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

	# Animate label: fade in, float up, hold, fade out
	var tween = create_tween()
	tween.set_parallel(true)
	tween.tween_property(label, "modulate:a", 1.0, 0.3).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tween.tween_property(label, "position:y", 290, 0.4).from(320.0).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	await tween.finished

	await get_tree().create_timer(1.2).timeout

	var fade_tween = create_tween()
	fade_tween.tween_property(label, "modulate:a", 0.0, 0.4)
	await fade_tween.finished

	layer.queue_free()
