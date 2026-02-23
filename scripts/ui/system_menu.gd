extends Control

# System Menu Controller
# Manages character affinities, player stats, and inventory display.

onready var affinity_list = $TabContainer/Affinity/ScrollContainer/VBoxContainer
onready var stats_label = $TabContainer/Stats/Label

func _ready():
	update_menu()

func update_menu():
	update_affinity_list()
	update_player_stats()

func update_affinity_list():
	for child in affinity_list.get_children():
		child.queue_free()
	
	var characters = CharacterManager.get_all_characters()
	for char_id in characters:
		if char_id == "hajime": continue
		
		var char_data = characters[char_id]
		var affinity_score = AffinityManager.get_affinity(char_id)
		
		var h_box = HBoxContainer.new()
		var name_label = Label.new()
		name_label.text = char_data.name
		name_label.rect_min_size.x = 200
		
		var progress = ProgressBar.new()
		progress.max_value = 100
		progress.value = affinity_score
		progress.rect_min_size.x = 300
		
		h_box.add_child(name_label)
		h_box.add_child(progress)
		affinity_list.add_child(h_box)

func update_player_stats():
	var stats = PlayerData.get_stats()
	var text = "Level: %d\n" % PlayerData.level
	text += "Technique: %d\n" % stats.technique
	text += "Sense: %d\n" % stats.sense
	text += "Experience: %d" % PlayerData.exp
	stats_label.text = text

func _on_CloseButton_pressed():
	hide()
	get_tree().paused = false
