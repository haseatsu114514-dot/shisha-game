extends Control

# LIME (In-game messenger) Screen Controller
# Handles displaying messages, contacts, and applying visual themes.

onready var chat_list = $VBoxContainer/ChatList
onready var message_log = $VBoxContainer/MessageLog
onready var contact_name_label = $Header/ContactName

var current_contact_id = ""
var messages_data = {}

func _ready():
	load_messages_data()
	refresh_contact_list()

func load_messages_data():
	var file = File.new()
	if file.file_exists("res://data/lime_messages.json"):
		file.open("res://data/lime_messages.json", File.READ)
		var json_result = JSON.parse(file.get_as_text())
		if json_result.error == OK:
			messages_data = json_result.result
		file.close()

func refresh_contact_list():
	for child in chat_list.get_children():
		child.queue_free()
	
	var characters = CharacterManager.get_all_characters()
	for char_id in characters:
		if char_id == "hajime": continue # Skip self
		
		var char_data = characters[char_id]
		var btn = Button.new()
		btn.text = char_data.name
		btn.connect("pressed", self, "_on_contact_selected", [char_id])
		chat_list.add_child(btn)

func _on_contact_selected(char_id):
	current_contact_id = char_id
	var char_data = CharacterManager.get_character(char_id)
	contact_name_label.text = char_data.name
	display_chat_log(char_id)
	
	# Apply theme based on character
	apply_theme(char_data.play_style)

func display_chat_log(char_id):
	for child in message_log.get_children():
		child.queue_free()
	
	if messages_data.has("chats"):
		for chat in messages_data.chats:
			if chat.sender == char_id:
				for msg in chat.messages:
					add_message_bubble(msg, false)

func add_message_bubble(text, is_self):
	var label = Label.new()
	label.text = text
	label.autowrap = true
	# In a real implementation, we'd use a themed PanelContainer here
	message_log.add_child(label)

func apply_theme(style):
	match style:
		"girly_visual":
			# Pink theme for Minto
			self.modulate = Color(1.0, 0.8, 0.9)
		"charisma_dark":
			# Dark/Purple theme for Rei
			self.modulate = Color(0.3, 0.1, 0.4)
		"outlaw_hard":
			# Gritty theme for Ryuji
			self.modulate = Color(0.4, 0.4, 0.4)
		_:
			# Default Green theme
			self.modulate = Color(0.8, 1.0, 0.8)

func send_reply(text):
	add_message_bubble(text, true)
	# Logic to trigger response or affinity change
