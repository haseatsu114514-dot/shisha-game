extends Control

@onready var phone_rig: Control = %PhoneRig
@onready var phone_body: PanelContainer = %PhoneBody
@onready var screen_panel: PanelContainer = %ScreenPanel
@onready var header_bar: PanelContainer = %HeaderBar
@onready var option_bar: PanelContainer = %OptionBar
@onready var title_label: Label = %TitleLabel
@onready var status_label: Label = %StatusLabel
@onready var chat_scroll: ScrollContainer = %Scroll
@onready var chat_container: VBoxContainer = %ChatContainer
@onready var option_container: VBoxContainer = %OptionContainer
@onready var back_button: Button = %BackButton

var _messages: Array = []
var _index: int = 0
var _avatar_cache: Dictionary = {}

const SELF_ID = "hajime"
const DISPLAY_NAME = {
	"hajime": "はじめ",
	"sumi": "スミさん",
	"naru": "なる",
	"adam": "アダム",
	"minto": "みんと",
	"tsumugi": "つむぎ",
	"packii": "パッキー"
}
const AVATAR_TEXTURES = {
	"hajime": "res://assets/sprites/faces/face_hajime.png",
	"sumi": "res://assets/sprites/faces/face_sumi.png",
	"naru": "res://assets/sprites/faces/face_naru.png",
	"adam": "res://assets/sprites/faces/face_adam.png",
	"minto": "res://assets/sprites/faces/face_kirara.png",
	"tsumugi": "res://assets/sprites/faces/face_tsumugi.png",
	"packii": "res://assets/sprites/faces/face_packii.png"
}


func _ready() -> void:
	_messages = GameManager.pop_transient("lime_today_messages", [])
	back_button.pressed.connect(_on_back_button_pressed)
	_apply_line_theme()
	_play_open_animation()
	_show_current_message()


func _play_open_animation() -> void:
	phone_rig.modulate.a = 0.0
	phone_rig.scale = Vector2(0.88, 0.88)
	phone_rig.rotation_degrees = -13.0
	var tween = create_tween()
	tween.set_parallel(true)
	tween.tween_property(phone_rig, "modulate:a", 1.0, 0.2)
	tween.tween_property(phone_rig, "scale", Vector2.ONE, 0.24).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.tween_property(phone_rig, "rotation_degrees", -6.0, 0.24).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)


func _apply_line_theme() -> void:
	phone_body.add_theme_stylebox_override(
		"panel",
		_make_style(
			Color(0.07, 0.07, 0.1, 0.98),
			42,
			Color(0.27, 0.29, 0.33, 1.0),
			2,
			0
		)
	)
	screen_panel.add_theme_stylebox_override(
		"panel",
		_make_style(
			Color(0.95, 0.98, 0.93, 1.0),
			24,
			Color(0.73, 0.84, 0.76, 1.0),
			2,
			0
		)
	)
	header_bar.add_theme_stylebox_override(
		"panel",
		_make_style(
			Color(0.01, 0.76, 0.33, 1.0),
			16,
			Color(0.0, 0.62, 0.25, 1.0),
			1,
			0
		)
	)
	option_bar.add_theme_stylebox_override(
		"panel",
		_make_style(
			Color(0.97, 0.99, 0.96, 1.0),
			14,
			Color(0.8, 0.88, 0.82, 1.0),
			1,
			0
		)
	)

	title_label.add_theme_color_override("font_color", Color(1, 1, 1, 1))
	status_label.add_theme_color_override("font_color", Color(0.93, 1.0, 0.94, 1.0))
	status_label.add_theme_font_size_override("font_size", 14)
	_set_button_theme(back_button, false)


func _show_current_message() -> void:
	_clear_options()
	_clear_chat()
	await get_tree().process_frame

	if _index >= _messages.size():
		title_label.text = "LIME"
		status_label.text = "未読はありません"
		_add_system_message("未読メッセージはありません。")
		back_button.disabled = false
		await get_tree().process_frame
		_scroll_to_bottom()
		return

	var message: Dictionary = _messages[_index]
	var sender_id = str(message.get("sender", "unknown"))
	title_label.text = _to_display_name(sender_id)
	status_label.text = "未読 %d件" % (_messages.size() - _index)

	var chat_lines = _extract_message_lines(message, sender_id)
	if chat_lines.is_empty():
		_add_system_message("受信メッセージを表示できませんでした。")
	else:
		for line in chat_lines:
			var line_sender = str(line.get("sender", sender_id))
			_add_chat_bubble(line_sender, str(line.get("text", "")))

	var message_type = str(message.get("type", "chat"))
	if message_type == "invitation":
		_add_reply_option("行く", "invitation_accept", -1, true)
		_add_reply_option("行かない", "invitation_decline", -1, false)
		back_button.disabled = true
		await get_tree().process_frame
		_scroll_to_bottom()
		return

	if message_type == "chat" and message.has("replies"):
		for i in range(message.get("replies", []).size()):
			var reply: Dictionary = message["replies"][i]
			_add_reply_option(str(reply.get("text", "返信")), "chat_reply", i, false)
		back_button.disabled = true
		await get_tree().process_frame
		_scroll_to_bottom()
		return

	# If there are no replies, just show a confirmation button
	_add_reply_option("確認", "next_message", -1, true)
	back_button.disabled = true
	await get_tree().process_frame
	_scroll_to_bottom()
	return


func _add_reply_option(text: String, action: String, index: int = -1, is_primary: bool = false) -> void:
	var button = Button.new()
	button.text = text
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.custom_minimum_size = Vector2(0, 38)
	_set_button_theme(button, is_primary)
	button.pressed.connect(_on_option_pressed.bind(action, index))
	option_container.add_child(button)


func _on_option_pressed(action: String, index: int) -> void:
	var message: Dictionary = _messages[_index]
	match action:
		"invitation_accept":
			var event_id = str(message.get("accept_event", ""))
			_add_chat_bubble(SELF_ID, "いいよ、一緒に行こう。")
			GameManager.set_transient("pending_outing_event", event_id)
		"invitation_decline":
			_add_chat_bubble(SELF_ID, "今日は厳しい、ごめん")
			var decline = message.get("decline_response", {})
			if typeof(decline) == TYPE_DICTIONARY:
				_add_chat_bubble(str(decline.get("sender", message.get("sender", ""))), str(decline.get("text", "了解")))
		"chat_reply":
			var replies: Array = message.get("replies", [])
			if index >= 0 and index < replies.size():
				var reply: Dictionary = replies[index]
				_add_chat_bubble(SELF_ID, str(reply.get("text", "")))
				_add_chat_bubble(str(message.get("sender", "")), str(reply.get("response", "")))
				AffinityManager.add_affinity(str(message.get("sender", "")), int(reply.get("affinity", 0)))
				
				# If the reply triggers an event, set it
				if reply.has("event"):
					GameManager.set_transient("pending_outing_event", str(reply.get("event", "")))
		"next_message":
			pass # simply marks as read and moves on

	_clear_options()
	back_button.disabled = false
	_mark_current_message_read()
	_index += 1

	if _index < _messages.size():
		var next_button = Button.new()
		next_button.text = "次の未読を開く"
		next_button.custom_minimum_size = Vector2(0, 38)
		_set_button_theme(next_button, true)
		next_button.pressed.connect(_show_current_message)
		option_container.add_child(next_button)
	else:
		var done_button = Button.new()
		done_button.text = "閉じる"
		done_button.custom_minimum_size = Vector2(0, 38)
		_set_button_theme(done_button, true)
		done_button.pressed.connect(_on_back_button_pressed)
		option_container.add_child(done_button)
	_scroll_to_bottom_deferred()


func _add_chat_bubble(sender: String, text: String) -> void:
	if text.strip_edges() == "":
		return

	var row = HBoxContainer.new()
	row.theme_override_constants.separation = 6
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL

	var is_self = sender == SELF_ID
	row.alignment = BoxContainer.ALIGNMENT_END if is_self else BoxContainer.ALIGNMENT_BEGIN

	if not is_self:
		var avatar = TextureRect.new()
		avatar.custom_minimum_size = Vector2(34, 34)
		avatar.expand_mode = 1
		avatar.stretch_mode = 5
		avatar.texture = _get_avatar_texture(sender)
		row.add_child(avatar)

	var bubble = PanelContainer.new()
	bubble.custom_minimum_size = Vector2(230, 0)
	bubble.size_flags_horizontal = Control.SIZE_SHRINK_CENTER

	var style = StyleBoxFlat.new()
	style.content_margin_left = 10
	style.content_margin_right = 10
	style.content_margin_top = 8
	style.content_margin_bottom = 8
	style.corner_radius_top_left = 14
	style.corner_radius_top_right = 14
	style.corner_radius_bottom_left = 14
	style.corner_radius_bottom_right = 14

	if is_self:
		style.bg_color = Color(0.71, 0.97, 0.53, 0.98)
		style.border_width_left = 1
		style.border_width_right = 1
		style.border_width_top = 1
		style.border_width_bottom = 1
		style.border_color = Color(0.5, 0.82, 0.34, 1.0)
	else:
		style.bg_color = Color(1.0, 1.0, 1.0, 0.98)
		style.border_width_left = 1
		style.border_width_right = 1
		style.border_width_top = 1
		style.border_width_bottom = 1
		style.border_color = Color(0.83, 0.89, 0.85, 1.0)
	bubble.add_theme_stylebox_override("panel", style)

	var vbox = VBoxContainer.new()
	vbox.theme_override_constants.separation = 2

	var sender_label = Label.new()
	sender_label.text = _to_display_name(sender)
	sender_label.add_theme_font_size_override("font_size", 12)
	sender_label.modulate = Color(0.2, 0.25, 0.22, 0.8)
	if is_self:
		sender_label.visible = false

	var text_label = Label.new()
	text_label.text = text
	text_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	text_label.add_theme_color_override("font_color", Color(0.08, 0.11, 0.1, 1.0))
	text_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL

	vbox.add_child(sender_label)
	vbox.add_child(text_label)
	bubble.add_child(vbox)
	row.add_child(bubble)
	chat_container.add_child(row)
	_scroll_to_bottom_deferred()


func _add_system_message(text: String) -> void:
	var row = HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL

	var label = Label.new()
	label.text = text
	label.modulate = Color(0.22, 0.28, 0.24, 0.72)
	row.add_child(label)
	chat_container.add_child(row)


func _to_display_name(sender: String) -> String:
	return DISPLAY_NAME.get(sender, sender)


func _extract_message_lines(message: Dictionary, fallback_sender: String) -> Array:
	var result: Array = []
	var raw_lines: Variant = null

	if message.has("messages"):
		raw_lines = message.get("messages", [])
	else:
		for alt_key in ["message_lines", "lines", "conversation"]:
			if message.has(alt_key):
				raw_lines = message.get(alt_key, [])
				break

	if typeof(raw_lines) == TYPE_ARRAY:
		for raw_line in raw_lines:
			var normalized = _normalize_message_line(raw_line, fallback_sender)
			if normalized.is_empty():
				continue
			result.append(normalized)

	if result.is_empty():
		var fallback_text = ""
		if message.has("text"):
			fallback_text = str(message.get("text", ""))
		elif message.has("message"):
			fallback_text = str(message.get("message", ""))
		elif message.has("body"):
			fallback_text = str(message.get("body", ""))
		if fallback_text.strip_edges() != "":
			for chunk in fallback_text.split("\n", false):
				if chunk.strip_edges() == "":
					continue
				result.append({"sender": fallback_sender, "text": chunk.strip_edges()})

	return result


func _normalize_message_line(raw_line: Variant, fallback_sender: String) -> Dictionary:
	if typeof(raw_line) == TYPE_DICTIONARY:
		var line_dict = raw_line as Dictionary
		var sender = str(line_dict.get("sender", fallback_sender))
		var text = str(line_dict.get("text", ""))
		if text.strip_edges() == "":
			text = str(line_dict.get("message", ""))
		if text.strip_edges() == "":
			text = str(line_dict.get("body", ""))
		text = text.strip_edges()
		if text == "":
			return {}
		return {"sender": sender, "text": text}

	var plain_text = str(raw_line).strip_edges()
	if plain_text == "":
		return {}
	return {"sender": fallback_sender, "text": plain_text}


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


func _clear_chat() -> void:
	for child in chat_container.get_children():
		child.queue_free()


func _scroll_to_bottom_deferred() -> void:
	call_deferred("_scroll_to_bottom")


func _scroll_to_bottom() -> void:
	var scroll_bar = chat_scroll.get_v_scroll_bar()
	if scroll_bar == null:
		return
	chat_scroll.scroll_vertical = int(scroll_bar.max_value)


func _jump_to_noon_invitation_event() -> void:
	if CalendarManager.current_time == "morning":
		CalendarManager.advance_time()
	get_tree().change_scene_to_file("res://scenes/daily/map.tscn")


func _set_button_theme(button: Button, is_primary: bool) -> void:
	var normal_bg = Color(0.01, 0.72, 0.31, 1.0) if is_primary else Color(0.96, 0.98, 0.95, 1.0)
	var hover_bg = normal_bg.lightened(0.08)
	var pressed_bg = normal_bg.darkened(0.08)
	var border_color = Color(0.0, 0.56, 0.24, 1.0) if is_primary else Color(0.77, 0.85, 0.8, 1.0)
	var text_color = Color(1, 1, 1, 1) if is_primary else Color(0.1, 0.14, 0.12, 1.0)

	button.add_theme_stylebox_override("normal", _make_style(normal_bg, 10, border_color, 1, 6))
	button.add_theme_stylebox_override("hover", _make_style(hover_bg, 10, border_color, 1, 6))
	button.add_theme_stylebox_override("pressed", _make_style(pressed_bg, 10, border_color, 1, 6))
	button.add_theme_stylebox_override("disabled", _make_style(normal_bg.darkened(0.2), 10, border_color.darkened(0.2), 1, 6))
	button.add_theme_color_override("font_color", text_color)
	button.add_theme_color_override("font_hover_color", text_color)
	button.add_theme_color_override("font_pressed_color", text_color)
	button.add_theme_color_override("font_disabled_color", text_color.darkened(0.4))


func _make_style(
	bg_color: Color,
	radius: int,
	border_color: Color = Color(0, 0, 0, 0),
	border_size: int = 0,
	padding: int = 0
) -> StyleBoxFlat:
	var style = StyleBoxFlat.new()
	style.bg_color = bg_color
	style.corner_radius_top_left = radius
	style.corner_radius_top_right = radius
	style.corner_radius_bottom_left = radius
	style.corner_radius_bottom_right = radius
	style.border_color = border_color
	style.border_width_left = border_size
	style.border_width_right = border_size
	style.border_width_top = border_size
	style.border_width_bottom = border_size
	style.content_margin_left = padding
	style.content_margin_right = padding
	style.content_margin_top = padding
	style.content_margin_bottom = padding
	return style


func _get_avatar_texture(sender: String) -> Texture2D:
	var cached = _avatar_cache.get(sender, null) as Texture2D
	if cached != null:
		return cached

	var path = str(AVATAR_TEXTURES.get(sender, "res://assets/ui/ui_lime_icon.png"))
	var loaded = load(path)
	var texture = loaded as Texture2D
	if texture == null:
		texture = load("res://assets/ui/ui_lime_icon.png") as Texture2D
	_avatar_cache[sender] = texture
	return texture


func _on_back_button_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/daily/morning_phone.tscn")
