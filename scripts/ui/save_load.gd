extends Control

@onready var mode_label: Label = %ModeLabel
@onready var info_label: Label = %InfoLabel
@onready var slot_container: VBoxContainer = %SlotContainer

var _mode = "load"


func _ready() -> void:
	_mode = str(GameManager.pop_transient("save_load_mode", "load"))
	mode_label.text = "セーブ" if _mode == "save" else "ロード"
	_refresh_slots()


func _refresh_slots() -> void:
	for child in slot_container.get_children():
		child.queue_free()

	for slot in [1, 2, 3]:
		var button = Button.new()
		var path = "user://save_slot_%d.json" % slot
		var exists = FileAccess.file_exists(path)
		var state = "データあり" if exists else "空"
		button.text = "Slot %d (%s)" % [slot, state]
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.pressed.connect(_on_slot_pressed.bind(slot))
		slot_container.add_child(button)


func _on_slot_pressed(slot: int) -> void:
	if _mode == "save":
		if GameManager.save_game(slot):
			info_label.text = "Slot %d に保存しました。" % slot
		else:
			info_label.text = "保存に失敗しました。"
		_refresh_slots()
		return

	if not GameManager.load_game(slot):
		info_label.text = "ロードに失敗しました。"
		return

	var next_scene = "res://scenes/daily/map.tscn"
	if CalendarManager.current_time == "morning":
		next_scene = "res://scenes/daily/morning_phone.tscn"
	elif CalendarManager.current_time == "midnight":
		next_scene = "res://scenes/daily/night_end.tscn"

	GameManager.set_transient("loading_target_scene", next_scene)
	get_tree().change_scene_to_file("res://scenes/ui/loading_screen.tscn")


func _on_back_button_pressed() -> void:
	var return_scene = str(GameManager.pop_transient("return_scene", "res://scenes/title/title_screen.tscn"))
	get_tree().change_scene_to_file(return_scene)
