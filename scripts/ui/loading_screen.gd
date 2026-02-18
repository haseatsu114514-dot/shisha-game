extends Control

@onready var tip_label: RichTextLabel = %TipLabel
@onready var timer: Timer = %Timer


func _ready() -> void:
	timer.timeout.connect(_on_timer_timeout)
	tip_label.text = _pick_tip_text()
	timer.start()


func _pick_tip_text() -> String:
	if not FileAccess.file_exists("res://data/tips.json"):
		return "Tip: 大会までの行動配分を意識しよう。"
	var file := FileAccess.open("res://data/tips.json", FileAccess.READ)
	if file == null:
		return "Tip: こまめにセーブしよう。"
	var parsed := JSON.parse_string(file.get_as_text())
	file.close()
	if typeof(parsed) != TYPE_DICTIONARY:
		return "Tip: 洞察は会話の強みになる。"
	var tips: Array = parsed.get("tips", [])
	if tips.is_empty():
		return "Tip: ライバル情報を集めると有利。"
	return "Tip: %s" % str(tips[randi() % tips.size()])


func _on_timer_timeout() -> void:
	var target := str(GameManager.pop_transient("loading_target_scene", "res://scenes/title/title_screen.tscn"))
	get_tree().change_scene_to_file(target)
