extends Control

@onready var pipe_option: OptionButton = %PipeOption
@onready var bowl_option: OptionButton = %BowlOption
@onready var hms_option: OptionButton = %HMSOption
@onready var info_label: RichTextLabel = %InfoLabel
@onready var back_button: Button = $BackButton

var _pipe_list: Array[String] = []
var _bowl_list: Array[String] = []
var _hms_list: Array[String] = []

func _ready() -> void:
	back_button.pressed.connect(func():
		GameManager.play_ui_se("cancel")
		get_tree().change_scene_to_file("res://scenes/daily/map.tscn")
	)
	
	_setup_options()

func _setup_options() -> void:
	# Pipe
	pipe_option.clear()
	_pipe_list.clear()
	for p in PlayerData.owned_pipes:
		pipe_option.add_item(PlayerData.get_equipment_name_by_value(p))
		_pipe_list.append(p)
		if p == PlayerData.equipment_pipe:
			pipe_option.select(pipe_option.item_count - 1)
			
	# Bowl
	bowl_option.clear()
	_bowl_list.clear()
	for b in PlayerData.owned_bowls:
		bowl_option.add_item(PlayerData.get_equipment_name_by_value(b))
		_bowl_list.append(b)
		if b == PlayerData.equipment_bowl:
			bowl_option.select(bowl_option.item_count - 1)
			
	# HMS
	hms_option.clear()
	_hms_list.clear()
	for h in PlayerData.owned_hms:
		hms_option.add_item(PlayerData.get_equipment_name_by_value(h))
		_hms_list.append(h)
		if h == PlayerData.equipment_hms:
			hms_option.select(hms_option.item_count - 1)
			
	if not pipe_option.item_selected.is_connected(_on_pipe_selected):
		pipe_option.item_selected.connect(_on_pipe_selected)
		bowl_option.item_selected.connect(_on_bowl_selected)
		hms_option.item_selected.connect(_on_hms_selected)
	
	_update_info()

func _on_pipe_selected(idx: int) -> void:
	GameManager.play_ui_se("cursor")
	if idx >= 0 and idx < _pipe_list.size():
		PlayerData.equipment_pipe = _pipe_list[idx]
	_update_info()

func _on_bowl_selected(idx: int) -> void:
	GameManager.play_ui_se("cursor")
	if idx >= 0 and idx < _bowl_list.size():
		PlayerData.equipment_bowl = _bowl_list[idx]
		# Apply compat
		if not PlayerData.is_equipment_pair_compatible(PlayerData.equipment_bowl, PlayerData.equipment_hms):
			PlayerData.equipment_hms = PlayerData.DEFAULT_HMS
			GameManager.set_transient("toast_message", "ボウルとHMSの相性が悪いため、HMSをデフォルトに戻しました。")
			_setup_options() # reload
	_update_info()

func _on_hms_selected(idx: int) -> void:
	GameManager.play_ui_se("cursor")
	if idx >= 0 and idx < _hms_list.size():
		PlayerData.equipment_hms = _hms_list[idx]
		if not PlayerData.is_equipment_pair_compatible(PlayerData.equipment_bowl, PlayerData.equipment_hms):
			PlayerData.equipment_bowl = PlayerData.DEFAULT_BOWL
			GameManager.set_transient("toast_message", "ボウルとHMSの相性が悪いため、ボウルをデフォルトに戻しました。")
			_setup_options() # reload
	_update_info()

func _update_info() -> void:
	var pipe_name = PlayerData.get_equipped_item_name("pipe")
	var bowl_name = PlayerData.get_equipped_item_name("bowl")
	var hms_name = PlayerData.get_equipped_item_name("hms")
	
	var pipe_bonus = ""
	if PlayerData.PIPE_DATA.has(PlayerData.equipment_pipe):
		pipe_bonus = PlayerData.PIPE_DATA[PlayerData.equipment_pipe].get("description", "")
	
	info_label.text = "[b]現在のセッティング[/b]\n"
	info_label.text += "パイプ : %s\n" % pipe_name
	info_label.text += "ボウル : %s\n" % bowl_name
	info_label.text += "HMS : %s\n\n" % hms_name
	info_label.text += "[color=yellow]装備ボーナス:[/color]\n%s" % pipe_bonus
