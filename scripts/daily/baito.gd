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
var _shift_pending_event_count: int = 0
var _shift_process_steps: Array = []
var _shift_process_index: int = 0
var _shift_process_quality: int = 0
var _shift_process_money_bonus: int = 0

const SHIFT_PROCESS_ORDER := {
	"half": ["packing", "steam"],
	"night": ["packing", "heat_control", "presentation"],
	"full": ["packing", "steam", "heat_control", "presentation"],
}

const SHIFT_PROCESS_DEFINITIONS := {
	"packing": {
		"title": "仕込み: パッキング",
		"text": "営業前にフレーバーを詰める。狙いを決めろ。",
		"practice_tag": "packing",
		"options": [
				{
					"text": "密度を均一に整える",
					"result": "均一に詰めて、立ち上がりを安定させた。",
					"stats": {"technique": 2, "sense": 1},
					"flavor_stats": {"sweet": 1, "fruit": 1},
					"score": 3
				},
				{
					"text": "中心高火力で攻める",
					"result": "中心に熱が入りやすい攻め構成にした。",
					"stats": {"guts": 2, "technique": 1},
					"flavor_stats": {"spice": 2},
					"score": 2
				},
				{
					"text": "空気層を広めに取る",
					"result": "軽めの吸い心地を狙った詰め方にした。",
					"stats": {"sense": 2, "insight": 1},
					"flavor_stats": {"floral": 2},
					"score": 2
				},
		]
	},
	"steam": {
		"title": "仕込み: 蒸らし",
		"text": "蒸らし時間を読み、香りの出方を整える。",
		"practice_tag": "aroma",
		"options": [
				{
					"text": "標準時間で丁寧に待つ",
					"result": "狙いどおりの立ち上がりになった。",
					"stats": {"sense": 2, "technique": 1},
					"flavor_stats": {"sweet": 1, "fruit": 1},
					"score": 3
				},
				{
					"text": "短めでテンポ重視",
					"result": "回転は良いが、調整力が必要な状態になった。",
					"stats": {"guts": 1, "technique": 1},
					"flavor_stats": {"cooling": 2},
					"score": 1
				},
				{
					"text": "長めで余韻重視",
					"result": "香りの厚みが出て、後半が安定した。",
					"stats": {"sense": 2, "insight": 1},
					"flavor_stats": {"floral": 1, "sweet": 1},
					"score": 2
				},
		]
	},
	"heat_control": {
		"title": "営業中: 温度調整",
		"text": "混雑中でも炭と温度を管理し続ける。",
		"practice_tag": "rush",
		"options": [
				{
					"text": "高火力を維持して押し切る",
					"result": "攻めの火力を維持して、印象を残した。",
					"stats": {"guts": 2, "charm": 1},
					"flavor_stats": {"spice": 1, "special": 1},
					"score": 2,
					"money_bonus": 500
				},
				{
					"text": "こまめに炭を調整する",
					"result": "火力の波を抑えて安定提供できた。",
					"stats": {"technique": 2, "insight": 1},
					"flavor_stats": {"cooling": 1, "special": 1},
					"score": 3,
					"money_bonus": 800
				},
				{
					"text": "客の反応を見て配分変更",
					"result": "客の好みに合わせて調整し、満足度が上がった。",
					"stats": {"insight": 2, "charm": 1},
					"flavor_stats": {"fruit": 1, "floral": 1},
					"score": 2,
					"money_bonus": 600
				},
		]
	},
	"presentation": {
		"title": "営業中: 提供と会話",
		"text": "仕上げの一言と出し方で体験を完成させる。",
		"practice_tag": "presentation",
		"options": [
				{
					"text": "味の狙いを短く説明する",
					"result": "説得力ある説明で、納得してもらえた。",
					"stats": {"charm": 2, "insight": 1},
					"flavor_stats": {"floral": 1, "sweet": 1},
					"score": 3,
					"money_bonus": 800
				},
				{
					"text": "リアクション優先で盛り上げる",
					"result": "場が盛り上がり、指名が増えた。",
					"stats": {"charm": 2, "guts": 1},
					"flavor_stats": {"fruit": 1, "special": 1},
					"score": 2,
					"money_bonus": 1000
				},
				{
					"text": "静かに吸い心地へ集中させる",
					"result": "煙そのものの完成度で評価された。",
					"stats": {"sense": 1, "technique": 1, "charm": 1},
					"flavor_stats": {"cooling": 1, "floral": 1},
					"score": 2,
					"money_bonus": 700
				},
		]
	},
}


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
		"talk_sumi":
			_do_sumi_talk()
		"return":
			get_tree().change_scene_to_file("res://scenes/daily/map.tscn")


func _show_shift_menu() -> void:
	body_label.text = "シフトを選んでください"
	_clear_buttons(menu_container)
	if CalendarManager.current_time == "noon":
		_add_menu_button("半日バイト（昼のみ / 基本給+8000円）", "work_half")
		_add_menu_button("夜までバイト（昼+夜 / 基本給+18000円）", "work_full")
	else:
		_add_menu_button("夜バイト（基本給+10000円）", "work_night")
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

	_shift_pending_event_count = event_count
	_shift_process_steps = _build_shift_process_steps(mode)
	_shift_process_index = 0
	_shift_process_quality = 0
	_shift_process_money_bonus = 0
	_show_shift_process_step()


func _build_shift_process_steps(mode: String) -> Array:
	var result: Array = []
	var order: Array = SHIFT_PROCESS_ORDER.get(mode, SHIFT_PROCESS_ORDER["half"])
	for step_id in order:
		if not SHIFT_PROCESS_DEFINITIONS.has(step_id):
			continue
		result.append(SHIFT_PROCESS_DEFINITIONS[step_id])
	return result


func _show_shift_process_step() -> void:
	_clear_buttons(menu_container)
	_clear_buttons(choice_container)
	if _shift_process_index >= _shift_process_steps.size():
		_complete_shift_process()
		return

	var step = _shift_process_steps[_shift_process_index]
	var title = str(step.get("title", "仕込み"))
	header_label.text = "%s (%d/%d)" % [title, _shift_process_index + 1, _shift_process_steps.size()]
	body_label.text = str(step.get("text", ""))

	for option in step.get("options", []):
		var button = Button.new()
		button.text = str(option.get("text", "進める"))
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.pressed.connect(_on_shift_process_option_selected.bind(step, option))
		choice_container.add_child(button)


func _on_shift_process_option_selected(step: Dictionary, option: Dictionary) -> void:
	_clear_buttons(choice_container)
	var lines: Array[String] = [str(option.get("result", "仕込みを進めた。"))]
	var option_stats: Dictionary = option.get("stats", {})
	if not option_stats.is_empty():
		_apply_practice_bonus_stats(option_stats)
		lines.append("基本成長: %s" % _format_stat_changes(option_stats))

	var flavor_stats: Dictionary = option.get("flavor_stats", {})
	if not flavor_stats.is_empty():
		_apply_flavor_specialty_stats(flavor_stats)
		lines.append("得意フレーバー: %s" % _format_flavor_specialty_changes(flavor_stats))

	var practice_tag = str(step.get("practice_tag", ""))
	var bonus_lines = _apply_shift_process_bonus(practice_tag)
	for bonus_line in bonus_lines:
		lines.append(bonus_line)

	var tip_bonus = int(option.get("money_bonus", 0))
	if tip_bonus != 0:
		_shift_process_money_bonus += tip_bonus
		lines.append("接客チップ %+d円" % tip_bonus)

	_shift_process_quality += int(option.get("score", 0))
	body_label.text = "\n".join(lines)

	var next_button = Button.new()
	next_button.text = "次の工程へ"
	next_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	next_button.pressed.connect(_advance_shift_process_step)
	choice_container.add_child(next_button)


func _apply_shift_process_bonus(practice_tag: String) -> Array[String]:
	var lines: Array[String] = []
	if practice_tag == "":
		return lines

	var bonus_result: Dictionary = PlayerData.get_practice_equipment_bonus(practice_tag)
	var bonus_stats: Dictionary = bonus_result.get("stats", {})
	if not bonus_stats.is_empty():
		_apply_practice_bonus_stats(bonus_stats)
		lines.append("装備ボーナス: %s" % _format_stat_changes(bonus_stats))

	var heat_race_result: Dictionary = PlayerData.roll_heat_chicken_race(practice_tag)
	if not heat_race_result.is_empty():
		var heat_stats: Dictionary = heat_race_result.get("stats", {})
		if not heat_stats.is_empty():
			_apply_practice_bonus_stats(heat_stats)
		lines.append(str(heat_race_result.get("text", "")))
		lines.append("チキンレース補正: %s" % _format_stat_changes(heat_stats))

	return lines


func _advance_shift_process_step() -> void:
	_shift_process_index += 1
	_show_shift_process_step()


func _complete_shift_process() -> void:
	var quality_bonus = 0
	if _shift_process_quality >= 10:
		quality_bonus = 2500
		body_label.text = "仕込みがハマった。営業が回りやすくなり売上ボーナス +2500円。"
	elif _shift_process_quality >= 6:
		quality_bonus = 1200
		body_label.text = "仕込みが安定し、売上ボーナス +1200円。"
	else:
		body_label.text = "最低限の仕込みで営業開始。"

	_shift_process_money_bonus += quality_bonus
	_event_queue = _pick_events(_shift_pending_event_count)
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
	var total_salary = _shift_salary + _shift_process_money_bonus
	PlayerData.add_money(total_salary)
	GameManager.log_money_change(total_salary)
	body_label.text = "本日のバイト終了。収入 +%d円（基本 %d円 / 仕込み評価 %+d円）" % [total_salary, _shift_salary, _shift_process_money_bonus]
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
		{"text": "パッキングの練習", "stat": "technique", "amount": 3, "practice_tag": "packing", "result": "パッキングの練習をした。手つきが少し良くなった気がする。"},
		{"text": "フレーバーの香りを覚える", "stat": "sense", "amount": 3, "practice_tag": "aroma", "result": "フレーバーの香りを覚えた。微妙な違いが分かるようになってきた。"},
		{"text": "煙のプレゼン練習", "stat": "charm", "amount": 3, "practice_tag": "presentation", "result": "鏡の前で煙の出し方を練習した。見せ方が様になってきた。"},
		{"text": "忙しい時間帯を想定した練習", "stat": "guts", "amount": 3, "practice_tag": "rush", "result": "タイマーをかけて全力で回した。プレッシャーに少し慣れた。"},
	]
	for option in options:
		var button = Button.new()
		button.text = str(option["text"])
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.pressed.connect(_on_practice_selected.bind(option))
		choice_container.add_child(button)


func _on_practice_selected(option: Dictionary) -> void:
	_clear_buttons(choice_container)
	var base_stat = str(option.get("stat", ""))
	var base_amount = int(option.get("amount", 0))
	if base_stat != "" and base_amount != 0:
		PlayerData.add_stat(base_stat, base_amount)
		GameManager.log_stat_change(base_stat, base_amount)

	var lines: Array[String] = [str(option.get("result", "練習した。"))]
	var practice_tag = str(option.get("practice_tag", ""))
	if practice_tag != "":
		var bonus_result: Dictionary = PlayerData.get_practice_equipment_bonus(practice_tag)
		var bonus_stats: Dictionary = bonus_result.get("stats", {})
		if not bonus_stats.is_empty():
			_apply_practice_bonus_stats(bonus_stats)
			lines.append("装備ボーナス: " + _format_stat_changes(bonus_stats))
			var set_name = str(bonus_result.get("set_name", ""))
			if set_name != "":
				lines.append("現在セット: %s" % set_name)
			var notes: Array = bonus_result.get("notes", [])
			var note_lines: Array[String] = []
			for note in notes:
				note_lines.append(str(note))
			if not note_lines.is_empty():
				lines.append("内訳: " + " / ".join(note_lines))

		var heat_race_result: Dictionary = PlayerData.roll_heat_chicken_race(practice_tag)
		if not heat_race_result.is_empty():
			var heat_stats: Dictionary = heat_race_result.get("stats", {})
			if not heat_stats.is_empty():
				_apply_practice_bonus_stats(heat_stats)
			lines.append(str(heat_race_result.get("text", "")))
			lines.append("チキンレース補正: " + _format_stat_changes(heat_stats))

	_show_single_result_and_finish("\n".join(lines))


func _apply_practice_bonus_stats(bonus_stats: Dictionary) -> void:
	for stat_name in bonus_stats.keys():
		var amount = int(bonus_stats.get(stat_name, 0))
		if amount == 0:
			continue
		PlayerData.add_stat(str(stat_name), amount)
		GameManager.log_stat_change(str(stat_name), amount)


func _format_stat_changes(changes: Dictionary) -> String:
	var stat_order = ["technique", "sense", "guts", "charm", "insight"]
	var stat_labels = {
		"technique": "技術",
		"sense": "味覚",
		"taste": "味覚",
		"guts": "度胸",
		"charm": "魅力",
		"insight": "洞察",
	}
	var parts: Array[String] = []
	for stat_name in stat_order:
		if not changes.has(stat_name):
			continue
		var amount = int(changes.get(stat_name, 0))
		if amount == 0:
			continue
		parts.append("%s %+d" % [str(stat_labels.get(stat_name, stat_name)), amount])
	if parts.is_empty():
		return "なし"
	return ", ".join(parts)


func _apply_flavor_specialty_stats(changes: Dictionary) -> void:
	for category_id in changes.keys():
		var amount = int(changes.get(category_id, 0))
		if amount == 0:
			continue
		PlayerData.add_flavor_specialty(str(category_id), amount)


func _format_flavor_specialty_changes(changes: Dictionary) -> String:
	var parts: Array[String] = []
	for category_id in PlayerData.FLAVOR_SPECIALTY_KEYS:
		if not changes.has(category_id):
			continue
		var amount = int(changes.get(category_id, 0))
		if amount == 0:
			continue
		parts.append("%s %+d" % [PlayerData.get_flavor_specialty_label(category_id), amount])
	if parts.is_empty():
		for raw_key in changes.keys():
			var amount = int(changes.get(raw_key, 0))
			if amount == 0:
				continue
			parts.append("%s %+d" % [PlayerData.get_flavor_specialty_label(str(raw_key)), amount])
	if parts.is_empty():
		return "なし"
	return ", ".join(parts)


func _do_sumi_talk() -> void:
	if not CalendarManager.use_action():
		body_label.text = "行動コマがありません。"
		return

	var text = "スミさんと話した。"
	if CalendarManager.current_day == 1:
		text = "スミさん「昼と夜で行動は2回だ。動き方を考えろ」"
		EventFlags.set_flag("ch1_sumi_tournament_talk")
		PlayerData.add_stat("insight", 2)
		PlayerData.add_flavor_specialty("special", 1)
		GameManager.log_stat_change("insight", 2)
	elif CalendarManager.current_day >= 3:
		text = "スミさんから温度管理のコツを教わった。"
		PlayerData.add_stat("technique", 2)
		PlayerData.add_stat("insight", 1)
		PlayerData.add_flavor_specialty("spice", 1)
		PlayerData.add_flavor_specialty("cooling", 1)
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
