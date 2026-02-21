extends Control

@onready var info_label: Label = %InfoLabel
@onready var notification_label: Label = %NotificationLabel
@onready var lime_button: Button = %LimeButton
@onready var close_phone_button: Button = %ClosePhoneButton
var _today_messages: Array = []
var _rule_hint_appended: bool = false


func _ready() -> void:
	GameManager.play_daily_bgm()
	_rule_hint_appended = false

	if CalendarManager.is_tournament_day():
		var unread_memo_count = PlayerData.get_unread_tournament_memo_count()
		var lines: Array[String] = []
		lines.append("Day %d 大会当日！" % CalendarManager.current_day)
		lines.append("会場へ向かおう。")
		lines.append("目的: この章の大会で1位を取る。")
		lines.append("敗北時: 本編は進まず、同大会を再挑戦。")
		info_label.text = "\n".join(lines)
		if unread_memo_count > 0:
			notification_label.text = "大会メモ 未読 %d件" % unread_memo_count
		else:
			notification_label.text = "大会メモを確認済み"
		lime_button.disabled = true
		close_phone_button.text = "マップへ" # Changed from jump to tournament
		_append_daily_rule_hint_if_needed()
		return

	if CalendarManager.is_interval:
		var remaining = CalendarManager.get_interval_remaining_days()
		info_label.text = "インターバル Day %d\n自由に行動できる（残り%d日）" % [CalendarManager.interval_day, remaining]

	var notice = str(GameManager.pop_transient("morning_notice", ""))
	if notice == "":
		notice = _build_sumi_morning_invite_text()
	if notice != "":
		info_label.text = notice
	elif not CalendarManager.is_interval:
		info_label.text = "朝のスマホチェック"

	_append_chapter_brief_if_needed()
	_append_daily_rule_hint_if_needed()

	_today_messages = _load_today_lime_messages()
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


func _update_notifications() -> void:
	if _today_messages.size() > 0:
		notification_label.text = "LIME 未読 %d件" % _today_messages.size()
	else:
		notification_label.text = "通知なし"


func _build_sumi_morning_invite_text() -> String:
	if CalendarManager.is_interval:
		return ""
	var tonight_event = GameManager.get_forced_event_for_today("night")
	if tonight_event.is_empty():
		return ""
	var event_id = str(tonight_event.get("id", ""))
	if event_id.find("sumi") == -1:
		return ""
	return "スミさん: 今日の夜、閉店後に店に来い。"


func _on_lime_button_pressed() -> void:
	if CalendarManager.is_tournament_day():
		return
	if _today_messages.is_empty():
		info_label.text = "未読メッセージはありません。"
		return
	GameManager.set_transient("lime_today_messages", _today_messages)
	get_tree().change_scene_to_file("res://scenes/ui/lime_screen.tscn")



func _on_close_phone_button_pressed() -> void:
	CalendarManager.advance_time()
	get_tree().change_scene_to_file("res://scenes/daily/map.tscn")


func _append_daily_rule_hint_if_needed() -> void:
	if _rule_hint_appended:
		return
	if EventFlags.get_flag("core_daily_rule_hint_seen"):
		return
	var lines: Array[String] = []
	lines.append("")
	lines.append("【行動ルール】")
	lines.append("・朝→昼→夜→深夜で時間が進む")
	lines.append("・マップ行動1回ごとに行動回数を1消費")
	lines.append("・行動が0になるとその時間帯は終了")
	_append_info_lines(lines)
	EventFlags.set_flag("core_daily_rule_hint_seen")
	_rule_hint_appended = true


func _append_chapter_brief_if_needed() -> void:
	if CalendarManager.is_interval:
		return
	if CalendarManager.current_time != "morning":
		return
	if CalendarManager.current_day != 1:
		return
	var flag_key = "chapter_%d_brief_seen" % GameManager.current_chapter
	if EventFlags.get_flag(flag_key):
		return

	var lines = _build_chapter_brief_lines(GameManager.current_chapter)
	if not lines.is_empty():
		_append_info_lines(lines)
	EventFlags.set_flag(flag_key)


func _build_chapter_brief_lines(chapter: int) -> Array[String]:
	var lines: Array[String] = []
	lines.append("")
	lines.append("【章の目標】")
	match chapter:
		1:
			lines.append("地方大会で1位を取る。")
			lines.append("新要素: 蒸らし前の思考弾幕、吸い出し、提供後調整。")
			lines.append("解放条件: チュートリアル完了後にライバル店が開く。")
		2:
			lines.append("日本大会で1位を取る。")
			lines.append("新要素: 中間順位差を使った追い上げ判断が重要。")
			lines.append("解放条件: 交流スポットとショップ在庫が章進行で拡張。")
		3:
			lines.append("アジア大会で1位を取る。")
			lines.append("新要素: 海外滞在（イスタンブール）で相棒同行イベント。")
			lines.append("解放条件: 現地交流を重ねると補助イベントが増える。")
		_:
			lines.append("この章の大会で1位を取る。")
			lines.append("新要素は進行に応じて追加される。")
	lines.append("敗北時: 本編は進まず、同章大会を再挑戦。")
	return lines


func _append_info_lines(lines: Array[String]) -> void:
	var extra = "\n".join(lines).strip_edges()
	if extra == "":
		return
	if info_label.text.strip_edges() == "":
		info_label.text = extra
	else:
		info_label.text += "\n" + extra
