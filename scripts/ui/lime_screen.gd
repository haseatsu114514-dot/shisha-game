extends Control

@onready var title_label: Label = %TitleLabel
@onready var message_label: RichTextLabel = %MessageLabel
@onready var option_container: VBoxContainer = %OptionContainer
@onready var close_button: Button = %CloseButton

var _messages: Array = []
var _index: int = 0


func _ready() -> void:
	_messages = GameManager.pop_transient("lime_today_messages", [])
	close_button.pressed.connect(_on_close_button_pressed)
	_show_current_message()


func _show_current_message() -> void:
	_clear_options()
	if _index >= _messages.size():
		title_label.text = "LIME"
		message_label.text = "未読メッセージはありません。"
		close_button.disabled = false
		return

	var message: Dictionary = _messages[_index]
	title_label.text = "LIME - %s" % str(message.get("sender", "unknown"))

	var text_lines: Array[String] = []
	for line in message.get("messages", []):
		text_lines.append("%s: %s" % [str(line.get("sender", "")), str(line.get("text", ""))])
	message_label.text = "\n".join(text_lines)

	var message_type = str(message.get("type", "chat"))
	if message_type == "invitation":
		_add_option("行く", "invitation_accept")
		_add_option("行かない", "invitation_decline")
		close_button.disabled = true
		return

	if message_type == "chat" and message.has("replies"):
		for i in range(message.get("replies", []).size()):
			var reply: Dictionary = message["replies"][i]
			_add_option(str(reply.get("text", "返信")), "chat_reply", i)
		close_button.disabled = true
		return

	_mark_current_message_read()
	_index += 1
	_show_current_message()


func _add_option(text: String, action: String, index: int = -1) -> void:
	var button = Button.new()
	button.text = text
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.pressed.connect(_on_option_pressed.bind(action, index))
	option_container.add_child(button)


func _on_option_pressed(action: String, index: int) -> void:
	var message: Dictionary = _messages[_index]
	match action:
		"invitation_accept":
			var time_slot = str(message.get("time_slot", "night"))
			var event_id = str(message.get("accept_event", ""))
			if time_slot == "noon":
				GameManager.set_transient("forced_noon_action", event_id)
			else:
				GameManager.set_transient("night_action", event_id)
		"invitation_decline":
			pass
		"chat_reply":
			var replies: Array = message.get("replies", [])
			if index >= 0 and index < replies.size():
				var reply: Dictionary = replies[index]
				AffinityManager.add_affinity(str(message.get("sender", "")), int(reply.get("affinity", 0)))

	_mark_current_message_read()
	_index += 1
	_show_current_message()


func _mark_current_message_read() -> void:
	if _index >= _messages.size():
		return
	var message: Dictionary = _messages[_index]
	var msg_id = str(message.get("id", ""))
	if msg_id != "":
		EventFlags.set_flag("msg_read_%s" % msg_id)


func _clear_options() -> void:
	for child in option_container.get_children():
		child.queue_free()


func _on_close_button_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/daily/morning_phone.tscn")
