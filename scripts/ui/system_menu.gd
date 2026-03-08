extends CanvasLayer

@onready var close_button = %CloseButton
@onready var tab_container = %TabContainer
@onready var affinity_vbox = %AffinityVBox
@onready var status_grid = %StatusGrid
@onready var item_vbox = %ItemVBox
@onready var save_button = %SaveButton
@onready var load_button = %LoadButton
@onready var title_button = %TitleButton

const CHARACTERS = [
	{"id": "sumi", "name": "スミ"},
	{"id": "naru", "name": "なる", "condition": "ch1_naru_met"},
	{"id": "adam", "name": "アダム", "condition": "ch1_adam_met"},
	{"id": "minto", "name": "眠都", "condition": "ch1_minto_met"},
	{"id": "tsumugi", "name": "つむぎ", "condition": "ch1_tsumugi_met"},
]

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	get_tree().paused = true
	
	close_button.pressed.connect(close_menu)
	save_button.pressed.connect(_on_save_pressed)
	load_button.pressed.connect(_on_load_pressed)
	title_button.pressed.connect(_on_title_pressed)
	
	_populate_affinity()
	_populate_status()
	_populate_items()

func close_menu() -> void:
	GameManager.play_ui_se("cancel")
	get_tree().paused = false
	queue_free()

func _populate_affinity() -> void:
	for child in affinity_vbox.get_children():
		child.queue_free()
		
	var max_level = AffinityManager.get_max_level()
	
	for char_data in CHARACTERS:
		var char_id = char_data["id"]
		# Check condition if it has one
		if char_data.has("condition") and not EventFlags.get_flag(char_data["condition"]):
			continue
			
		var level = AffinityManager.get_affinity(char_id)
		var star_text = AffinityManager.get_star_text(char_id)
		
		# Name masking for unintroduced characters
		var display_name = char_data["name"]
		if char_id in ["naru", "adam", "minto", "tsumugi", "ageha"] and not EventFlags.get_flag("known_name_" + char_id):
			display_name = "？？？"
		
		# For maximum chapters limits formatting
		var display_text = "♡ %s  :  Lv.%d / %d  %s" % [display_name, level, max_level, star_text]
		
		var label = Label.new()
		label.text = display_text
		label.add_theme_font_size_override("font_size", 18)
		if level >= max_level:
			label.modulate = Color(1.0, 0.8, 0.4) # Gold finish
			
		affinity_vbox.add_child(label)

func _populate_status() -> void:
	for child in status_grid.get_children():
		child.queue_free()
		
	var stats = [
		{"key": "technique", "name": "技術"},
		{"key": "sense", "name": "センス"},
		{"key": "guts", "name": "根性"},
		{"key": "charm", "name": "魅力"},
		{"key": "insight", "name": "洞察"},
	]

	for stat in stats:
		var label_name = Label.new()
		label_name.text = stat["name"]
		label_name.add_theme_font_size_override("font_size", 16)
		status_grid.add_child(label_name)

		var stars = PlayerData.get_stat_stars(stat["key"])
		var label_val = Label.new()
		label_val.text = "★".repeat(stars) + "☆".repeat(5 - stars)
		label_val.add_theme_font_size_override("font_size", 16)
		label_val.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		label_val.add_theme_color_override("font_color", Color(1.0, 0.85, 0.3))
		status_grid.add_child(label_val)
		
	# Separator
	var sep = Control.new()
	sep.custom_minimum_size = Vector2(0, 16)
	status_grid.add_child(sep)
	var sep2 = Control.new()
	sep2.custom_minimum_size = Vector2(0, 16)
	status_grid.add_child(sep2)
	
	# Flavor specialties
	var spec_header = Label.new()
	spec_header.text = "【得意分野】"
	spec_header.add_theme_color_override("font_color", Color(0.6, 0.8, 1.0))
	status_grid.add_child(spec_header)
	status_grid.add_child(Control.new())
	
	var specialties = [
		{"key": "sweet", "name": "甘い (Sweet)"},
		{"key": "cooling", "name": "清涼感 (Cooling)"},
		{"key": "fruit", "name": "フルーツ (Fruit)"},
		{"key": "spice", "name": "スパイス (Spice)"},
		{"key": "floral", "name": "フローラル (Floral)"},
	]
	
	for spec in specialties:
		var label_name = Label.new()
		label_name.text = spec["name"]
		status_grid.add_child(label_name)

		var val = PlayerData.flavor_specialties.get(spec["key"], 10)
		var spec_stars = clampi(int(ceil(val / 20.0)), 1, 5)
		var label_val = Label.new()
		label_val.text = "★".repeat(spec_stars) + "☆".repeat(5 - spec_stars)
		label_val.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		label_val.add_theme_color_override("font_color", Color(0.6, 0.9, 0.6))
		status_grid.add_child(label_val)

func _populate_items() -> void:
	for child in item_vbox.get_children():
		child.queue_free()
		
	# Money
	var money_label = Label.new()
	money_label.text = "所持金: %d 円" % PlayerData.money
	money_label.add_theme_color_override("font_color", Color(1.0, 0.9, 0.4))
	money_label.add_theme_font_size_override("font_size", 18)
	item_vbox.add_child(money_label)
	
	var sep1 = HSeparator.new()
	item_vbox.add_child(sep1)
	
	# Current equipment
	var equip_title = Label.new()
	equip_title.text = "【現在の装備】"
	equip_title.add_theme_color_override("font_color", Color(0.6, 0.8, 1.0))
	item_vbox.add_child(equip_title)
	
	var eq_bowl = Label.new()
	eq_bowl.text = "ボウル: " + PlayerData.get_equipped_item_name("bowl")
	item_vbox.add_child(eq_bowl)
	var eq_hms = Label.new()
	eq_hms.text = "HMS: " + PlayerData.get_equipped_item_name("hms")
	item_vbox.add_child(eq_hms)
	var eq_charcoal = Label.new()
	eq_charcoal.text = "炭: " + PlayerData.get_equipped_item_name("charcoal")
	item_vbox.add_child(eq_charcoal)
	
	var sep2 = HSeparator.new()
	item_vbox.add_child(sep2)
	
	# Inventory items
	var inv_title = Label.new()
	inv_title.text = "【所持フレーバー】"
	inv_title.add_theme_color_override("font_color", Color(0.6, 0.8, 1.0))
	item_vbox.add_child(inv_title)
	
	if PlayerData.flavor_inventory.is_empty():
		var empty = Label.new()
		empty.text = "（フレーバーは持っていません）"
		item_vbox.add_child(empty)
	else:
		for f_id in PlayerData.flavor_inventory:
			var label = Label.new()
			label.text = "・" + PlayerData.get_flavor_name(f_id)
			item_vbox.add_child(label)

func _on_save_pressed() -> void:
	GameManager.play_ui_se("confirm")
	GameManager.force_save()
	
	var old_text = save_button.text
	save_button.text = "セーブ完了！"
	save_button.disabled = true
	await get_tree().create_timer(1.0).timeout
	if is_instance_valid(save_button):
		save_button.text = old_text
		save_button.disabled = false

func _on_load_pressed() -> void:
	GameManager.play_ui_se("confirm")
	get_tree().paused = false
	GameManager.do_load()
	queue_free()

func _on_title_pressed() -> void:
	GameManager.play_ui_se("cancel")
	get_tree().paused = false
	get_tree().change_scene_to_file("res://scenes/title.tscn")
	queue_free()
