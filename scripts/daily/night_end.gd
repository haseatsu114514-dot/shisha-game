extends Control

@onready var summary_label: RichTextLabel = %SummaryLabel
@onready var choice_container: VBoxContainer = %ChoiceContainer
@onready var auto_timer: Timer = %AutoTimer


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
	CalendarManager.advance_time()
	if CalendarManager.current_day >= CalendarManager.tournament_day:
		GameManager.transition_to_tournament()
	get_tree().change_scene_to_file("res://scenes/daily/morning_phone.tscn")
