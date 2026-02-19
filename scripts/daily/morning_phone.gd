extends Control

@onready var info_label: Label = %InfoLabel
@onready var notification_label: Label = %NotificationLabel
@onready var post_panel: PanelContainer = %PostPanel
@onready var post_text_label: RichTextLabel = %PostTextLabel

var _today_messages: Array = []
var _today_post: Dictionary = {}


func _ready() -> void:
	GameManager.play_daily_bgm()
	post_panel.visible = false

	if CalendarManager.is_tournament_day():
		info_label.text = "Day %d 大会当日！\nTo be continued..." % CalendarManager.current_day
		notification_label.text = ""
		return

	if CalendarManager.is_interval:
		var remaining = CalendarManager.get_interval_remaining_days()
		info_label.text = "インターバル Day %d\n自由に行動できる（残り%d日）" % [CalendarManager.interval_day, remaining]
	elif CalendarManager.current_day >= 2:
		EventFlags.set_flag("ch1_rival_shops_open", true)

	var notice = str(GameManager.pop_transient("morning_notice", ""))
	if notice != "":
		info_label.text = notice
	elif not CalendarManager.is_interval:
		info_label.text = "朝のスマホチェック"

	_today_messages = _load_today_lime_messages()
	_today_post = _load_today_post()
	_update_notifications()


func _load_today_lime_messages() -> Array:
	if not FileAccess.file_exists("res://data/lime_messages.json"):
		return []
	var file = FileAccess.open("res://data/lime_messages.json", FileAccess.READ)
	if file == null:
		return []
	var parsed = JSON.parse_string(file.get_as_text())
	file.close()
	if typeof(parsed) != TYPE_DICTIONARY:
		return []

	var messages: Array = parsed.get("messages", [])
	var result: Array = []
	for message in messages:
		if int(message.get("trigger_day", -1)) != CalendarManager.current_day:
			continue
		if EventFlags.get_flag("msg_read_%s" % str(message.get("id", ""))):
			continue
		if not _is_message_condition_met(message):
			continue
		result.append(message)
	return result


func _is_message_condition_met(message: Dictionary) -> bool:
	var condition = str(message.get("trigger_condition", ""))
	if condition == "lime_exchanged":
		return AffinityManager.has_lime(str(message.get("sender", "")))
	return true


func _load_today_post() -> Dictionary:
	if not FileAccess.file_exists("res://data/sheesha_posts.json"):
		return {}
	var file = FileAccess.open("res://data/sheesha_posts.json", FileAccess.READ)
	if file == null:
		return {}
	var parsed = JSON.parse_string(file.get_as_text())
	file.close()
	if typeof(parsed) != TYPE_DICTIONARY:
		return {}

	for post in parsed.get("posts", []):
		if int(post.get("day", -1)) == CalendarManager.current_day:
			return post
	return {}


func _update_notifications() -> void:
	var lines: Array[String] = []
	if _today_messages.size() > 0:
		lines.append("LIME 未読 %d件" % _today_messages.size())
	if not _today_post.is_empty():
		lines.append("Sheesha タイムライン更新")
	if lines.is_empty():
		notification_label.text = "通知なし"
		return
	notification_label.text = "\n".join(lines)


func _on_lime_button_pressed() -> void:
	if CalendarManager.is_tournament_day():
		return
	if _today_messages.is_empty():
		info_label.text = "未読メッセージはありません。"
		return
	GameManager.set_transient("lime_today_messages", _today_messages)
	get_tree().change_scene_to_file("res://scenes/ui/lime_screen.tscn")


func _on_sheesha_button_pressed() -> void:
	if CalendarManager.is_tournament_day():
		return
	if _today_post.is_empty():
		info_label.text = "今日はタイムライン更新なし。"
		return

	var text = "[%s]\n%s" % [str(_today_post.get("author", "unknown")), str(_today_post.get("text", ""))]
	if PlayerData.stat_insight >= 30:
		text += "\n\n洞察メモ: %s" % str(_today_post.get("insight_bonus_text", ""))
	post_text_label.text = text
	post_panel.visible = true


func _on_post_close_button_pressed() -> void:
	post_panel.visible = false


func _on_close_phone_button_pressed() -> void:
	if CalendarManager.is_tournament_day():
		get_tree().change_scene_to_file("res://scenes/title/title_screen.tscn")
		return

	CalendarManager.advance_time()
	get_tree().change_scene_to_file("res://scenes/daily/map.tscn")
