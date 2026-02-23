extends Control

# Dialogue Box Controller
# Handles text display, character portraits, and choice selection.

signal dialogue_finished
signal choice_selected(index)

onready var text_label = $MarginContainer/VBoxContainer/TextLabel
onready var name_label = $NameBox/Label
onready var portrait_left = $Portraits/Left
onready var portrait_right = $Portraits/Right
onready var choice_container = $ChoiceContainer

var typing_speed = 0.03
var is_typing = false
var current_text = ""

func _ready():
	choice_container.hide()

func display_dialogue(character_id, text, side = "left"):
	var char_data = CharacterManager.get_character(character_id)
	name_label.text = char_data.name
	current_text = text
	
	# Update portrait
	var portrait = portrait_left if side == "left" else portrait_right
	# portrait.texture = load(char_data.portrait_path)
	
	start_typing()

func start_typing():
	text_label.text = ""
	is_typing = true
	for i in range(current_text.length()):
		if !is_typing: break
		text_label.text += current_text[i]
		yield(get_tree().create_timer(typing_speed), "timeout")
	is_typing = false

func finish_typing():
	is_typing = false
	text_label.text = current_text

func show_choices(choices):
	for child in choice_container.get_children():
		child.queue_free()
	
	for i in range(choices.size()):
		var btn = Button.new()
		btn.text = choices[i]
		btn.connect("pressed", self, "_on_choice_pressed", [i])
		choice_container.add_child(btn)
	
	choice_container.show()

func _on_choice_pressed(index):
	choice_container.hide()
	emit_signal("choice_selected", index)

func _input(event):
	if event.is_action_pressed("ui_accept"):
		if is_typing:
			finish_typing()
		else:
			emit_signal("dialogue_finished")
