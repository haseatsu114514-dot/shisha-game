extends Control

@onready var summary_label: RichTextLabel = %SummaryLabel
@onready var choice_container: VBoxContainer = %ChoiceContainer
@onready var auto_timer: Timer = %AutoTimer

const TRANSITION_WIDTH: float = 1280.0
const TRANSITION_HEIGHT: float = 720.0
const CARD_WIDTH: float = 156.0
const CARD_HEIGHT: float = 250.0
const CARD_GAP: float = 18.0
const CARD_COUNT: int = 7
const ACCENT_COLOR: Color = Color(0.98, 0.93, 0.18, 1.0)


func _ready() -> void:
	auto_timer.timeout.connect(_on_auto_timer_timeout)
	_render_summary()

	if CalendarManager.current_day == 7 and not EventFlags.get_flag("ch1_day7_choice_done"):
		_show_day7_choices()
		return

	auto_timer.start()


func _render_summary() -> void:
	var summary = GameManager.consume_daily_summary()
	var lines: Array[String] = []
	lines.append("Day %d 終了" % CalendarManager.current_day)
	lines.append("")
	lines.append("技術 ★%d" % PlayerData.get_stat_stars("technique"))
	lines.append("感覚 ★%d" % PlayerData.get_stat_stars("sense"))
	lines.append("度胸 ★%d" % PlayerData.get_stat_stars("guts"))
	lines.append("魅力 ★%d" % PlayerData.get_stat_stars("charm"))
	lines.append("洞察 ★%d" % PlayerData.get_stat_stars("insight"))
	lines.append("")
	lines.append("💰 所持金: %d円 (%+d)" % [PlayerData.money, int(summary.get("money", 0))])

	var flavors: Array = summary.get("flavors", [])
	if flavors.size() > 0:
		var flavor_lines: Array[String] = []
		for flavor in flavors:
			flavor_lines.append("%s %+d" % [str(flavor.get("name", "フレーバー")), int(flavor.get("amount", 0))])
		lines.append("📦 " + ", ".join(flavor_lines))

	lines.append("明日の天気: %s" % CalendarManager.get_weather_label(CalendarManager.current_day + 1))
	lines.append("大会まであと %d 日" % CalendarManager.get_remaining_days())
	if CalendarManager.current_day == 7:
		lines.append("明日はいよいよ大会だ…")

	summary_label.text = "\n".join(lines)


func _show_day7_choices() -> void:
	var button1 = Button.new()
	button1.text = "深呼吸して寝る（度胸+3）"
	button1.pressed.connect(_on_day7_choice.bind("guts"))
	choice_container.add_child(button1)

	var button2 = Button.new()
	button2.text = "ノートを見返す（洞察+3）"
	button2.pressed.connect(_on_day7_choice.bind("insight"))
	choice_container.add_child(button2)


func _on_day7_choice(stat_name: String) -> void:
	for child in choice_container.get_children():
		child.queue_free()
	PlayerData.add_stat(stat_name, 3)
	GameManager.log_stat_change(stat_name, 3)
	EventFlags.set_flag("ch1_day7_choice_done")
	auto_timer.start()


func _on_auto_timer_timeout() -> void:
	var previous_day = CalendarManager.current_day
	CalendarManager.advance_time()
	if CalendarManager.current_day != previous_day:
		await _play_day_transition(previous_day, CalendarManager.current_day)
	if CalendarManager.current_day >= CalendarManager.tournament_day:
		GameManager.transition_to_tournament()
	get_tree().change_scene_to_file("res://scenes/daily/morning_phone.tscn")


func _play_day_transition(from_day: int, to_day: int) -> void:
	var layer = CanvasLayer.new()
	layer.layer = 120
	add_child(layer)

	var overlay = ColorRect.new()
	overlay.anchor_right = 1.0
	overlay.anchor_bottom = 1.0
	overlay.color = Color(0.01, 0.01, 0.02, 0.0)
	layer.add_child(overlay)

	var title = Label.new()
	title.anchor_left = 0.5
	title.anchor_top = 0.0
	title.anchor_right = 0.5
	title.anchor_bottom = 0.0
	title.offset_left = -240.0
	title.offset_top = 56.0
	title.offset_right = 240.0
	title.offset_bottom = 110.0
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.text = "DAY TRANSITION"
	title.modulate = Color(0.92, 0.95, 0.98, 0.0)
	title.add_theme_font_size_override("font_size", 34)
	layer.add_child(title)

	var strip_before = _create_day_strip(from_day)
	var strip_after = _create_day_strip(to_day)
	layer.add_child(strip_before)
	layer.add_child(strip_after)

	var strip_width = CARD_WIDTH * CARD_COUNT + CARD_GAP * (CARD_COUNT - 1)
	var base_x = (TRANSITION_WIDTH - strip_width) * 0.5
	var base_y = 160.0
	var step = CARD_WIDTH + CARD_GAP

	strip_before.position = Vector2(base_x, base_y)
	strip_after.position = Vector2(base_x + step, base_y)

	var in_tween = create_tween()
	in_tween.set_parallel(true)
	in_tween.tween_property(overlay, "color:a", 0.92, 0.24)
	in_tween.tween_property(title, "modulate:a", 1.0, 0.2)
	await in_tween.finished

	var slide_tween = create_tween()
	slide_tween.set_parallel(true)
	slide_tween.tween_property(strip_before, "position:x", base_x - step, 0.46).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT)
	slide_tween.tween_property(strip_after, "position:x", base_x, 0.46).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT)
	await slide_tween.finished
	await get_tree().create_timer(0.26).timeout

	var out_tween = create_tween()
	out_tween.set_parallel(true)
	out_tween.tween_property(overlay, "color:a", 0.0, 0.22)
	out_tween.tween_property(title, "modulate:a", 0.0, 0.18)
	out_tween.tween_property(strip_after, "modulate:a", 0.0, 0.2)
	await out_tween.finished

	layer.queue_free()


func _create_day_strip(active_day: int) -> HBoxContainer:
	var strip = HBoxContainer.new()
	strip.theme_override_constants.separation = int(CARD_GAP)
	strip.modulate = Color(1, 1, 1, 1)
	var start_day = _get_strip_start_day(active_day)

	for day in range(start_day, start_day + CARD_COUNT):
		strip.add_child(_create_day_card(day, day == active_day))
	return strip


func _create_day_card(day: int, is_active: bool) -> Control:
	var root = Control.new()
	root.custom_minimum_size = Vector2(CARD_WIDTH, CARD_HEIGHT)

	var panel = PanelContainer.new()
	panel.anchor_right = 1.0
	panel.anchor_bottom = 1.0
	panel.add_theme_stylebox_override("panel", _make_card_style(is_active))
	root.add_child(panel)

	if is_active:
		var accent = ColorRect.new()
		accent.anchor_bottom = 1.0
		accent.offset_right = 26.0
		accent.color = ACCENT_COLOR
		panel.add_child(accent)

	var margin = MarginContainer.new()
	margin.anchor_right = 1.0
	margin.anchor_bottom = 1.0
	margin.offset_left = 14.0
	margin.offset_top = 14.0
	margin.offset_right = -14.0
	margin.offset_bottom = -14.0
	panel.add_child(margin)

	var vbox = VBoxContainer.new()
	vbox.theme_override_constants.separation = 10
	margin.add_child(vbox)

	var weekday_label = Label.new()
	weekday_label.text = CalendarManager.get_weekday_label(day)
	weekday_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	weekday_label.add_theme_font_size_override("font_size", 21)
	weekday_label.modulate = Color(0.9, 0.92, 0.96, 0.9)
	vbox.add_child(weekday_label)

	var day_label = Label.new()
	day_label.text = str(day)
	day_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	day_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	day_label.add_theme_font_size_override("font_size", 74 if is_active else 62)
	day_label.modulate = Color(0.98, 0.98, 0.98, 1.0) if is_active else Color(0.86, 0.89, 0.92, 0.95)
	day_label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	vbox.add_child(day_label)

	var weather_panel = PanelContainer.new()
	weather_panel.custom_minimum_size = Vector2(0, 48)
	weather_panel.add_theme_stylebox_override(
		"panel",
		_make_style(
			Color(0.08, 0.11, 0.16, 0.94),
			Color(0.24, 0.32, 0.42, 1.0),
			1,
			8
		)
	)
	vbox.add_child(weather_panel)

	var weather_label = Label.new()
	weather_label.anchor_right = 1.0
	weather_label.anchor_bottom = 1.0
	weather_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	weather_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	weather_label.text = _weather_text(day)
	weather_label.add_theme_font_size_override("font_size", 21)
	weather_label.modulate = Color(0.92, 0.96, 1.0, 1.0)
	weather_panel.add_child(weather_label)

	return root


func _weather_text(day: int) -> String:
	var weather_id = CalendarManager.get_weather_id(day)
	match weather_id:
		"rainy":
			return "RAIN / 雨"
		"cloudy":
			return "CLOUD / 曇"
		_:
			return "SUN / 晴"


func _get_strip_start_day(active_day: int) -> int:
	var last_day = maxi(CalendarManager.max_days, CalendarManager.tournament_day)
	var max_start = maxi(1, last_day - (CARD_COUNT - 1))
	return int(clamp(active_day - 1, 1, max_start))


func _make_card_style(is_active: bool) -> StyleBoxFlat:
	if is_active:
		return _make_style(
			Color(0.08, 0.09, 0.12, 0.98),
			ACCENT_COLOR,
			2,
			10
		)
	return _make_style(
		Color(0.05, 0.06, 0.09, 0.92),
		Color(0.2, 0.24, 0.3, 0.9),
		1,
		10
	)


func _make_style(bg: Color, border: Color, border_width: int, radius: int) -> StyleBoxFlat:
	var style = StyleBoxFlat.new()
	style.bg_color = bg
	style.border_color = border
	style.border_width_top = border_width
	style.border_width_bottom = border_width
	style.border_width_left = border_width
	style.border_width_right = border_width
	style.corner_radius_top_left = radius
	style.corner_radius_top_right = radius
	style.corner_radius_bottom_left = radius
	style.corner_radius_bottom_right = radius
	style.content_margin_left = 0
	style.content_margin_right = 0
	style.content_margin_top = 0
	style.content_margin_bottom = 0
	return style
