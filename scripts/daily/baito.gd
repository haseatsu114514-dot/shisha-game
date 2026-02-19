extends Control

@onready var header_label: Label = %HeaderLabel
@onready var body_label: RichTextLabel = %BodyLabel
@onready var menu_container: VBoxContainer = %MenuContainer
@onready var choice_container: VBoxContainer = %ChoiceContainer
@onready var back_button: Button = %BackButton

var _events: Array = []
var _event_queue: Array = []
var _current_event: Dictionary = {}
var _shift_salary: int = 0
var _shift_advance_steps: int = 1


func _ready() -> void:
	GameManager.play_daily_bgm()
	back_button.pressed.connect(_on_back_button_pressed)
	_load_events()
	_show_main_menu()


func _load_events() -> void:
	if not FileAccess.file_exists("res://data/baito_events.json"):
		_events = []
		return
	var file = FileAccess.open("res://data/baito_events.json", FileAccess.READ)
	if file == null:
		_events = []
		return
	var parsed = JSON.parse_string(file.get_as_text())
	file.close()
	if typeof(parsed) != TYPE_DICTIONARY:
		_events = []
		return
	_events = parsed.get("events", [])


func _show_main_menu() -> void:
	header_label.text = "チルハウス"
	body_label.text = "何をする？"
	_clear_buttons(menu_container)
	_clear_buttons(choice_container)
	_add_menu_button("バイトする", "work_menu")
	_add_menu_button("練習する", "practice")
	_add_menu_button("スミさんと話す", "talk_sumi")
	_add_menu_button("戻る", "return")


func _add_menu_button(text: String, action: String) -> void:
	var button = Button.new()
	button.text = text
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.pressed.connect(_on_menu_selected.bind(action))
	menu_container.add_child(button)


func _on_menu_selected(action: String) -> void:
	match action:
		"work_menu":
			_show_shift_menu()
		"work_half":
			_start_shift("half")
		"work_full":
			_start_shift("full")
		"work_night":
			_start_shift("night")
		"work_back":
			_show_main_menu()
		"practice":
			_do_practice()
		"talk_sumi":
			_do_sumi_talk()
		"return":
			get_tree().change_scene_to_file("res://scenes/daily/map.tscn")


func _show_shift_menu() -> void:
	body_label.text = "シフトを選んでください"
	_clear_buttons(menu_container)
	if CalendarManager.current_time == "noon":
		_add_menu_button("半日バイト（昼のみ / +8000円）", "work_half")
		_add_menu_button("夜までバイト（昼+夜 / +18000円）", "work_full")
	else:
		_add_menu_button("夜バイト（+10000円）", "work_night")
	_add_menu_button("戻る", "work_back")


func _start_shift(mode: String) -> void:
	var action_cost = 1
	var event_count = randi_range(1, 2)
	_shift_salary = 8000
	_shift_advance_steps = 1

	match mode:
		"full":
			action_cost = 2
			event_count = randi_range(3, 5)
			_shift_salary = 18000
			_shift_advance_steps = 2
		"night":
			action_cost = 1
			event_count = randi_range(2, 3)
			_shift_salary = 10000
			_shift_advance_steps = 1
		_:
			action_cost = 1
			event_count = randi_range(1, 2)
			_shift_salary = 8000
			_shift_advance_steps = 1

	if CalendarManager.actions_remaining < action_cost:
		body_label.text = "行動コマがありません。"
		_show_main_menu()
		return
	for _i in range(action_cost):
		CalendarManager.use_action()

	PlayerData.add_money(_shift_salary)
	GameManager.log_money_change(_shift_salary)

	_event_queue = _pick_events(event_count)
	body_label.text = "シフト開始！"
	_show_next_event()


func _pick_events(count: int) -> Array:
	var available: Array = []
	for event in _events:
		if _can_trigger_event(event):
			available.append(event)

	var selected: Array = []
	if CalendarManager.current_day == 1 and not EventFlags.get_flag("ch1_tsumugi_regular"):
		for event in available:
			if str(event.get("id", "")) == "baito_tsumugi_01":
				selected.append(event)
				available.erase(event)
				break

	available.shuffle()
	for event in available:
		if selected.size() >= count:
			break
		selected.append(event)
	return selected


func _can_trigger_event(event: Dictionary) -> bool:
	var trigger_flag = str(event.get("trigger_flag", ""))
	if trigger_flag == "":
		return true
	if trigger_flag.begins_with("!"):
		return not EventFlags.get_flag(trigger_flag.trim_prefix("!"))
	return EventFlags.get_flag(trigger_flag)


func _show_next_event() -> void:
	_clear_buttons(choice_container)
	if _event_queue.is_empty():
		_finish_shift()
		return

	_current_event = _event_queue.pop_front()
	body_label.text = str(_current_event.get("text", ""))
	for choice in _current_event.get("choices", []):
		var button = Button.new()
		button.text = str(choice.get("text", "選択肢"))
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.pressed.connect(_on_event_choice_selected.bind(choice))
		choice_container.add_child(button)


func _on_event_choice_selected(choice: Dictionary) -> void:
	_clear_buttons(choice_container)
	_apply_choice_result(choice)
	body_label.text = str(choice.get("result", ""))
	var next_button = Button.new()
	next_button.text = "次へ"
	next_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	next_button.pressed.connect(_show_next_event)
	choice_container.add_child(next_button)


func _apply_choice_result(choice: Dictionary) -> void:
	var stats: Dictionary = choice.get("stats", {})
	for stat_name in stats.keys():
		var amount = int(stats[stat_name])
		PlayerData.add_stat(stat_name, amount)
		GameManager.log_stat_change(stat_name, amount)

	var money_bonus = int(choice.get("money_bonus", 0))
	if money_bonus != 0:
		PlayerData.add_money(money_bonus)
		GameManager.log_money_change(money_bonus)

	var set_flag = str(_current_event.get("set_flag", ""))
	if set_flag != "":
		EventFlags.set_flag(set_flag)


func _finish_shift() -> void:
	header_label.text = "シフト終了"
	body_label.text = "本日のバイト終了。収入 +%d円" % _shift_salary
	_clear_buttons(choice_container)

	var done_button = Button.new()
	done_button.text = "マップへ"
	done_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	done_button.pressed.connect(_finish_action_flow.bind(_shift_advance_steps))
	choice_container.add_child(done_button)


func _do_practice() -> void:
	if not CalendarManager.use_action():
		body_label.text = "行動コマがありません。"
		return

	header_label.text = "練習"
	body_label.text = "何を練習する？"
	_clear_buttons(menu_container)
	_clear_buttons(choice_container)

	var options = [
		{"text": "パッキングの練習", "stat": "technique", "amount": 3, "result": "パッキングの練習をした。手つきが少し良くなった気がする。"},
		{"text": "フレーバーの香りを覚える", "stat": "sense", "amount": 3, "result": "フレーバーの香りを覚えた。微妙な違いが分かるようになってきた。"},
		{"text": "煙のプレゼン練習", "stat": "charm", "amount": 3, "result": "鏡の前で煙の出し方を練習した。見せ方が様になってきた。"},
		{"text": "忙しい時間帯を想定した練習", "stat": "guts", "amount": 3, "result": "タイマーをかけて全力で回した。プレッシャーに少し慣れた。"},
	]
	for option in options:
		var button = Button.new()
		button.text = str(option["text"])
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.pressed.connect(_on_practice_selected.bind(option))
		choice_container.add_child(button)


func _on_practice_selected(option: Dictionary) -> void:
	_clear_buttons(choice_container)
	PlayerData.add_stat(str(option["stat"]), int(option["amount"]))
	GameManager.log_stat_change(str(option["stat"]), int(option["amount"]))
	_show_single_result_and_finish(str(option["result"]))


func _do_sumi_talk() -> void:
	if not CalendarManager.use_action():
		body_label.text = "行動コマがありません。"
		return

	var text = "スミさんと話した。"
	if CalendarManager.current_day == 1:
		text = "スミさん「昼と夜で行動は2回だ。動き方を考えろ」"
		EventFlags.set_flag("ch1_sumi_tournament_talk")
		PlayerData.add_stat("insight", 2)
		GameManager.log_stat_change("insight", 2)
	elif CalendarManager.current_day >= 3:
		text = "スミさんから温度管理のコツを教わった。"
		PlayerData.add_stat("technique", 2)
		PlayerData.add_stat("insight", 1)
		GameManager.log_stat_change("technique", 2)
		GameManager.log_stat_change("insight", 1)

	_show_single_result_and_finish(text)


func _finish_action_flow(step_count: int = 1) -> void:
	for _step in range(step_count):
		CalendarManager.advance_time()
		# Keep mandatory night events reachable even when consuming 2 actions at noon.
		if CalendarManager.current_time == "night" and not CalendarManager.is_interval:
			var forced_event = GameManager.get_forced_event_for_today("night")
			if not forced_event.is_empty():
				break
	if CalendarManager.current_time == "midnight":
		get_tree().change_scene_to_file("res://scenes/daily/night_end.tscn")
		return
	get_tree().change_scene_to_file("res://scenes/daily/map.tscn")


func _show_single_result_and_finish(text: String) -> void:
	body_label.text = text
	_clear_buttons(choice_container)
	var button = Button.new()
	button.text = "次へ"
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.pressed.connect(_finish_action_flow)
	choice_container.add_child(button)


func _on_back_button_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/daily/map.tscn")


func _clear_buttons(container: VBoxContainer) -> void:
	for child in container.get_children():
		child.queue_free()
