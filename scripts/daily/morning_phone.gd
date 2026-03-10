extends Control

const PHONE_CARD_MAX_LINES := 2

@onready var phone_frame: PanelContainer = $PhoneFrame
@onready var time_label: Label = %TimeLabel
@onready var carrier_label: Label = %CarrierLabel
@onready var battery_label: Label = %BatteryLabel
@onready var app_header_panel: PanelContainer = $PhoneFrame/VBox/AppHeaderPanel
@onready var header_title_label: Label = %HeaderTitleLabel
@onready var state_badge_label: Button = %StateBadgeLabel
@onready var state_detail_label: Label = %StateDetailLabel
@onready var summary_panel: PanelContainer = %SummaryPanel
@onready var summary_label: Label = %SummaryLabel
@onready var detail_panel: PanelContainer = %DetailPanel
@onready var detail_label: Label = %DetailLabel
@onready var rule_panel: PanelContainer = %RulePanel
@onready var rule_label: Label = %RuleLabel
@onready var notification_panel: PanelContainer = $PhoneFrame/VBox/NotificationPanel
@onready var notification_label: Label = %NotificationLabel
@onready var lime_button: Button = %LimeButton
@onready var close_phone_button: Button = %ClosePhoneButton
var _today_messages: Array = []
var _rule_hint_appended: bool = false


func _ready() -> void:
	GameManager.play_daily_bgm()
	_rule_hint_appended = false
	_apply_phone_shell_style()
	_apply_card_styles()
	_update_phone_chrome()
	_set_screen_state("MORNING CHECK", "通常", "今日の導線をここで確認する。", Color("3a4466"))
	_set_summary_text("")
	_set_detail_text("")
	_set_rule_text("")

	if CalendarManager.is_tournament_day():
		var has_flavor = _player_has_any_flavor()
		var unread_memo_count = PlayerData.get_unread_tournament_memo_count()
		var lines: Array[String] = []
		lines.append("Day %d 大会当日！" % CalendarManager.current_day)
		if not has_flavor:
			lines.append("フレーバーが足りない！ 先にショップで買い物をしよう。")
			_set_summary_text("\n".join(lines))
			_set_detail_text("章目標: 大会で優勝。")
			_set_screen_state("TOURNAMENT DAY", "要買い出し", "このままでは出場準備が不足。先にショップへ向かう。", Color("e43b44"))
			notification_label.text = "⚠ フレーバー不足"
			lime_button.disabled = true
			close_phone_button.text = "ショップへ"
			GameManager.set_transient("force_shop_before_tournament", true)
		else:
			lines.append("会場へ向かおう。")
			_set_summary_text("\n".join(lines))
			_set_detail_text("章目標: 大会で優勝。\n敗北時は同大会を再挑戦。")
			_set_screen_state("TOURNAMENT DAY", "準備完了", "必要素材は揃っている。このまま会場へ進める。", Color("3e8948"))
			if unread_memo_count > 0:
				notification_label.text = "大会メモ 未読 %d件" % unread_memo_count
			else:
				notification_label.text = "大会メモを確認済み"
			lime_button.disabled = true
			close_phone_button.text = "マップへ"
		_append_daily_rule_hint_if_needed()
		return

	if CalendarManager.is_interval:
		var remaining = CalendarManager.get_interval_remaining_days()
		_set_summary_text("インターバル Day %d\n自由に行動できる（残り%d日）" % [CalendarManager.interval_day, remaining])
		_set_screen_state("INTERVAL", "自由行動", "今日は自由行動日。誰に会うか、どこで稼ぐかを決める。", Color("3e8948"))

	var notice = str(GameManager.pop_transient("morning_notice", ""))
	if notice == "":
		notice = _build_sumi_morning_invite_text()
	if notice != "":
		var pages = _chunk_text_for_cards(notice)
		_set_summary_text(pages[0] if pages.size() > 0 else "")
		_set_detail_text(pages[1] if pages.size() > 1 else "")
	elif not CalendarManager.is_interval:
		_set_summary_text("朝のスマホチェック")
		_set_screen_state("MORNING CHECK", "通常", "今日の導線と通知を確認してから行動に入る。", Color("3a4466"))

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
		if message.has("trigger_interval_day"):
			if not CalendarManager.is_interval or int(message.get("trigger_interval_day", -1)) > CalendarManager.interval_day:
				continue
		elif message.has("trigger_day"):
			if CalendarManager.is_interval or int(message.get("trigger_day", -1)) > CalendarManager.current_day:
				continue

		# If it's chapter specific
		if message.has("trigger_chapter"):
			if int(message.get("trigger_chapter", 1)) != GameManager.current_chapter:
				continue

		if EventFlags.get_flag("msg_read_%s" % str(message.get("id", ""))):
			continue

		if not _is_message_condition_met(message):
			continue

		result.append(message)

	# Load post-romance event messages from lime_events.json
	if FileAccess.file_exists("res://data/lime_events.json"):
		var events_file = FileAccess.open("res://data/lime_events.json", FileAccess.READ)
		if events_file != null:
			var events_parsed = JSON.parse_string(events_file.get_as_text())
			events_file.close()
			if typeof(events_parsed) == TYPE_DICTIONARY:
				var events: Array = events_parsed.get("events", [])
				for ev in events:
					if EventFlags.get_flag("msg_read_%s" % str(ev.get("id", ""))):
						continue
					if not _is_message_condition_met(ev):
						continue
					result.append(ev)

	return result


func _is_message_condition_met(message: Dictionary) -> bool:
	var condition = str(message.get("trigger_condition", ""))
	if condition == "lime_exchanged":
		return AffinityManager.has_lime(str(message.get("sender", "")))
	elif condition == "affinity_max":
		var sender = str(message.get("sender", ""))
		return AffinityManager.is_max_level(sender) and not AffinityManager.is_in_romance(sender)
	elif condition == "affinity_level":
		var sender = str(message.get("sender", ""))
		var trigger_value = int(message.get("trigger_value", 3))
		return AffinityManager.get_level(sender) >= trigger_value and not AffinityManager.is_in_romance(sender)
	elif condition == "tournament_day":
		var sender = str(message.get("sender", ""))
		return CalendarManager.is_tournament_day() and AffinityManager.has_lime(sender)
	elif condition == "romance":
		var sender = str(message.get("sender", ""))
		return AffinityManager.is_in_romance(sender)
	elif condition == "ch2_started":
		return GameManager.current_chapter >= 2
	elif condition == "ch3_started":
		return GameManager.current_chapter >= 3
	elif condition.begins_with("romance_"):
		return EventFlags.get_flag(condition)
	return true


func _update_notifications() -> void:
	if _today_messages.size() > 0:
		notification_label.text = "LIME 未読 %d件" % _today_messages.size()
		notification_label.add_theme_color_override("font_color", Color("0f1322"))
		notification_panel.modulate = Color(1.0, 0.84, 0.4, 1.0)
	else:
		notification_label.text = "通知なし"
		notification_label.add_theme_color_override("font_color", Color("e6edf8"))
		notification_panel.modulate = Color(0.52, 0.58, 0.72, 0.78)


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
	if _today_messages.is_empty():
		_set_summary_text("未読メッセージはありません。")
		return
	GameManager.set_transient("lime_today_messages", _today_messages)
	get_tree().change_scene_to_file("res://scenes/ui/lime_screen.tscn")



func _on_close_phone_button_pressed() -> void:
	if GameManager.get_transient("force_shop_before_tournament", false):
		GameManager.pop_transient("force_shop_before_tournament", false)
		get_tree().change_scene_to_file("res://scenes/daily/shop.tscn")
		return
		
	var pending_outing = str(GameManager.pop_transient("pending_outing_event", ""))
	if pending_outing != "":
		GameManager.set_transient("interaction_event", pending_outing)
		GameManager.set_transient("advance_time_after_scene", true)
		get_tree().change_scene_to_file("res://scenes/daily/interaction.tscn")
		return
		
	CalendarManager.advance_time()
	get_tree().change_scene_to_file("res://scenes/daily/map.tscn")


func _player_has_any_flavor() -> bool:
	for item in PlayerData.flavor_inventory:
		if typeof(item) == TYPE_DICTIONARY and int(item.get("amount", 0)) > 0:
			return true
	return false


func _append_daily_rule_hint_if_needed() -> void:
	if _rule_hint_appended:
		return
	if EventFlags.get_flag("core_daily_rule_hint_seen"):
		return
	var lines: Array[String] = []
	lines.append("・朝→昼→夜→深夜で進行")
	lines.append("・行動1回で残り回数を1消費")
	lines.append("・0で次の時間帯へ")
	_set_rule_text("【行動ルール】\n" + "\n".join(lines))
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
		_set_detail_text(_merge_card_text(detail_label.text, "\n".join(lines)))
	EventFlags.set_flag(flag_key)


func _build_chapter_brief_lines(chapter: int) -> Array[String]:
	var lines: Array[String] = []
	lines.append("")
	lines.append("【章の目標】")
	match chapter:
		1:
			lines.append("SMOKE CROWN CUPで優勝する。")
			lines.append("特訓後にライバル店が開く。")
		2:
			lines.append("HAZE: OPEN CLOUDで優勝する。")
			lines.append("交流先と在庫が増える。")
		3:
			lines.append("アジア大会で優勝する。")
			lines.append("交流で補助イベントが増える。")
		_:
			lines.append("この章の大会で優勝する。")
	lines.append("敗北時は同章大会を再挑戦。")
	return lines


func _apply_card_styles() -> void:
	for panel in [summary_panel, detail_panel, rule_panel]:
		var style = StyleBoxFlat.new()
		style.bg_color = Color(0.06, 0.07, 0.12, 0.92)
		style.border_color = Color("3a4466", 0.72)
		style.border_width_left = 4
		style.border_width_top = 1
		style.border_width_right = 1
		style.border_width_bottom = 1
		style.corner_radius_top_left = 10
		style.corner_radius_top_right = 10
		style.corner_radius_bottom_left = 10
		style.corner_radius_bottom_right = 10
		style.content_margin_left = 14
		style.content_margin_right = 14
		style.content_margin_top = 12
		style.content_margin_bottom = 12
		panel.add_theme_stylebox_override("panel", style)

	for label in [summary_label, detail_label, rule_label]:
		label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.9))
		label.add_theme_constant_override("outline_size", 4)
		label.add_theme_font_size_override("font_size", 15)

	summary_label.add_theme_color_override("font_color", Color("fff0cf"))
	detail_label.add_theme_color_override("font_color", Color("ead4aa"))
	rule_label.add_theme_color_override("font_color", Color("cfe7ff"))


func _apply_phone_shell_style() -> void:
	var frame_style = StyleBoxFlat.new()
	frame_style.bg_color = Color(0.035, 0.05, 0.1, 0.97)
	frame_style.border_color = Color("9fb8ff", 0.28)
	frame_style.border_width_left = 2
	frame_style.border_width_top = 2
	frame_style.border_width_right = 2
	frame_style.border_width_bottom = 2
	frame_style.corner_radius_top_left = 28
	frame_style.corner_radius_top_right = 28
	frame_style.corner_radius_bottom_left = 28
	frame_style.corner_radius_bottom_right = 28
	frame_style.content_margin_left = 16
	frame_style.content_margin_top = 18
	frame_style.content_margin_right = 16
	frame_style.content_margin_bottom = 18
	phone_frame.add_theme_stylebox_override("panel", frame_style)

	var header_style = StyleBoxFlat.new()
	header_style.bg_color = Color(0.08, 0.12, 0.2, 0.96)
	header_style.border_color = Color("6c89d8", 0.45)
	header_style.border_width_left = 1
	header_style.border_width_top = 1
	header_style.border_width_right = 1
	header_style.border_width_bottom = 1
	header_style.corner_radius_top_left = 18
	header_style.corner_radius_top_right = 18
	header_style.corner_radius_bottom_left = 18
	header_style.corner_radius_bottom_right = 18
	header_style.content_margin_left = 0
	header_style.content_margin_right = 0
	header_style.content_margin_top = 0
	header_style.content_margin_bottom = 0
	app_header_panel.add_theme_stylebox_override("panel", header_style)

	var notice_style = StyleBoxFlat.new()
	notice_style.bg_color = Color(0.18, 0.22, 0.3, 0.86)
	notice_style.border_color = Color("8b9bb4", 0.38)
	notice_style.border_width_left = 1
	notice_style.border_width_top = 1
	notice_style.border_width_right = 1
	notice_style.border_width_bottom = 1
	notice_style.corner_radius_top_left = 14
	notice_style.corner_radius_top_right = 14
	notice_style.corner_radius_bottom_left = 14
	notice_style.corner_radius_bottom_right = 14
	notice_style.content_margin_left = 12
	notice_style.content_margin_right = 12
	notice_style.content_margin_top = 10
	notice_style.content_margin_bottom = 10
	notification_panel.add_theme_stylebox_override("panel", notice_style)

	for button in [lime_button, close_phone_button]:
		var normal = StyleBoxFlat.new()
		normal.bg_color = Color(0.16, 0.2, 0.33, 0.95)
		normal.border_color = Color("6c89d8", 0.55)
		normal.border_width_left = 1
		normal.border_width_top = 1
		normal.border_width_right = 1
		normal.border_width_bottom = 2
		normal.corner_radius_top_left = 14
		normal.corner_radius_top_right = 14
		normal.corner_radius_bottom_left = 14
		normal.corner_radius_bottom_right = 14
		normal.content_margin_left = 12
		normal.content_margin_right = 12
		normal.content_margin_top = 8
		normal.content_margin_bottom = 8
		button.add_theme_stylebox_override("normal", normal)
		var hover = normal.duplicate()
		hover.bg_color = Color(0.24, 0.31, 0.49, 0.98)
		hover.border_color = Color("b6c9ff", 0.8)
		button.add_theme_stylebox_override("hover", hover)
		var pressed = normal.duplicate()
		pressed.bg_color = Color(0.3, 0.37, 0.58, 1.0)
		button.add_theme_stylebox_override("pressed", pressed)
		button.custom_minimum_size = Vector2(0, 38)
		button.add_theme_font_size_override("font_size", 16)


func _update_phone_chrome() -> void:
	time_label.text = _phone_clock_text()
	carrier_label.text = "TONARI LINK"
	var battery = clampi(92 - CalendarManager.current_day * 4 + _today_messages.size(), 48, 96)
	if CalendarManager.is_interval:
		battery = clampi(86 - CalendarManager.interval_day * 3, 44, 92)
	battery_label.text = "%d%%" % battery


func _phone_clock_text() -> String:
	match CalendarManager.current_time:
		"morning":
			return "AM 7:00"
		"noon":
			return "PM 12:00"
		"night":
			return "PM 7:00"
		"midnight":
			return "AM 0:30"
		_:
			return "AM 7:00"


func _set_screen_state(title: String, badge: String, detail: String, accent: Color) -> void:
	header_title_label.text = title
	state_badge_label.text = badge
	state_detail_label.text = detail
	state_badge_label.add_theme_color_override("font_color", Color(0.05, 0.08, 0.12))
	state_badge_label.add_theme_color_override("font_disabled_color", Color(0.05, 0.08, 0.12))
	state_badge_label.add_theme_color_override("font_outline_color", Color(1, 1, 1, 0.0))
	state_badge_label.add_theme_constant_override("outline_size", 0)
	state_badge_label.add_theme_font_size_override("font_size", 18)
	var badge_style = StyleBoxFlat.new()
	badge_style.bg_color = accent
	badge_style.border_color = Color(1, 1, 1, 0.1)
	badge_style.border_width_left = 1
	badge_style.border_width_top = 1
	badge_style.border_width_right = 1
	badge_style.border_width_bottom = 1
	badge_style.corner_radius_top_left = 12
	badge_style.corner_radius_top_right = 12
	badge_style.corner_radius_bottom_left = 12
	badge_style.corner_radius_bottom_right = 12
	badge_style.content_margin_left = 10
	badge_style.content_margin_right = 10
	badge_style.content_margin_top = 6
	badge_style.content_margin_bottom = 6
	state_badge_label.add_theme_stylebox_override("normal", badge_style)
	state_badge_label.add_theme_stylebox_override("disabled", badge_style)


func _merge_card_text(existing: String, extra: String) -> String:
	var left = existing.strip_edges()
	var right = extra.strip_edges()
	if left == "":
		return right
	if right == "":
		return left
	return left + "\n" + right


func _chunk_text_for_cards(value: String) -> Array[String]:
	var wrapped = GameManager.format_story_text(value.strip_edges(), 18)
	if wrapped == "":
		return []
	var lines = wrapped.split("\n", false)
	var chunks: Array[String] = []
	while not lines.is_empty() and chunks.size() < 2:
		var take = mini(PHONE_CARD_MAX_LINES, lines.size())
		var part = "\n".join(lines.slice(0, take)).strip_edges()
		chunks.append(part)
		lines = lines.slice(take)
	if not lines.is_empty():
		chunks[chunks.size() - 1] = _merge_card_text(chunks[chunks.size() - 1], "…")
	return chunks


func _set_summary_text(value: String) -> void:
	var text = value.strip_edges()
	summary_label.text = text
	summary_panel.visible = text != ""


func _set_detail_text(value: String) -> void:
	var text = value.strip_edges()
	detail_label.text = text
	detail_panel.visible = text != ""


func _set_rule_text(value: String) -> void:
	var text = value.strip_edges()
	rule_label.text = text
	rule_panel.visible = text != ""


func _unhandled_input(event: InputEvent) -> void:
	if not (event is InputEventKey):
		return
	var key_event := event as InputEventKey
	if key_event == null or not key_event.pressed or key_event.echo:
		return
	var key = key_event.physical_keycode if key_event.physical_keycode != 0 else key_event.keycode
	if key == KEY_L and not lime_button.disabled:
		_on_lime_button_pressed()
		accept_event()
		return
	if key == KEY_SPACE or key == KEY_ENTER or key == KEY_KP_ENTER or key == KEY_ESCAPE:
		_on_close_phone_button_pressed()
		accept_event()
