extends Control

const TOTAL_STEPS := 15
const TOURNAMENT_SCENE_PATH := "res://scenes/tournament/ch4_tournament.tscn"
const MORNING_PHONE_SCENE_PATH := "res://scenes/daily/morning_phone.tscn"
const TITLE_SCENE_PATH := "res://scenes/title/title_screen.tscn"

const FLAVOR_NAME_MAP := {
	"double_apple": "アルファーヘブン ダブルアップル",
	"mint": "アルファーヘブン ミント",
	"blueberry": "アルファーヘブン ブルーベリー",
	"vanilla": "アルファーヘブン バニラ",
	"pineapple": "アルファーヘブン パイナップル",
	"coconut": "アルファーヘブン ココナッツ",
}

const ALPHA_HEAVEN_FLAVORS := ["double_apple", "mint", "blueberry", "vanilla", "pineapple", "coconut"]

const THEMES := [
	{"id": "relax", "name": "リラックス", "flavors": ["vanilla", "coconut", "pineapple"]},
	{"id": "high_heat", "name": "高火力", "flavors": ["mint", "double_apple"]},
	{"id": "fruity", "name": "フルーツ", "flavors": ["pineapple", "blueberry", "double_apple"]},
	{"id": "aftertaste", "name": "余韻", "flavors": ["vanilla", "blueberry", "coconut"]},
]

const RANDOM_JUDGES := [
	{"id": "shiramine", "name": "白峰 恒一郎", "flavors": ["vanilla", "coconut", "pineapple"]},
	{"id": "maezono", "name": "前園 壮一郎", "flavors": ["mint", "double_apple"]},
	{"id": "kirishima", "name": "霧島 レン", "flavors": ["blueberry", "pineapple"]},
]

const STANCE_PREFERENCE := {
	"toki_kotetsu": "tech",
	"shiramine": "honest",
	"maezono": "aggressive",
	"kirishima": "heart",
}

const REBUTTAL_PROMPTS := [
	{
		"question": "土岐: 火力が強すぎるんじゃないか？",
		"best": "reframe",
	},
	{
		"question": "審査員: その配合で狙いは伝わるのか？",
		"best": "front",
	},
	{
		"question": "審査員: リスクを取りすぎてないか？",
		"best": "admit",
	},
]

const REWARD_BY_RANK := {1: 300000, 2: 150000, 3: 50000, 4: 0}
const PULL_DIFFICULTY := [0.86, 1.0, 1.22, 1.06]
const TOTAL_PACKING_GRAMS := 12
const PULL_MIN_ROUNDS := 2
const PULL_MAX_ROUNDS := 6
const MIND_BARRAGE_BASE_LIVES := 3
const MIND_BARRAGE_WORST_PULL_SPEED := 2.35
const MIND_BARRAGE_MIN_SECONDS := 8.0
const MIND_BARRAGE_MAX_SECONDS := 16.0
const MIND_BARRAGE_WORDS := [
	"もっと甘くすべきだった？",
	"あいつの方が評価高そう",
	"審査員、これ嫌いじゃないか？",
	"前のラウンド、負けてるぞ",
	"「無難」に逃げた方がよかったか？",
	"前に失敗した時と同じ流れだ",
	"この配合、攻めすぎじゃないか？",
	"安全策に寄せた方がよくないか？",
	"その個性、ただの自己満足では？",
]
const TEMP_MIN := 140.0
const TEMP_MAX := 260.0
const PRESENTATION_FOCUS_OPTIONS := [
	{"id": "taste", "name": "味"},
	{"id": "smoke", "name": "煙"},
	{"id": "ease", "name": "吸いやすさ"},
	{"id": "unique", "name": "個性"},
]
const JUDGE_FOCUS_PREFERENCES := {
	"toki_kotetsu": ["taste", "smoke"],
	"shiramine": ["ease", "taste"],
	"maezono": ["smoke", "unique"],
	"kirishima": ["unique", "ease"],
}
const PRESENTATION_FOCUS_LABEL := {
	"taste": "味",
	"smoke": "煙",
	"ease": "吸いやすさ",
	"unique": "個性",
}


@onready var header_label: Label = %HeaderLabel
@onready var phase_label: Label = %PhaseLabel
@onready var info_label: RichTextLabel = %InfoLabel
@onready var choice_container: VBoxContainer = %ChoiceContainer
@onready var judge_label: Label = %JudgeLabel
@onready var score_label: RichTextLabel = %ScoreLabel
@onready var memo_label: RichTextLabel = %MemoLabel

@onready var status_panel = $SidePanel/SideMargin/SideVBox/StatusPanel

var _theme: Dictionary = {}
var _random_judge: Dictionary = {}
var _selected_bowl: String = ""
var _selected_hms: String = ""
var _selected_flavors: Array[String] = []
var _flavor_checks: Array[CheckBox] = []
var _packing_choice: Dictionary = {}
var _manual_packing_grams: Dictionary = {}
var _special_mix_name: String = ""
var _selected_charcoal_count: int = 3
var _steam_minutes: int = 6
var _heat_state: int = 0
var _zone_bonus: float = 0.0
var _adjustment_hits: int = 0
var _pull_round: int = 0
var _technical_points: float = 0.0
var _audience_points: float = 0.0
var _memo_bonus: float = 0.0
var _used_memo_count: int = 0
var _easy_mode: bool = false
var _pending_reward: int = 0
var _player_rank: int = 4
var _rebuttal_prompt: Dictionary = {}
var _pull_hit_count: int = 0
var _pull_quality_total: float = 0.0
var _pull_gauge_value: float = 0.5
var _pull_gauge_direction: float = 1.0
var _pull_gauge_speed: float = 1.0
var _pull_target_center: float = 0.5
var _pull_target_width: float = 0.16
var _pull_timer: Timer
var _pull_is_holding: bool = false
var _pull_step_resolved: bool = false
var _pull_hold_button: Button
var _pull_setting_hint: String = ""

var _adjust_target_action: String = ""
var _adjust_selected_action: String = ""
var _adjustment_action_count: int = 0
var _adjust_gauge_value: float = 0.5
var _adjust_gauge_direction: float = 1.0
var _adjust_gauge_speed: float = 1.0
var _adjust_target_center: float = 0.5
var _adjust_target_width: float = 0.18
var _adjust_timer: Timer
var _adjust_is_holding: bool = false
var _adjust_step_finished: bool = false
var _adjust_success_count: int = 0

var _mind_timer: Timer
var _mind_active: bool = false
var _mind_arena_layer: ColorRect
var _mind_player_node: ColorRect
var _mind_bullets: Array[Dictionary] = []
var _mind_player_pos: Vector2 = Vector2.ZERO
var _mind_player_size: Vector2 = Vector2(14, 14)
var _mind_duration_total: float = 0.0
var _mind_elapsed: float = 0.0
var _mind_spawn_cooldown: float = 0.0
var _mind_spawn_interval: float = 0.45
var _mind_hits: int = 0
var _mind_spawned: int = 0
var _mind_hit_se_cooldown: float = 0.0
var _mind_barrage_done: bool = false
var _mind_lives_max: int = MIND_BARRAGE_BASE_LIVES
var _mind_lives_remaining: int = MIND_BARRAGE_BASE_LIVES
var _mind_pull_speed_adjust: float = 0.0
var _mind_force_worst_pull_speed: bool = false
var _mind_move_left: bool = false
var _mind_move_right: bool = false
var _mind_move_up: bool = false
var _mind_move_down: bool = false
var _mind_invincible_timer: float = 0.0
var _aluminum_timer: Timer
var _aluminum_active: bool = false
var _aluminum_slot_count: int = 12
var _aluminum_required_hits: int = 6
var _aluminum_total_notes: int = 8
var _aluminum_notes: Array[Dictionary] = []
var _aluminum_notes_spawned: int = 0
var _aluminum_spawn_interval_ticks: int = 2
var _aluminum_spawn_cooldown: int = 0
var _aluminum_hit_slot: int = 0
var _aluminum_hit_perfect: int = 0
var _aluminum_hit_good: int = 0
var _aluminum_hit_near: int = 0
var _aluminum_hit_miss: int = 0
var _aluminum_bad_press: int = 0
var _packing_sliders: Dictionary = {}
var _packing_value_labels: Dictionary = {}
var _packing_remaining_label: Label
var _packing_confirm_button: Button
var _rival_mid_scores: Array = []
var _rival_final_scores: Array = []
var _mid_player_total: float = 0.0
var _mid_rival_totals: Dictionary = {}
var _presentation_primary_focus: String = ""
var _presentation_secondary_focus: String = ""

func _process(_delta: float) -> void:
	if status_panel and status_panel.has_method("update_status"):
		var mapped_temp = clampf(0.5 + float(_heat_state) * 0.1, 0.0, 1.0)
		var pass_line = 0.5 - 0.1
		var top_line = 0.5 + 0.1
		var zone_text = "適温"
		if _heat_state >= 2:
			zone_text = "熱い"
		elif _heat_state <= -2:
			zone_text = "弱い"
		status_panel.update_status(mapped_temp, zone_text, _selected_charcoal_count, pass_line, top_line)

func _ready() -> void:
	randomize()
	GameManager.play_bgm(GameManager.BGM_TONARI_PATH, -8.0, true)
	_pull_timer = Timer.new()
	_pull_timer.wait_time = 0.03
	_pull_timer.one_shot = false
	_pull_timer.timeout.connect(_on_pull_gauge_tick)
	add_child(_pull_timer)
	
	_adjust_timer = Timer.new()
	_adjust_timer.wait_time = 0.03
	_adjust_timer.one_shot = false
	_adjust_timer.timeout.connect(_on_adjust_timer_tick)
	add_child(_adjust_timer)

	_aluminum_timer = Timer.new()
	_aluminum_timer.wait_time = 0.16
	_aluminum_timer.one_shot = false
	_aluminum_timer.timeout.connect(_on_aluminum_tick)
	add_child(_aluminum_timer)
	_mind_timer = Timer.new()
	_mind_timer.wait_time = 0.016
	_mind_timer.one_shot = false
	_mind_timer.timeout.connect(_on_mind_barrage_tick)
	add_child(_mind_timer)
	if GameManager.game_state != "tournament":
		GameManager.transition_to_tournament()
	_prepare_run()


func _prepare_run() -> void:
	_theme = THEMES[randi() % THEMES.size()]
	_random_judge = RANDOM_JUDGES[randi() % RANDOM_JUDGES.size()]
	_selected_bowl = PlayerData.equipment_bowl
	_selected_hms = PlayerData.equipment_hms
	_selected_flavors.clear()
	_flavor_checks.clear()
	_packing_choice.clear()
	_manual_packing_grams.clear()
	_special_mix_name = ""
	_selected_charcoal_count = 3
	_steam_minutes = 6
	_heat_state = 0
	_zone_bonus = 0.0
	_adjustment_hits = 0
	_pull_round = 0
	_pending_reward = 0
	_player_rank = 4
	_used_memo_count = 0
	_memo_bonus = 0.0
	_rebuttal_prompt = {}
	_pull_hit_count = 0
	_pull_quality_total = 0.0
	_pull_timer.stop()
	_pull_is_holding = false
	_pull_step_resolved = false
	_pull_hold_button = null
	_pull_setting_hint = ""
	_stop_mind_barrage()
	_mind_duration_total = 0.0
	_mind_elapsed = 0.0
	_mind_spawn_cooldown = 0.0
	_mind_spawn_interval = 0.45
	_mind_hits = 0
	_mind_spawned = 0
	_mind_hit_se_cooldown = 0.0
	_mind_barrage_done = false
	_mind_lives_max = MIND_BARRAGE_BASE_LIVES
	_mind_lives_remaining = MIND_BARRAGE_BASE_LIVES
	_mind_pull_speed_adjust = 0.0
	_mind_force_worst_pull_speed = false
	_aluminum_active = false
	_aluminum_notes.clear()
	_aluminum_notes_spawned = 0
	_aluminum_spawn_interval_ticks = 2
	_aluminum_spawn_cooldown = 0
	_aluminum_hit_perfect = 0
	_aluminum_hit_good = 0
	_aluminum_hit_near = 0
	_aluminum_hit_miss = 0
	_aluminum_bad_press = 0
	_aluminum_timer.stop()
	_packing_sliders.clear()
	_packing_value_labels.clear()
	_packing_remaining_label = null
	_packing_confirm_button = null
	_rival_mid_scores.clear()
	_rival_final_scores.clear()
	_mid_player_total = 0.0
	_mid_rival_totals.clear()
	_presentation_primary_focus = ""
	_presentation_secondary_focus = ""
	_easy_mode = bool(EventFlags.get_value("ch1_tournament_easy_mode", false))
	_prepare_rival_score_tables()

	_technical_points = PlayerData.stat_technique * 0.9 + PlayerData.stat_sense * 0.7 + PlayerData.stat_guts * 0.5
	_audience_points = PlayerData.stat_charm * 0.9 + PlayerData.stat_insight * 0.25
	if _easy_mode:
		_technical_points += 4.0
		_audience_points += 2.0

	PlayerData.mark_all_tournament_memos_read()
	_show_setting_step()
	_refresh_side_panel()


func _set_phase(step_num: int, title: String, body: String) -> void:
	header_label.text = title
	phase_label.text = "STEP %d / %d" % [step_num, TOTAL_STEPS]
	info_label.text = body


func _append_info(text: String) -> void:
	if text.strip_edges() == "":
		return
	if info_label.text.strip_edges() == "":
		info_label.text = text
	else:
		info_label.text += "\n\n" + text


func _clear_choices() -> void:
	_stop_mind_barrage()
	for child in choice_container.get_children():
		child.queue_free()
	_pull_timer.stop()
	_pull_is_holding = false
	_pull_hold_button = null
	_aluminum_active = false
	_aluminum_timer.stop()
	_packing_sliders.clear()
	_packing_value_labels.clear()
	_packing_remaining_label = null
	_packing_confirm_button = null


func _add_choice_button(text: String, callback: Callable) -> Button:
	var button = Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(0, 40)
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.pressed.connect(func() -> void:
		GameManager.play_ui_se("cursor")
		callback.call()
	)
	choice_container.add_child(button)
	return button


func _show_setting_step() -> void:
	_set_phase(1, "大会セッティング", "会場入り。先にハガルとHMSを決める。\nテーマ: %s" % str(_theme.get("name", "-")))
	_clear_choices()

	_add_selector_group("ハガル", PlayerData.owned_bowls, _selected_bowl, _on_bowl_selected)
	_add_selector_group("ヒートマネジメント", PlayerData.owned_hms, _selected_hms, _on_hms_selected)

	var pairing_ok = PlayerData.is_equipment_pair_compatible(_selected_bowl, _selected_hms)
	if pairing_ok:
		_append_info("現在の組み合わせ: %s + %s" % [
			PlayerData.get_equipment_name_by_value(_selected_bowl),
			PlayerData.get_equipment_name_by_value(_selected_hms),
		])
	else:
		_append_info("現在の組み合わせは非対応。選び直して。")

	if _easy_mode:
		_append_info("難易度緩和モード: 吸い出し判定が少し広い。")

	_add_choice_button("このセッティングで開始", _on_setting_confirmed)
	_refresh_side_panel()


func _add_selector_group(title_text: String, ids: Array, selected_id: String, on_select: Callable) -> void:
	var title = Label.new()
	title.text = title_text
	title.add_theme_font_size_override("font_size", 20)
	choice_container.add_child(title)

	for raw_id in ids:
		var item_id = str(raw_id)
		var button = Button.new()
		var prefix = "●" if item_id == selected_id else "○"
		button.text = "%s %s" % [prefix, PlayerData.get_equipment_name_by_value(item_id)]
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.pressed.connect(on_select.bind(item_id))
		choice_container.add_child(button)


func _on_bowl_selected(bowl_id: String) -> void:
	_selected_bowl = bowl_id
	_show_setting_step()


func _on_hms_selected(hms_id: String) -> void:
	_selected_hms = hms_id
	_show_setting_step()


func _on_setting_confirmed() -> void:
	if _selected_bowl == "" or _selected_hms == "":
		_append_info("ハガルとHMSを選択して。")
		return
	if not PlayerData.is_equipment_pair_compatible(_selected_bowl, _selected_hms):
		_append_info("その組み合わせは非対応。")
		return

	PlayerData.equip_item("bowl", _selected_bowl)
	PlayerData.equip_item("hms", _selected_hms)
	_apply_setting_bonus()
	_refresh_side_panel()
	_show_flavor_selection_step()


func _apply_setting_bonus() -> void:
	var lines: Array[String] = []
	if _selected_bowl == "hagal_80beat":
		_technical_points += 3.0
		lines.append("80beatハガルで立ち上がり安定。")
	elif _selected_bowl == "suyaki":
		_technical_points += 1.0
		_audience_points += 2.0
		lines.append("素焼きで香りの個性が乗りやすい。")

	match _selected_hms:
		"tanukish_lid":
			_technical_points += 4.0
			_zone_bonus += 0.12
			lines.append("タヌキッシュで扱いやすさアップ。")
		"amaburst":
			_technical_points += 3.0
			_audience_points += 2.0
			_heat_state += 1
			lines.append("アマバーストで高火力寄り。")
		"winkwink_hagal":
			_technical_points += 2.0
			_heat_state -= 1
			lines.append("winkwinkで熱持ち重視。")
		_:
			_technical_points += 2.0
			lines.append("ロートスで再現性重視。")

	if not lines.is_empty():
		_append_info("\n".join(lines))
	_heat_state = clampi(_heat_state, -3, 3)


func _show_flavor_selection_step() -> void:
	_set_phase(2, "フレーバー選択", "在庫から1〜3種を選ぶ。テーマ一致でボーナス。")
	_clear_choices()
	_flavor_checks.clear()

	var available = _get_available_flavors()
	if available.is_empty():
		PlayerData.add_flavor("double_apple", 50)
		PlayerData.add_flavor("mint", 50)
		available = _get_available_flavors()
		_append_info("在庫不足のため運営配布フレーバー(50g×2)を受け取った。")

	for entry in available:
		var check = CheckBox.new()
		var flavor_id = str(entry.get("id", ""))
		check.text = "%s（残り %dg）" % [_flavor_name(flavor_id), int(entry.get("amount", 0))]
		check.set_meta("flavor_id", flavor_id)
		check.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		choice_container.add_child(check)
		_flavor_checks.append(check)

	if _flavor_checks.size() == 1:
		_flavor_checks[0].button_pressed = true

	_add_choice_button("おすすめを自動選択", _apply_recommended_flavors)
	_add_choice_button("この配合候補で進む", _confirm_flavor_selection)

	var memo_count = PlayerData.get_tournament_memos().size()
	if memo_count > 0:
		_append_info("攻略メモ %d件を参照可能。" % memo_count)

	_refresh_side_panel()


func _get_available_flavors() -> Array:
	var result: Array = []
	for raw in PlayerData.flavor_inventory:
		if typeof(raw) != TYPE_DICTIONARY:
			continue
		var amount = int(raw.get("amount", 0))
		if amount <= 0:
			continue
		result.append({
			"id": str(raw.get("id", "")),
			"amount": amount,
		})
	return result


func _apply_recommended_flavors() -> void:
	for check in _flavor_checks:
		check.button_pressed = false

	var theme_flavors: Array = _theme.get("flavors", [])
	for check in _flavor_checks:
		var flavor_id = str(check.get_meta("flavor_id"))
		if theme_flavors.has(flavor_id):
			check.button_pressed = true
		if _count_checked_flavors() >= 3:
			break

	var min_pick = mini(2, _flavor_checks.size())
	if _count_checked_flavors() < min_pick:
		for check in _flavor_checks:
			if not check.button_pressed:
				check.button_pressed = true
			if _count_checked_flavors() >= min_pick:
				break

	_append_info("テーマ寄りの候補を自動選択した。")


func _count_checked_flavors() -> int:
	var count = 0
	for check in _flavor_checks:
		if check.button_pressed:
			count += 1
	return count


func _confirm_flavor_selection() -> void:
	var selected: Array[String] = []
	for check in _flavor_checks:
		if not check.button_pressed:
			continue
		selected.append(str(check.get_meta("flavor_id")))

	if selected.is_empty():
		_append_info("最低1種は選択して。")
		return
	if selected.size() > 3:
		_append_info("フレーバーは3種まで。")
		return

	_selected_flavors = selected
	var lines: Array[String] = []

	var theme_hits = _count_theme_hits(_selected_flavors)
	if theme_hits >= 2:
		_technical_points += 10.0
		_audience_points += 8.0
		lines.append("テーマ一致で大きく加点。")
	elif theme_hits == 1:
		_technical_points += 4.0
		_audience_points += 3.0
		lines.append("テーマに部分一致。")
	else:
		_technical_points -= 4.0
		lines.append("テーマ不一致で減点。")

	if _selected_flavors.size() == 1:
		_technical_points -= 6.0
		_audience_points -= 3.0
		lines.append("単体配合のため審査が厳しくなる。")

	if (_selected_hms == "amaburst" or PlayerData.equipment_charcoal == "cube_charcoal") and _has_alpha_heaven_flavor_selected():
		_technical_points += 4.0
		_audience_points += 4.0
		lines.append("高火力×アルファーヘブン戦略が刺さった。")

	_used_memo_count = _count_matching_memos(_selected_flavors)
	if _used_memo_count > 0:
		_memo_bonus = float(_used_memo_count * 3)
		_technical_points += _memo_bonus
		lines.append("攻略メモ参照ボーナス +%d" % int(_memo_bonus))

	_append_info("\n".join(lines))
	_refresh_side_panel()
	_show_packing_step()


func _show_packing_step() -> void:
	_set_phase(3, "パッキング配合（12g）", "各フレーバーのゲージを動かして配分を決める。合計12gで確定。")
	_clear_choices()
	_ensure_manual_packing_grams()
	_packing_sliders.clear()
	_packing_value_labels.clear()

	var title = Label.new()
	title.text = "配分ゲージ（1g刻み）"
	title.add_theme_font_size_override("font_size", 20)
	choice_container.add_child(title)

	for flavor_id in _selected_flavors:
		choice_container.add_child(_build_packing_slider_row(flavor_id))

	_packing_remaining_label = Label.new()
	choice_container.add_child(_packing_remaining_label)

	_packing_confirm_button = _add_choice_button("この配合で確定", _confirm_manual_packing)
	_refresh_packing_controls()

	_refresh_side_panel()


func _update_packing_info_text() -> void:
	var total = _sum_manual_packing_grams()
	var remaining = TOTAL_PACKING_GRAMS - total
	var lines: Array[String] = []
	lines.append("現在配合: %s" % _format_pattern_grams({"grams": _manual_packing_grams}))
	lines.append("合計: %dg / %dg" % [total, TOTAL_PACKING_GRAMS])
	if remaining == 0:
		lines.append("確定可能")
	elif remaining < 0:
		lines.append("%dg 超過。12gに戻して。" % abs(remaining))
	else:
		lines.append("残り %dg を配分して。" % remaining)
	info_label.text = "\n".join(lines)


func _ensure_manual_packing_grams() -> void:
	var needs_reset = _manual_packing_grams.is_empty() or _manual_packing_grams.size() != _selected_flavors.size()
	if not needs_reset:
		for flavor_id in _selected_flavors:
			if not _manual_packing_grams.has(flavor_id):
				needs_reset = true
				break
	if not needs_reset:
		return

	_manual_packing_grams.clear()
	var count = maxi(1, _selected_flavors.size())
	var base_grams = int(TOTAL_PACKING_GRAMS / count)
	var remainder = TOTAL_PACKING_GRAMS % count
	for i in range(_selected_flavors.size()):
		var flavor_id = _selected_flavors[i]
		var grams = base_grams
		if i < remainder:
			grams += 1
		_manual_packing_grams[flavor_id] = grams


func _build_packing_slider_row(flavor_id: String) -> Control:
	var wrapper = VBoxContainer.new()
	wrapper.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	wrapper.add_theme_constant_override("separation", 4)

	var label = Label.new()
	label.text = "%s  %dg" % [_flavor_name(flavor_id), int(_manual_packing_grams.get(flavor_id, 0))]
	wrapper.add_child(label)
	_packing_value_labels[flavor_id] = label

	var slider = HSlider.new()
	slider.min_value = 0
	slider.max_value = TOTAL_PACKING_GRAMS
	slider.step = 1
	slider.value = int(_manual_packing_grams.get(flavor_id, 0))
	slider.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	slider.value_changed.connect(_on_packing_slider_changed.bind(flavor_id))
	wrapper.add_child(slider)
	_packing_sliders[flavor_id] = slider

	return wrapper


func _on_packing_slider_changed(value: float, flavor_id: String) -> void:
	var grams = int(round(value))
	_manual_packing_grams[flavor_id] = grams
	_refresh_packing_controls()


func _refresh_packing_controls() -> void:
	for flavor_id in _selected_flavors:
		var grams = int(_manual_packing_grams.get(flavor_id, 0))
		if _packing_value_labels.has(flavor_id):
			var label = _packing_value_labels[flavor_id] as Label
			if label != null:
				label.text = "%s  %dg" % [_flavor_name(flavor_id), grams]
		if _packing_sliders.has(flavor_id):
			var slider = _packing_sliders[flavor_id] as HSlider
			if slider != null and int(round(slider.value)) != grams:
				slider.value = grams

	var total = _sum_manual_packing_grams()
	var remaining = TOTAL_PACKING_GRAMS - total
	if _packing_remaining_label != null:
		if remaining == 0:
			_packing_remaining_label.text = "残り: 0g（確定可能）"
		elif remaining > 0:
			_packing_remaining_label.text = "残り: %dg" % remaining
		else:
			_packing_remaining_label.text = "超過: %dg（12gに戻して）" % abs(remaining)

	if _packing_confirm_button != null:
		_packing_confirm_button.disabled = remaining != 0

	_update_packing_info_text()


func _sum_manual_packing_grams() -> int:
	var total = 0
	for flavor_id in _selected_flavors:
		total += int(_manual_packing_grams.get(flavor_id, 0))
	return total


func _confirm_manual_packing() -> void:
	var total = _sum_manual_packing_grams()
	if total != TOTAL_PACKING_GRAMS:
		GameManager.play_ui_se("cancel")
		_append_info("合計12gにしてから確定して。")
		return
	var pattern = {
		"label": "手動配合",
		"style": "custom",
		"grams": _manual_packing_grams.duplicate(true),
	}
	GameManager.play_ui_se("confirm")

	# パッキング確定時にフレーバーを消費
	var consume_lines: Array[String] = []
	for flavor_id in _selected_flavors:
		var grams = int(_manual_packing_grams.get(flavor_id, 0))
		if grams > 0:
			if PlayerData.can_use_flavor(flavor_id, grams):
				if not GameManager.get_transient("is_shop_practice", false):
					PlayerData.use_flavor(flavor_id, grams)
				consume_lines.append("%s %dg 使用" % [_flavor_name(flavor_id), grams])
			else:
				var remaining = PlayerData.get_flavor_amount(flavor_id)
				_append_info("%sの残量が%dgしかありません。配分を見直してください。" % [_flavor_name(flavor_id), remaining])
				GameManager.play_ui_se("cancel")
				return
	if not consume_lines.is_empty():
		_append_info("\n".join(consume_lines))

	_on_packing_selected(pattern)


func _format_pattern_grams(pattern: Dictionary) -> String:
	var grams: Dictionary = pattern.get("grams", {})
	var parts: Array[String] = []
	for flavor_id in _selected_flavors:
		if not grams.has(flavor_id):
			continue
		parts.append("%s %dg" % [_flavor_name(flavor_id), int(grams.get(flavor_id, 0))])
	return " / ".join(parts)


func _on_packing_selected(pattern: Dictionary) -> void:
	_packing_choice = pattern.duplicate(true)
	var grams: Dictionary = _packing_choice.get("grams", {})
	var style = str(_packing_choice.get("style", "balanced"))
	var delta_spec = 8.0
	var delta_aud = 0.0
	var lines: Array[String] = []

	match style:
		"balanced":
			delta_spec += 4.0 + PlayerData.stat_sense * 0.05
			lines.append("配合バランスが良い。")
		"tight":
			delta_spec += 6.0 + PlayerData.stat_technique * 0.04
			_heat_state += 1
			lines.append("高密度で火力寄り。")
		"airy":
			delta_spec += 3.0 + PlayerData.stat_sense * 0.04
			_heat_state -= 1
			lines.append("軽い立ち上がり。")
		"heat":
			delta_spec += 5.0 + PlayerData.stat_guts * 0.05
			delta_aud += 3.0
			lines.append("攻めた高火力寄せ。")
		"custom":
			var values: Array[int] = []
			for flavor_id in _selected_flavors:
				var gram = int(grams.get(flavor_id, 0))
				if gram > 0:
					values.append(gram)
			if values.size() <= 1:
				delta_spec += 4.0 + PlayerData.stat_technique * 0.03
				lines.append("単体寄りの手動配合。")
			else:
				values.sort()
				var spread = int(values[values.size() - 1]) - int(values[0])
				if spread <= 1:
					delta_spec += 6.0 + PlayerData.stat_sense * 0.04
					lines.append("手動配合のバランスが良い。")
				elif int(values[values.size() - 1]) >= 7:
					delta_spec += 5.0 + PlayerData.stat_guts * 0.04
					delta_aud += 2.0
					lines.append("主軸を立てた手動配合。")
				else:
					delta_spec += 4.0 + PlayerData.stat_insight * 0.04
					lines.append("狙いを持った手動配合。")
		_:
			delta_spec += 4.0 + PlayerData.stat_insight * 0.05
			lines.append("主軸フレーバーを明確化。")

	var theme_hits = _count_theme_hits(_selected_flavors)
	if theme_hits <= 0:
		delta_spec -= 3.0
	else:
		delta_spec += float(theme_hits) * 1.8

	for favored in _random_judge.get("flavors", []):
		var flavor_id = str(favored)
		if grams.has(flavor_id):
			delta_spec += 1.5

	var special = _detect_special_mix(_packing_choice)
	if not special.is_empty():
		_special_mix_name = str(special.get("name", ""))
		delta_spec += float(special.get("spec", 0.0))
		delta_aud += float(special.get("aud", 0.0))
		lines.append(str(special.get("text", "")))

	_technical_points += delta_spec
	_audience_points += delta_aud
	_heat_state = clampi(_heat_state, -3, 3)

	lines.append("専門 %+d / 一般 %+d" % [int(round(delta_spec)), int(round(delta_aud))])
	_show_step_result_and_next("\n".join(lines), _show_aluminum_step)


func _detect_special_mix(pattern: Dictionary) -> Dictionary:
	var grams: Dictionary = pattern.get("grams", {})
	if grams.has("pineapple") and grams.has("coconut") and grams.has("vanilla"):
		var values = [int(grams.get("pineapple", 0)), int(grams.get("coconut", 0)), int(grams.get("vanilla", 0))]
		values.sort()
		if values == [3, 4, 5]:
			return {
				"name": "ピニャコラーダ",
				"spec": 8.0,
				"aud": 8.0,
				"text": "特別ミックス『ピニャコラーダ』成立。",
			}

	if grams.size() == 1 and grams.has("mint"):
		return {
			"name": "地獄のメンソール",
			"spec": 2.0,
			"aud": 10.0,
			"text": "特別ミックス『地獄のメンソール』。観客が沸く。",
		}

	return {}


func _show_aluminum_step() -> void:
	_set_phase(4, "アルミ穴あけ", "円形レーンの判定点にノーツが来たら叩く。Taiko風のタイミング勝負。")
	_clear_choices()
	_aluminum_active = true
	_aluminum_notes.clear()
	_aluminum_notes_spawned = 0
	_aluminum_spawn_cooldown = 0
	_aluminum_hit_slot = 0
	_aluminum_hit_perfect = 0
	_aluminum_hit_good = 0
	_aluminum_hit_near = 0
	_aluminum_hit_miss = 0
	_aluminum_bad_press = 0
	_aluminum_required_hits = 6
	_aluminum_total_notes = 8

	var beat_wait = 0.16
	match _selected_hms:
		"tanukish_lid":
			beat_wait += 0.02
		"amaburst":
			beat_wait -= 0.02
		"winkwink_hagal":
			beat_wait += 0.01
	match _selected_bowl:
		"silicone_bowl":
			beat_wait += 0.01
		"suyaki":
			beat_wait -= 0.01
	if _easy_mode:
		beat_wait += 0.03
	_aluminum_spawn_interval_ticks = 2
	if _selected_hms == "tanukish_lid":
		_aluminum_spawn_interval_ticks += 1
	elif _selected_hms == "amaburst":
		_aluminum_spawn_interval_ticks -= 1
	if _selected_bowl == "suyaki":
		_aluminum_spawn_interval_ticks -= 1
	if _easy_mode:
		_aluminum_spawn_interval_ticks += 1
	_aluminum_spawn_interval_ticks = clampi(_aluminum_spawn_interval_ticks, 1, 4)
	_aluminum_timer.wait_time = clampf(beat_wait, 0.09, 0.28)
	_aluminum_timer.start()
	_spawn_aluminum_note()

	var press_button = Button.new()
	press_button.text = "ドン（穴を開ける）"
	press_button.custom_minimum_size = Vector2(0, 44)
	press_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	press_button.pressed.connect(_on_aluminum_press_hole)
	choice_container.add_child(press_button)
	_refresh_side_panel()
	_update_aluminum_rhythm_text()


func _on_aluminum_tick() -> void:
	if not _aluminum_active:
		return
	for i in range(_aluminum_notes.size() - 1, -1, -1):
		var note = _aluminum_notes[i]
		note["distance"] = float(note.get("distance", 0.0)) - 1.0
		if float(note.get("distance", 0.0)) < -1.8:
			_aluminum_hit_miss += 1
			_aluminum_notes.remove_at(i)
		else:
			_aluminum_notes[i] = note

	if _aluminum_notes_spawned < _aluminum_total_notes:
		if _aluminum_spawn_cooldown <= 0:
			_spawn_aluminum_note()
		else:
			_aluminum_spawn_cooldown -= 1

	if _aluminum_notes_spawned >= _aluminum_total_notes and _aluminum_notes.is_empty():
		_finish_aluminum_rhythm()
		return
	_update_aluminum_rhythm_text()


func _spawn_aluminum_note() -> void:
	if _aluminum_notes_spawned >= _aluminum_total_notes:
		return
	_aluminum_notes.append({"distance": _get_aluminum_start_distance()})
	_aluminum_notes_spawned += 1
	_aluminum_spawn_cooldown = _aluminum_spawn_interval_ticks


func _get_aluminum_start_distance() -> float:
	var distance = float(_aluminum_slot_count - 2)
	if _selected_hms == "amaburst":
		distance -= 1.0
	elif _selected_hms == "tanukish_lid":
		distance += 1.0
	if _easy_mode:
		distance += 1.0
	return clampf(distance, 6.0, float(_aluminum_slot_count + 2))


func _on_aluminum_press_hole() -> void:
	if not _aluminum_active:
		return
	var nearest_index = -1
	var nearest_distance = 999.0
	for i in range(_aluminum_notes.size()):
		var note = _aluminum_notes[i]
		var distance = abs(float(note.get("distance", 999.0)))
		if distance < nearest_distance:
			nearest_distance = distance
			nearest_index = i

	if nearest_index == -1 or nearest_distance > 1.55:
		_aluminum_bad_press += 1
		GameManager.play_ui_se("cancel")
		_update_aluminum_rhythm_text()
		return

	if nearest_distance <= 0.35:
		_aluminum_hit_perfect += 1
		GameManager.play_ui_se("confirm")
	elif nearest_distance <= 0.9:
		_aluminum_hit_good += 1
		GameManager.play_ui_se("confirm")
	else:
		_aluminum_hit_near += 1
		GameManager.play_ui_se("cursor")

	_aluminum_notes.remove_at(nearest_index)
	if _aluminum_notes_spawned >= _aluminum_total_notes and _aluminum_notes.is_empty():
		_finish_aluminum_rhythm()
		return
	_update_aluminum_rhythm_text()


func _finish_aluminum_rhythm() -> void:
	if not _aluminum_active:
		return
	_aluminum_active = false
	_aluminum_timer.stop()

	var score = _evaluate_aluminum_rhythm()
	var result_text = str(score.get("text", "穴あけ完了"))
	var delta_spec = float(score.get("spec", 0.0))
	var delta_aud = float(score.get("aud", 0.0))
	var zone_gain = float(score.get("zone", 0.0))
	_technical_points += delta_spec
	_audience_points += delta_aud
	_zone_bonus += zone_gain
	_zone_bonus = clampf(_zone_bonus, -0.4, 1.2)
	GameManager.play_ui_se("confirm" if delta_spec >= 0.0 else "cancel")
	_show_step_result_and_next(
		"%s: 専門 %+d / 一般 %+d / ゾーン %+d%%\n判定 P%d / G%d / N%d / M%d / 空振り%d" % [
			result_text,
			int(round(delta_spec)),
			int(round(delta_aud)),
			int(round(zone_gain * 100.0)),
			_aluminum_hit_perfect,
			_aluminum_hit_good,
			_aluminum_hit_near,
			_aluminum_hit_miss,
			_aluminum_bad_press,
		],
		_show_charcoal_prep_step
	)


func _evaluate_aluminum_rhythm() -> Dictionary:
	var hits = _count_aluminum_hits()
	if hits < _aluminum_required_hits:
		return {"text": "穴あけ不足（必要数未達）", "spec": -10.0, "aud": -2.0, "zone": 0.04}

	var weighted = float(_aluminum_hit_perfect) + float(_aluminum_hit_good) * 0.72 + float(_aluminum_hit_near) * 0.42
	var penalty = float(_aluminum_hit_miss) * 0.25 + float(_aluminum_bad_press) * 0.18
	var score = (weighted - penalty) / float(maxi(_aluminum_total_notes, 1))
	score += PlayerData.stat_technique * 0.0015
	score += PlayerData.stat_sense * 0.0008
	if _easy_mode:
		score += 0.08
	if _selected_hms == "amaburst":
		score -= 0.05
	score = clampf(score, 0.0, 1.2)

	if score >= 0.92:
		return {"text": "穴あけリズム（完璧）", "spec": 16.0, "aud": 4.0, "zone": 0.28}
	if score >= 0.78:
		return {"text": "穴あけリズム（良好）", "spec": 10.0, "aud": 2.0, "zone": 0.20}
	if score >= 0.62:
		return {"text": "穴あけリズム（可）", "spec": 4.0, "aud": 1.0, "zone": 0.12}
	return {"text": "穴あけが荒れた", "spec": -8.0, "aud": -1.0, "zone": 0.04}


func _update_aluminum_rhythm_text() -> void:
	var ring = _build_aluminum_ring_text()
	var hit_count = _count_aluminum_hits()
	var remain = maxi(0, _aluminum_required_hits - hit_count)
	var lines: Array[String] = []
	lines.append("円形Taiko穴あけ: 判定点で叩く")
	lines.append("成功: %d / %d（最低 %d 必要、残り %d）" % [hit_count, _aluminum_total_notes, _aluminum_required_hits, remain])
	lines.append("判定: Perfect %d / Good %d / Near %d / Miss %d / 空振り %d" % [
		_aluminum_hit_perfect,
		_aluminum_hit_good,
		_aluminum_hit_near,
		_aluminum_hit_miss,
		_aluminum_bad_press,
	])
	lines.append("凡例: ★判定点 / ●ノーツ / ◎ノーツ重なり / ◆判定点上ノーツ")
	lines.append("")
	lines.append(ring)
	info_label.text = "\n".join(lines)


func _build_aluminum_ring_text() -> String:
	var slot_note_count: Dictionary = {}
	for note in _aluminum_notes:
		var slot_idx = _get_aluminum_note_slot(note)
		slot_note_count[slot_idx] = int(slot_note_count.get(slot_idx, 0)) + 1

	var sym = func(slot_idx: int) -> String:
		var note_count = int(slot_note_count.get(slot_idx, 0))
		if slot_idx == _aluminum_hit_slot:
			if note_count <= 0:
				return "★"
			if note_count == 1:
				return "◆"
			return "✦"
		if note_count <= 0:
			return "○"
		if note_count == 1:
			return "●"
		return "◎"

	var lines: Array[String] = []
	lines.append("          %s" % sym.call(0))
	lines.append("      %s       %s" % [sym.call(11), sym.call(1)])
	lines.append("   %s             %s" % [sym.call(10), sym.call(2)])
	lines.append(" %s                 %s" % [sym.call(9), sym.call(3)])
	lines.append("   %s             %s" % [sym.call(8), sym.call(4)])
	lines.append("      %s       %s" % [sym.call(7), sym.call(5)])
	lines.append("          %s" % sym.call(6))
	return "\n".join(lines)


func _get_aluminum_note_slot(note: Dictionary) -> int:
	var distance = int(round(float(note.get("distance", 0.0))))
	var slot = (_aluminum_hit_slot + distance) % _aluminum_slot_count
	if slot < 0:
		slot += _aluminum_slot_count
	return slot


func _count_aluminum_hits() -> int:
	return _aluminum_hit_perfect + _aluminum_hit_good + _aluminum_hit_near


func _show_charcoal_prep_step() -> void:
	_set_phase(5, "炭の準備", "フリップのタイミングを決める。")
	_clear_choices()
	_add_choice_button("早めにフリップ", _on_charcoal_prep_choice.bind("early"))
	_add_choice_button("ちょうどでフリップ", _on_charcoal_prep_choice.bind("perfect"))
	_add_choice_button("遅めにフリップ", _on_charcoal_prep_choice.bind("late"))
	_refresh_side_panel()


func _on_charcoal_prep_choice(choice: String) -> void:
	var desired = "perfect"
	if _selected_hms == "amaburst":
		desired = "early"
	elif _selected_hms == "winkwink_hagal":
		desired = "late"

	var delta_spec = 0.0
	if choice == desired:
		delta_spec += 10.0
	elif choice == "perfect" or desired == "perfect":
		delta_spec += 3.0
	else:
		delta_spec -= 6.0

	match choice:
		"early":
			_heat_state -= 1
		"late":
			_heat_state += 1
		_:
			pass

	if _selected_hms == "amaburst":
		_heat_state += 1

	_technical_points += delta_spec
	_heat_state = clampi(_heat_state, -3, 3)
	_show_step_result_and_next("炭準備結果: 専門 %+d" % int(round(delta_spec)), _show_charcoal_place_step)


func _show_charcoal_place_step() -> void:
	_set_phase(6, "炭の配置", "3個か4個を選んで配置する。機材と好みに合わせる。")
	_clear_choices()
	
	# Add hint dynamically based on equipment
	var hint = "通常は3個が基本。"
	if _selected_hms == "tanukish_lid" or PlayerData.equipment_bowl == "suyaki":
		hint = "この機材なら3個のほうが熱が安定しやすい。"
	elif _selected_hms == "amaburst":
		hint = "この機材は4個で熱量を叩き込むのが正解。"
		
	info_label.text = "【ヒント】\n" + hint
	
	_add_choice_button("3個（基本／安定）", _on_charcoal_place_selected.bind(3))
	_add_choice_button("4個（攻め／狙いがある時）", _on_charcoal_place_selected.bind(4))
	_refresh_side_panel()


func _on_charcoal_place_selected(count: int) -> void:
	_selected_charcoal_count = count
	var delta_spec = 0.0
	var delta_aud = 0.0

	match count:
		3:
			delta_spec += 8.0
			_zone_bonus += 0.30
			_heat_state -= 1
		4:
			delta_spec += 9.0
			_zone_bonus += 0.16

	if PlayerData.equipment_charcoal == "cube_charcoal":
		if count >= 4:
			delta_spec += 4.0
			delta_aud += 4.0
		else:
			delta_spec -= 4.0

	if _selected_hms == "amaburst" and count == 4:
		delta_spec += 3.0
		_heat_state += 1

	_technical_points += delta_spec
	_audience_points += delta_aud
	_zone_bonus = clampf(_zone_bonus, -0.4, 1.2)
	_heat_state = clampi(_heat_state, -3, 3)
	_show_step_result_and_next("炭配置結果: 専門 %+d / 一般 %+d" % [int(round(delta_spec)), int(round(delta_aud))], _show_steam_step)


var _steam_timer_label: Label

func _show_steam_step() -> void:
	_set_phase(7, "蒸らしタイマー", "5〜10分から蒸らし時間を設定。")
	_clear_choices()
	_steam_minutes = 6
	
	var ui_container = VBoxContainer.new()
	ui_container.alignment = BoxContainer.ALIGNMENT_CENTER
	ui_container.add_theme_constant_override("separation", 16)
	choice_container.add_child(ui_container)
	
	_steam_timer_label = Label.new()
	_steam_timer_label.add_theme_font_size_override("font_size", 48)
	_steam_timer_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	ui_container.add_child(_steam_timer_label)
	
	var control_row = HBoxContainer.new()
	control_row.alignment = BoxContainer.ALIGNMENT_CENTER
	control_row.add_theme_constant_override("separation", 24)
	ui_container.add_child(control_row)
	
	var minus_btn = Button.new()
	minus_btn.text = "－1分"
	minus_btn.custom_minimum_size = Vector2(80, 48)
	minus_btn.pressed.connect(_on_steam_adjust.bind(-1))
	control_row.add_child(minus_btn)
	
	var plus_btn = Button.new()
	plus_btn.text = "＋1分"
	plus_btn.custom_minimum_size = Vector2(80, 48)
	plus_btn.pressed.connect(_on_steam_adjust.bind(1))
	control_row.add_child(plus_btn)
	
	var start_btn = Button.new()
	start_btn.text = "START (決定)"
	start_btn.custom_minimum_size = Vector2(200, 56)
	start_btn.add_theme_color_override("font_color", Color(1, 0.9, 0.4))
	start_btn.pressed.connect(func(): _on_steam_selected(_steam_minutes))
	ui_container.add_child(start_btn)
	
	_update_steam_timer_display()
	_refresh_side_panel()

func _on_steam_adjust(diff: int) -> void:
	_steam_minutes += diff
	if _steam_minutes < 5:
		_steam_minutes = 5
	elif _steam_minutes > 10:
		_steam_minutes = 10
	GameManager.play_ui_se("cursor")
	_update_steam_timer_display()

func _update_steam_timer_display() -> void:
	if _steam_timer_label:
		_steam_timer_label.text = "%02d : 00" % _steam_minutes


func _on_steam_selected(minutes: int) -> void:
	_steam_minutes = minutes
	var range = _get_steam_optimal_range(_selected_charcoal_count)
	var min_minute = int(range.x)
	var max_minute = int(range.y)
	var delta_spec = 0.0

	if minutes >= min_minute and minutes <= max_minute:
		delta_spec += 11.0 + PlayerData.stat_sense * 0.05
		var midpoint = int(round((min_minute + max_minute) / 2.0))
		if minutes == midpoint:
			delta_spec += 4.0
			_zone_bonus += 0.08
	else:
		delta_spec -= 8.0
		if minutes > max_minute:
			_heat_state += 1
		else:
			_heat_state -= 1

	if _selected_hms == "amaburst" and minutes >= 6:
		_heat_state += 1
	if _selected_hms == "winkwink_hagal" and minutes <= 5:
		_heat_state -= 1

	_technical_points += delta_spec
	_zone_bonus = clampf(_zone_bonus, -0.4, 1.2)
	_heat_state = clampi(_heat_state, -3, 3)
	_show_mind_barrage_intro("蒸らし結果: 専門 %+d（適正 %d〜%d分）" % [int(round(delta_spec)), min_minute, max_minute])


func _get_steam_optimal_range(charcoal_count: int) -> Vector2i:
	match charcoal_count:
		3:
			return Vector2i(5, 7)
		4:
			return Vector2i(4, 6)
		_:
			return Vector2i(5, 7)


func _show_mind_barrage_intro(summary_text: String = "") -> void:
	if _mind_barrage_done:
		_show_pull_step()
		return
	var duration_sec = _compute_mind_barrage_duration()
	var lives = MIND_BARRAGE_BASE_LIVES + (1 if _easy_mode else 0)
	_set_phase(8, "吸い出し前: 思考の暴走", "吸い出し直前、頭の中で不安と記憶が弾幕になる。")
	_clear_choices()
	var lines: Array[String] = []
	if summary_text != "":
		lines.append(summary_text)
		lines.append("")
	lines.append("ここが大会の精神戦。")
	lines.append("弾を避ける = 他人の価値観をかわす")
	lines.append("当たる = 心がブレる（評価デバフ）")
	lines.append("耐えきる = 自分のレシピを信じ切る")
	lines.append("成績が良いほど、この後の吸い出しゲージは遅くなる。")
	lines.append("蒸らし %d分 -> 耐久 %.1f秒" % [_steam_minutes, duration_sec])
	lines.append("残機: %d（0になると吸い出しゲージは最悪速度）" % lives)
	lines.append("この精神戦は必須。終えるまで吸い出しへは進めない。")
	info_label.text = "\n".join(lines)
	_add_choice_button("弾幕開始", _start_mind_barrage_step)
	_refresh_side_panel()


func _compute_mind_barrage_duration() -> float:
	var ratio = clampf(float(_steam_minutes - 5) / 5.0, 0.0, 1.0)
	var duration_sec = lerpf(MIND_BARRAGE_MIN_SECONDS * 1.5, MIND_BARRAGE_MAX_SECONDS * 1.5, ratio)
	duration_sec += float(maxi(_heat_state, 0)) * 0.4
	match _selected_hms:
		"amaburst":
			duration_sec += 0.5
		"tanukish_lid":
			duration_sec -= 0.4
		_:
			pass
	if _easy_mode:
		duration_sec -= 1.0
	return clampf(duration_sec, 6.5, 18.0)


func _compute_mind_barrage_spawn_interval() -> float:
	var ratio = clampf(float(_steam_minutes - 5) / 5.0, 0.0, 1.0)
	var interval = lerpf(0.56, 0.34, ratio)
	interval -= float(abs(_heat_state)) * 0.02
	if _selected_hms == "amaburst":
		interval -= 0.02
	elif _selected_hms == "tanukish_lid":
		interval += 0.03
	if _easy_mode:
		interval += 0.06
	return clampf(interval, 0.22, 0.72)


func _start_mind_barrage_step() -> void:
	if _mind_barrage_done:
		_show_pull_step()
		return
	_set_phase(8, "思考弾幕", "弾をかわして時間まで耐える。")
	_clear_choices()
	_mind_active = true
	_mind_duration_total = _compute_mind_barrage_duration()
	_mind_elapsed = 0.0
	_mind_spawn_cooldown = 0.0
	_mind_spawn_interval = _compute_mind_barrage_spawn_interval()
	_mind_hits = 0
	_mind_spawned = 0
	_mind_hit_se_cooldown = 0.0
	_mind_lives_max = MIND_BARRAGE_BASE_LIVES + (1 if _easy_mode else 0)
	_mind_lives_remaining = _mind_lives_max
	_mind_pull_speed_adjust = 0.0
	_mind_force_worst_pull_speed = false
	_mind_bullets.clear()
	_mind_player_pos = Vector2.ZERO
	_mind_move_left = false
	_mind_move_right = false
	_mind_move_up = false
	_mind_move_down = false
	_mind_invincible_timer = 0.0

	var guide = Label.new()
	guide.text = "操作: 矢印キー / WASD（下のボタン長押しでも移動）"
	choice_container.add_child(guide)

	var arena_frame = PanelContainer.new()
	arena_frame.custom_minimum_size = Vector2(0, 260)
	arena_frame.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	choice_container.add_child(arena_frame)

	var arena = ColorRect.new()
	arena.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	arena.color = Color(0.05, 0.06, 0.1, 0.95)
	arena.clip_contents = true
	arena.mouse_filter = Control.MOUSE_FILTER_IGNORE
	arena_frame.add_child(arena)
	_mind_arena_layer = arena

	var player = ColorRect.new()
	player.color = Color(0.96, 0.22, 0.24, 1.0)
	player.size = _mind_player_size
	player.custom_minimum_size = _mind_player_size
	player.mouse_filter = Control.MOUSE_FILTER_IGNORE
	arena.add_child(player)
	_mind_player_node = player

	var dpad = GridContainer.new()
	dpad.columns = 3
	dpad.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	dpad.add_theme_constant_override("h_separation", 8)
	dpad.add_theme_constant_override("v_separation", 8)
	choice_container.add_child(dpad)
	_add_mind_pad_spacer(dpad)
	_add_mind_direction_button(dpad, "↑", "up")
	_add_mind_pad_spacer(dpad)
	_add_mind_direction_button(dpad, "←", "left")
	var center = Label.new()
	center.text = "SOUL"
	center.custom_minimum_size = Vector2(56, 40)
	center.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	center.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	dpad.add_child(center)
	_add_mind_direction_button(dpad, "→", "right")
	_add_mind_pad_spacer(dpad)
	_add_mind_direction_button(dpad, "↓", "down")
	_add_mind_pad_spacer(dpad)

	_update_mind_barrage_info_text()
	_refresh_side_panel()
	call_deferred("_begin_mind_barrage_loop")


func _add_mind_pad_spacer(parent: GridContainer) -> void:
	var spacer = Control.new()
	spacer.custom_minimum_size = Vector2(56, 40)
	parent.add_child(spacer)


func _add_mind_direction_button(parent: GridContainer, button_text: String, dir_id: String) -> void:
	var button = Button.new()
	button.text = button_text
	button.custom_minimum_size = Vector2(56, 40)
	button.button_down.connect(func() -> void:
		_set_mind_direction(dir_id, true)
	)
	button.button_up.connect(func() -> void:
		_set_mind_direction(dir_id, false)
	)
	button.mouse_exited.connect(func() -> void:
		_set_mind_direction(dir_id, false)
	)
	parent.add_child(button)


func _set_mind_direction(dir_id: String, pressed: bool) -> void:
	match dir_id:
		"left":
			_mind_move_left = pressed
		"right":
			_mind_move_right = pressed
		"up":
			_mind_move_up = pressed
		"down":
			_mind_move_down = pressed


func _begin_mind_barrage_loop() -> void:
	if not _mind_active:
		return
	if _mind_arena_layer == null or not is_instance_valid(_mind_arena_layer):
		return
	var arena_size = _mind_arena_layer.size
	if arena_size.x < 80.0 or arena_size.y < 80.0:
		call_deferred("_begin_mind_barrage_loop")
		return
	_mind_player_pos = arena_size * 0.5
	_sync_mind_player_node()
	_spawn_mind_barrage_word()
	_mind_timer.start()
	_update_mind_barrage_info_text()


func _on_mind_barrage_tick() -> void:
	if not _mind_active:
		return
	if _mind_arena_layer == null or not is_instance_valid(_mind_arena_layer):
		return
	var dt = _mind_timer.wait_time
	_mind_elapsed += dt
	_mind_spawn_cooldown -= dt
	if _mind_hit_se_cooldown > 0.0:
		_mind_hit_se_cooldown = max(0.0, _mind_hit_se_cooldown - dt)

	if _mind_invincible_timer > 0.0:
		_mind_invincible_timer -= dt
		if _mind_player_node != null and is_instance_valid(_mind_player_node):
			# Blink effect: alternating alpha every 0.1 seconds
			var time_ms = Time.get_ticks_msec()
			_mind_player_node.color.a = 0.3 if (time_ms % 200) < 100 else 0.8
	elif _mind_player_node != null and is_instance_valid(_mind_player_node):
		_mind_player_node.color.a = 1.0

	_update_mind_player(dt)

	if _mind_spawn_cooldown <= 0.0:
		_spawn_mind_barrage_word()
		_mind_spawn_cooldown = _mind_spawn_interval * randf_range(0.72, 1.25)

	_update_mind_bullets(dt)
	if _mind_lives_remaining <= 0:
		_mind_elapsed = _mind_duration_total
		_update_mind_barrage_info_text()
		_finish_mind_barrage_step()
		return
	_update_mind_barrage_info_text()

	if _mind_elapsed >= _mind_duration_total:
		_finish_mind_barrage_step()


func _update_mind_player(dt: float) -> void:
	if _mind_arena_layer == null:
		return
	var axis = Vector2.ZERO
	if _mind_move_left or Input.is_action_pressed("ui_left") or Input.is_key_pressed(KEY_A):
		axis.x -= 1.0
	if _mind_move_right or Input.is_action_pressed("ui_right") or Input.is_key_pressed(KEY_D):
		axis.x += 1.0
	if _mind_move_up or Input.is_action_pressed("ui_up") or Input.is_key_pressed(KEY_W):
		axis.y -= 1.0
	if _mind_move_down or Input.is_action_pressed("ui_down") or Input.is_key_pressed(KEY_S):
		axis.y += 1.0

	if axis.length_squared() > 0.0:
		axis = axis.normalized()

	var speed = 214.0 + float(maxi(_steam_minutes - 5, 0)) * 4.0
	if _easy_mode:
		speed += 20.0
	_mind_player_pos += axis * speed * dt

	var arena_size = _mind_arena_layer.size
	var margin_x = _mind_player_size.x * 0.5 + 6.0
	var margin_y = _mind_player_size.y * 0.5 + 6.0
	_mind_player_pos.x = clampf(_mind_player_pos.x, margin_x, arena_size.x - margin_x)
	_mind_player_pos.y = clampf(_mind_player_pos.y, margin_y, arena_size.y - margin_y)
	_sync_mind_player_node()


func _spawn_mind_barrage_word() -> void:
	if _mind_arena_layer == null or not is_instance_valid(_mind_arena_layer):
		return
	if MIND_BARRAGE_WORDS.is_empty():
		return
	var arena_size = _mind_arena_layer.size
	if arena_size.x < 80.0 or arena_size.y < 80.0:
		return

	var phrase = str(MIND_BARRAGE_WORDS[randi() % MIND_BARRAGE_WORDS.size()])
	var bullet = Label.new()
	bullet.text = phrase
	bullet.add_theme_font_size_override("font_size", 20)
	bullet.modulate = Color(1.0, 0.82, 0.85, 1.0)
	bullet.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_mind_arena_layer.add_child(bullet)

	var size = bullet.get_combined_minimum_size()
	if size.x < 40.0:
		size = Vector2(maxi(40, phrase.length() * 20), 28)

	var side = randi() % 4
	var spawn = Vector2.ZERO
	match side:
		0:
			spawn = Vector2(randf_range(0.0, arena_size.x), -size.y * 0.5 - 4.0)
		1:
			spawn = Vector2(arena_size.x + size.x * 0.5 + 4.0, randf_range(0.0, arena_size.y))
		2:
			spawn = Vector2(randf_range(0.0, arena_size.x), arena_size.y + size.y * 0.5 + 4.0)
		_:
			spawn = Vector2(-size.x * 0.5 - 4.0, randf_range(0.0, arena_size.y))

	var target = _mind_player_pos + Vector2(randf_range(-64.0, 64.0), randf_range(-42.0, 42.0))
	target.x = clampf(target.x, 20.0, arena_size.x - 20.0)
	target.y = clampf(target.y, 20.0, arena_size.y - 20.0)
	var to_target = target - spawn
	if to_target.length_squared() <= 0.0001:
		to_target = Vector2.DOWN
	var direction = to_target.normalized()

	var speed = 112.0 + float(_steam_minutes - 5) * 14.0 + float(abs(_heat_state)) * 9.0 + randf_range(0.0, 54.0)
	if _selected_hms == "amaburst":
		speed += 12.0
	elif _selected_hms == "tanukish_lid":
		speed -= 8.0
	if _easy_mode:
		speed -= 20.0
	speed = clampf(speed, 90.0, 260.0)

	var data := {
		"node": bullet,
		"pos": spawn,
		"vel": direction * speed,
		"size": size,
	}
	_mind_bullets.append(data)
	_mind_spawned += 1
	bullet.position = spawn - size * 0.5


func _update_mind_bullets(dt: float) -> void:
	if _mind_arena_layer == null:
		return
	var arena_size = _mind_arena_layer.size
	for i in range(_mind_bullets.size() - 1, -1, -1):
		var bullet = _mind_bullets[i]
		var node = bullet.get("node") as Label
		if node == null or not is_instance_valid(node):
			_mind_bullets.remove_at(i)
			continue
		var pos = bullet.get("pos", Vector2.ZERO) + bullet.get("vel", Vector2.ZERO) * dt
		var size = bullet.get("size", node.get_combined_minimum_size())
		bullet["pos"] = pos
		node.position = pos - size * 0.5
		if _mind_invincible_timer <= 0.0 and _is_mind_barrage_collision(pos, size):
			_mind_hits += 1
			_mind_lives_remaining = maxi(0, _mind_lives_remaining - 1)
			if _mind_hit_se_cooldown <= 0.0:
				GameManager.play_ui_se("cancel")
				_mind_hit_se_cooldown = 0.08
			_mind_invincible_timer = 1.0 # 1 second of i-frames
			node.queue_free()
			_mind_bullets.remove_at(i)
			continue
		if pos.x < -size.x - 24.0 or pos.x > arena_size.x + size.x + 24.0 or pos.y < -size.y - 24.0 or pos.y > arena_size.y + size.y + 24.0:
			node.queue_free()
			_mind_bullets.remove_at(i)
			continue
		_mind_bullets[i] = bullet


func _is_mind_barrage_collision(bullet_pos: Vector2, bullet_size: Vector2) -> bool:
	var player_rect = Rect2(_mind_player_pos - _mind_player_size * 0.25, _mind_player_size * 0.5)
	var bullet_rect = Rect2(bullet_pos - bullet_size * 0.2, bullet_size * 0.4)
	return player_rect.intersects(bullet_rect)


func _sync_mind_player_node() -> void:
	if _mind_player_node == null or not is_instance_valid(_mind_player_node):
		return
	_mind_player_node.position = _mind_player_pos - _mind_player_size * 0.5


func _update_mind_barrage_info_text() -> void:
	if not _mind_active:
		return
	var remain = max(0.0, _mind_duration_total - _mind_elapsed)
	var focus = clampi(100 - _mind_hits * 12, 0, 100)
	var ratio = 0.0
	if _mind_duration_total > 0.0:
		ratio = _mind_elapsed / _mind_duration_total
	var lines: Array[String] = []
	lines.append("残り %.1f秒 / %.1f秒" % [remain, _mind_duration_total])
	lines.append("残機 %d / %d  %s" % [_mind_lives_remaining, _mind_lives_max, _build_mind_life_text()])
	lines.append("被弾 %d / 出現 %d" % [_mind_hits, maxi(_mind_spawned, 1)])
	lines.append("集中度 %d%%" % focus)
	lines.append(_build_mind_barrage_progress_bar(ratio))
	info_label.text = "\n".join(lines)


func _build_mind_life_text() -> String:
	var chars: Array[String] = []
	for i in range(_mind_lives_max):
		chars.append("●" if i < _mind_lives_remaining else "○")
	return "".join(chars)


func _build_mind_barrage_progress_bar(ratio: float) -> String:
	var length = 24
	var fill = int(round(clampf(ratio, 0.0, 1.0) * float(length)))
	var chars: Array[String] = []
	for i in range(length):
		chars.append("■" if i < fill else "─")
	return "".join(chars)


func _finish_mind_barrage_step() -> void:
	if not _mind_active:
		return
	var result = _evaluate_mind_barrage_result()
	var result_text = str(result.get("text", "精神戦を抜けた。"))
	var delta_spec = float(result.get("spec", 0.0))
	var delta_aud = float(result.get("aud", 0.0))
	var delta_zone = float(result.get("zone", 0.0))
	var heat_shift = int(result.get("heat_shift", 0))
	var hit_count = _mind_hits
	var spawn_count = _mind_spawned
	var lives_remaining = _mind_lives_remaining
	var lives_max = _mind_lives_max
	_mind_active = false
	_mind_barrage_done = true
	_mind_timer.stop()
	_mind_pull_speed_adjust = float(result.get("pull_speed_adjust", 0.0))
	_mind_force_worst_pull_speed = bool(result.get("force_worst_pull_speed", false))

	_technical_points += delta_spec
	_audience_points += delta_aud
	_zone_bonus += delta_zone
	_zone_bonus = clampf(_zone_bonus, -0.4, 1.2)
	_heat_state = clampi(_heat_state + heat_shift, -3, 3)
	_refresh_side_panel()
	GameManager.play_ui_se("confirm" if delta_spec >= 0.0 else "cancel")
	_show_step_result_and_next(
		"%s\n被弾 %d / 出現 %d\n専門 %+d / 一般 %+d\n吸い出し速度補正: %s" % [
			result_text,
			hit_count,
			maxi(spawn_count, 1),
			int(round(delta_spec)),
			int(round(delta_aud)),
			_mind_pull_adjust_text(),
		],
		_show_pull_step
	)
	_append_info("残機 %d / %d / 吸い出し速度補正: %s" % [lives_remaining, lives_max, _mind_pull_adjust_text()])


func _evaluate_mind_barrage_result() -> Dictionary:
	if _mind_lives_remaining <= 0:
		return {
			"text": "心が折れた。雑音に飲まれたまま吸い出しへ入る。",
			"spec": -14.0,
			"aud": -5.0,
			"zone": -0.05,
			"heat_shift": 2,
			"pull_speed_adjust": 0.45,
			"force_worst_pull_speed": true,
		}

	var pressure = float(_mind_hits) / float(maxi(_mind_spawned, 1))
	var life_ratio = float(_mind_lives_remaining) / float(maxi(_mind_lives_max, 1))
	var resilience = clampf(1.0 - pressure * 1.9 + life_ratio * 0.35, 0.0, 1.0)
	if _easy_mode:
		resilience = min(1.0, resilience + 0.08)

	if resilience >= 0.86:
		return {
			"text": "表情が落ち着いた。冷静さを取り戻した。",
			"spec": 15.0,
			"aud": 6.0,
			"zone": 0.10,
			"heat_shift": -1,
			"pull_speed_adjust": -0.18,
			"force_worst_pull_speed": false,
		}
	if resilience >= 0.68:
		return {
			"text": "揺れを抑えて、レシピに意識を戻した。",
			"spec": 8.0,
			"aud": 3.0,
			"zone": 0.05,
			"heat_shift": 0,
			"pull_speed_adjust": -0.10,
			"force_worst_pull_speed": false,
		}
	if resilience >= 0.45:
		return {
			"text": "迷いは残るが、ギリギリ持ちこたえた。",
			"spec": 1.0,
			"aud": 0.0,
			"zone": 0.0,
			"heat_shift": 0,
			"pull_speed_adjust": 0.06,
			"force_worst_pull_speed": false,
		}

	var panic_penalty = 0.0
	if _mind_hits >= int(round(_mind_duration_total * 0.7)):
		panic_penalty = 3.0
	return {
		"text": "他人の価値観に呑まれ、心がブレた。",
		"spec": -9.0 - panic_penalty,
		"aud": -3.0,
		"zone": -0.03,
		"heat_shift": 1,
		"pull_speed_adjust": 0.14,
		"force_worst_pull_speed": false,
	}


func _mind_pull_hint() -> String:
	if _mind_force_worst_pull_speed:
		return "最悪速度"
	if _mind_pull_speed_adjust <= -0.14:
		return "かなり遅い"
	if _mind_pull_speed_adjust <= -0.06:
		return "やや遅い"
	if _mind_pull_speed_adjust >= 0.10:
		return "速い"
	if _mind_pull_speed_adjust >= 0.04:
		return "やや速い"
	return "標準"


func _mind_pull_adjust_text() -> String:
	if _mind_force_worst_pull_speed:
		return "最悪速度固定（%.2f以上）" % MIND_BARRAGE_WORST_PULL_SPEED
	var trend = "遅くなる"
	if _mind_pull_speed_adjust > 0.0:
		trend = "速くなる"
	elif abs(_mind_pull_speed_adjust) < 0.001:
		trend = "変化なし"
	return "%+.2f（%s）" % [_mind_pull_speed_adjust, trend]


func _stop_mind_barrage() -> void:
	_mind_active = false
	if _mind_timer != null:
		_mind_timer.stop()
	for raw in _mind_bullets:
		if typeof(raw) != TYPE_DICTIONARY:
			continue
		var node = (raw as Dictionary).get("node") as Label
		if node != null and is_instance_valid(node):
			node.queue_free()
	_mind_bullets.clear()
	if _mind_player_node != null and is_instance_valid(_mind_player_node):
		_mind_player_node.queue_free()
	_mind_player_node = null
	_mind_arena_layer = null
	_mind_move_left = false
	_mind_move_right = false
	_mind_move_up = false
	_mind_move_down = false
	_mind_hit_se_cooldown = 0.0


func _show_pull_step() -> void:
	if not _mind_barrage_done:
		_show_mind_barrage_intro("吸い出し前に精神戦を完了する。")
		return
	var round_number = _pull_round + 1
	_set_phase(
		8,
		"吸い出し %d / %d" % [round_number, PULL_MAX_ROUNDS],
		"押している間だけ吸い出し、離した瞬間で判定。最低%d回、最大%d回。熱状態: %s\n精神戦補正: %s" % [
			PULL_MIN_ROUNDS,
			PULL_MAX_ROUNDS,
			_heat_label(),
			_mind_pull_adjust_text(),
		]
	)
	_clear_choices()
	_pull_timer.stop()
	_pull_is_holding = false
	_pull_step_resolved = false
	_pull_hold_button = null

	var difficulty = 1.0
	if not PULL_DIFFICULTY.is_empty():
		var difficulty_index = mini(_pull_round, PULL_DIFFICULTY.size() - 1)
		difficulty = float(PULL_DIFFICULTY[difficulty_index])
	var setting_window_adjust = _get_pull_window_adjust_by_setting()
	var setting_speed_adjust = _get_pull_speed_adjust_by_setting()
	_pull_target_width = clampf(0.22 - difficulty * 0.08 - float(abs(_heat_state)) * 0.01 + setting_window_adjust, 0.05, 0.24)
	if PlayerData.equipment_charcoal == "cube_charcoal":
		_pull_target_width = maxi(0.05, _pull_target_width - 0.02)
	if _easy_mode:
		_pull_target_width = mini(0.26, _pull_target_width + 0.04)

	_pull_target_center = clampf(0.5 + float(_heat_state) * 0.07 + randf_range(-0.12, 0.12), 0.15, 0.85)
	var base_speed = 0.85 + float(_pull_round) * 0.2 + float(abs(_heat_state)) * 0.06 + setting_speed_adjust
	if _mind_force_worst_pull_speed:
		_pull_gauge_speed = MIND_BARRAGE_WORST_PULL_SPEED + float(_pull_round) * 0.22 + float(abs(_heat_state)) * 0.08
	else:
		_pull_gauge_speed = base_speed + _mind_pull_speed_adjust
	if _easy_mode and not _mind_force_worst_pull_speed:
		_pull_gauge_speed = maxi(0.6, _pull_gauge_speed - 0.15)
	_pull_gauge_speed = clampf(_pull_gauge_speed, 0.55, 3.25)
	_pull_gauge_value = clampf(_pull_target_center + randf_range(-0.18, 0.18), 0.0, 1.0)
	_pull_gauge_direction = 1.0

	var setting_hint = ""
	if setting_window_adjust <= -0.02:
		setting_hint = "装備補正: シビア（判定が狭い）"
	elif setting_window_adjust >= 0.02:
		setting_hint = "装備補正: 安定（判定が広い）"
	else:
		setting_hint = "装備補正: 標準"
	_pull_setting_hint = "%s / 精神戦: %s（%s）" % [setting_hint, _mind_pull_hint(), _mind_pull_adjust_text()]

	var hold_button = Button.new()
	hold_button.text = "押して吸う（離して止める）"
	hold_button.custom_minimum_size = Vector2(0, 48)
	hold_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hold_button.button_down.connect(_on_pull_hold_started)
	hold_button.button_up.connect(_on_pull_hold_released)
	choice_container.add_child(hold_button)
	_pull_hold_button = hold_button
	if _pull_round >= PULL_MIN_ROUNDS:
		_add_choice_button("ここで提供に進む", _on_pull_skip_to_serving)

	if PlayerData.equipment_charcoal == "cube_charcoal":
		_append_info("キューブ炭: 当てれば高得点、外すと失点が重い。")
	_refresh_side_panel()
	_update_pull_gauge_text()


func _on_pull_gauge_tick() -> void:
	if not _pull_is_holding:
		return
	var delta = _pull_timer.wait_time
	_pull_gauge_value += _pull_gauge_direction * _pull_gauge_speed * delta
	if _pull_gauge_value >= 1.0:
		_pull_gauge_value = 1.0
		_pull_gauge_direction = -1.0
	elif _pull_gauge_value <= 0.0:
		_pull_gauge_value = 0.0
		_pull_gauge_direction = 1.0
	_update_pull_gauge_text()


func _update_pull_gauge_text() -> void:
	var bar_len = 24
	var pointer_index = int(round(_pull_gauge_value * float(bar_len - 1)))
	var target_start = int(round(clampf(_pull_target_center - _pull_target_width, 0.0, 1.0) * float(bar_len - 1)))
	var target_end = int(round(clampf(_pull_target_center + _pull_target_width, 0.0, 1.0) * float(bar_len - 1)))

	var bar_chars: Array[String] = []
	for i in range(bar_len):
		var char = "─"
		if i >= target_start and i <= target_end:
			char = "■"
		if i == pointer_index:
			char = "◆"
		bar_chars.append(char)

	var status_text = "吸い出し中...離すと判定" if _pull_is_holding else "ボタンを押して吸い出し開始"
	info_label.text = "%s\n%s\n%s\n目標帯 ■ / ポインタ ◆\n※このゲージはタイミング用。温度は右パネルの縦表示で確認。" % [
		status_text,
		_pull_setting_hint,
		"".join(bar_chars),
	]


func _on_pull_hold_started() -> void:
	if _pull_step_resolved:
		return
	if _pull_is_holding:
		return
	_pull_is_holding = true
	if _pull_hold_button != null:
		_pull_hold_button.text = "吸い出し中...（離して止める）"
	if _pull_timer.is_stopped():
		_pull_timer.start()
	GameManager.play_ui_se("cursor")
	_update_pull_gauge_text()


func _on_pull_hold_released() -> void:
	if _pull_step_resolved:
		return
	if not _pull_is_holding:
		return
	_pull_is_holding = false
	if _pull_hold_button != null:
		_pull_hold_button.disabled = true
	if not _pull_timer.is_stopped():
		_pull_timer.stop()
	_resolve_pull_result()


func _resolve_pull_result() -> void:
	if _pull_step_resolved:
		return
	_pull_step_resolved = true
	var distance = abs(_pull_gauge_value - _pull_target_center)
	var quality = "miss"
	if distance <= _pull_target_width * 0.35:
		quality = "perfect"
	elif distance <= _pull_target_width:
		quality = "good"
	elif distance <= _pull_target_width * 1.7:
		quality = "near"

	var delta_spec = 0.0
	var delta_aud = 0.0
	var result_text = ""
	match quality:
		"perfect":
			delta_spec = 24.0
			delta_aud = 6.0
			_pull_quality_total += 3.0
			_pull_hit_count += 1
			_heat_state += 1
			result_text = "完璧停止"
		"good":
			delta_spec = 14.0
			delta_aud = 3.0
			_pull_quality_total += 2.0
			_pull_hit_count += 1
			_heat_state += 1
			result_text = "有効停止"
		"near":
			delta_spec = 4.0
			delta_aud = 1.0
			_pull_quality_total += 1.0
			_heat_state += 1
			result_text = "ニア停止"
		_:
			delta_spec = -10.0
			delta_aud = -1.0
			_heat_state += 2
			result_text = "ミス停止"

	if PlayerData.equipment_charcoal == "cube_charcoal":
		if quality == "perfect":
			delta_spec += 8.0
			delta_aud += 4.0
		elif quality == "miss":
			delta_spec -= 4.0

	_technical_points += delta_spec
	_audience_points += delta_aud
	_heat_state = clampi(_heat_state, -3, 3)
	_pull_round += 1
	GameManager.play_ui_se("confirm" if quality != "miss" else "cancel")

	var next_callable = _show_pull_step if _pull_round < PULL_MAX_ROUNDS else _show_serving_step
	_show_step_result_and_next("%s: 専門 %+d / 一般 %+d" % [result_text, int(round(delta_spec)), int(round(delta_aud))], next_callable)


func _on_pull_skip_to_serving() -> void:
	if _pull_round < PULL_MIN_ROUNDS:
		GameManager.play_ui_se("cancel")
		return
	_pull_timer.stop()
	_pull_is_holding = false
	_pull_step_resolved = true
	GameManager.play_ui_se("confirm")
	_show_step_result_and_next("吸い出しを切り上げて提供へ移る。", _show_serving_step)


func _get_pull_window_adjust_by_setting() -> float:
	var adjust = 0.0
	match _selected_hms:
		"tanukish_lid":
			adjust += 0.025
		"amaburst":
			adjust -= 0.03
		"winkwink_hagal":
			adjust += 0.01
	match _selected_bowl:
		"silicone_bowl":
			adjust += 0.01
		"suyaki":
			adjust -= 0.01
		"hagal_80beat":
			adjust += 0.005
	return adjust


func _get_pull_speed_adjust_by_setting() -> float:
	var adjust = 0.0
	match _selected_hms:
		"tanukish_lid":
			adjust -= 0.06
		"amaburst":
			adjust += 0.12
		"winkwink_hagal":
			adjust -= 0.03
	match _selected_bowl:
		"silicone_bowl":
			adjust -= 0.03
		"suyaki":
			adjust += 0.04
	return adjust


func _show_serving_step() -> void:
	_set_phase(9, "提供", "吸い出しを終えた。提供してお客さんの反応を見る。")
	_clear_choices()
	var lines: Array[String] = []
	lines.append("吸い出しヒット: %d / %d" % [_pull_hit_count, maxi(_pull_round, 1)])
	lines.append("吸い出し品質: %.1f" % _pull_quality_total)
	info_label.text = "\n".join(lines)
	_add_choice_button("提供する", _on_serving_confirmed)
	_refresh_side_panel()


func _on_serving_confirmed() -> void:
	var spec_gain = 4.0 + _pull_quality_total * 1.8 + PlayerData.stat_technique * 0.03
	var aud_gain = 3.0 + float(_pull_hit_count) * 2.0 + PlayerData.stat_charm * 0.02
	
	# Apply pull round bonus: Fewer pulls = greater bonus
	var bonus_text = ""
	if _pull_round == 2:
		spec_gain += 12.0
		aud_gain += 8.0
		bonus_text = " (最速吸い出しボーナス!)"
	elif _pull_round == 3:
		spec_gain += 5.0
		aud_gain += 3.0
		bonus_text = " (早め吸い出しボーナス)"
	
	_technical_points += spec_gain
	_audience_points += aud_gain
	GameManager.play_ui_se("confirm")
	_show_step_result_and_next("提供評価: 専門 %+d / 一般 %+d%s" % [int(round(spec_gain)), int(round(aud_gain)), bonus_text], _show_adjustment_menu.bind(0))


func _show_adjustment_menu(round_index: int) -> void:
	var step_no = 10 + round_index
	_set_phase(step_no, "提供後の調整 %d回目" % (round_index + 1), "現在の炭: %d個 / 熱状態: %d\nどう調整する？" % [_selected_charcoal_count, _heat_state])
	_clear_choices()

	_add_choice_button("炭の調整を行う", _show_charcoal_adjust_step.bind(round_index))
	_add_choice_button("吸い出しで微調整する", _show_pull_adjust_step.bind(round_index))
	
	if _adjustment_action_count >= 2:
		_add_choice_button("調整を終える（次に進む）", _finish_adjustment_phase.bind(round_index))
	else:
		var btn = _add_choice_button("調整を終える（あと%d回アクションが必要）" % (2 - _adjustment_action_count), _finish_adjustment_phase.bind(round_index))
		btn.disabled = true


func _show_charcoal_adjust_step(round_index: int) -> void:
	_set_phase(10 + round_index, "炭の調整", "現在の炭は%d個だ。どうする？\n※炭の増減は熱状態に直結する。" % _selected_charcoal_count)
	_clear_choices()
	
	if _selected_charcoal_count > 2:
		_add_choice_button("炭を1個減らす（現在%d -> %d）" % [_selected_charcoal_count, _selected_charcoal_count - 1], _apply_charcoal_change.bind(-1, false, round_index))
	if _selected_charcoal_count < 4:
		_add_choice_button("炭を1個増やす（現在%d -> %d）" % [_selected_charcoal_count, _selected_charcoal_count + 1], _apply_charcoal_change.bind(1, false, round_index))
	_add_choice_button("新しい炭に交換する", _apply_charcoal_change.bind(0, true, round_index))
	_add_choice_button("戻る", _show_adjustment_menu.bind(round_index))


func _apply_charcoal_change(diff: int, is_new: bool, round_index: int) -> void:
	_selected_charcoal_count += diff
	var heat_change = diff
	if is_new:
		heat_change += 1
	
	_heat_state = clampi(_heat_state + heat_change, -3, 3)
	_adjustment_action_count += 1
	
	var msg = "炭の数を調整した。" if diff != 0 else "新しい炭に交換した。温度が少し上がる。"
	GameManager.play_ui_se("confirm")
	_show_step_result_and_next(msg, _show_adjustment_menu.bind(round_index))


func _show_pull_adjust_step(round_index: int) -> void:
	var target_action = _target_adjust_action()
	_adjust_target_action = target_action
	var cue = _build_adjustment_cue(target_action, round_index)
	_set_phase(
		10 + round_index,
		"吸い出し微調整",
		cue + "\n方向を選択してから、ゲージでタイミング調整する。"
	)
	_clear_choices()
	_add_choice_button("温度を上げる（蓋を閉める・強めに吸う）", _on_adjust_action_selected.bind("up", round_index))
	_add_choice_button("現状維持", _on_adjust_action_selected.bind("stay", round_index))
	_add_choice_button("温度を下げる（蓋を開ける・弱めに吸う）", _on_adjust_action_selected.bind("down", round_index))
	_add_choice_button("戻る", _show_adjustment_menu.bind(round_index))


func _target_adjust_action() -> String:
	if _heat_state >= 2:
		return "down"
	if _heat_state <= -2:
		return "up"
	return "stay"


func _build_adjustment_cue(target_action: String, round_index: int) -> String:
	var judge_name = "土岐 鋼鉄"
	if round_index == 1:
		judge_name = str(_random_judge.get("name", "審査員"))

	var lines: Array[String] = []
	if _heat_state >= 2:
		lines.append("%s が短く咳払い。熱が強すぎるかもしれない。" % judge_name)
	elif _heat_state <= -2:
		lines.append("%s が首をかしげた。煙が薄いかもしれない。" % judge_name)
	else:
		lines.append("%s の表情は読みづらい。" % judge_name)

	if PlayerData.stat_insight >= 35:
		lines.append("洞察ヒント: %s が有効。" % _adjust_action_label(target_action))
	elif PlayerData.stat_insight >= 25:
		lines.append("洞察ヒント: 今は大きく動かしすぎない方が良い。")

	if not _easy_mode and randf() < 0.25:
		lines.append("パッキー「%s が正解かも♪」" % _adjust_action_label(_fake_action(target_action)))

	return "\n".join(lines)


func _fake_action(target_action: String) -> String:
	if target_action == "up":
		return "down"
	if target_action == "down":
		return "up"
	return ["up", "down"][randi() % 2]


func _adjust_action_label(action: String) -> String:
	match action:
		"up":
			return "温度を上げる"
		"down":
			return "温度を下げる"
		_:
			return "現状維持"


func _on_adjust_action_selected(action_id: String, round_index: int) -> void:
	_adjust_selected_action = action_id
	_show_adjustment_gauge_step(round_index)


func _show_adjustment_gauge_step(round_index: int) -> void:
	_set_phase(
		10 + round_index,
		"微調整ゲージ",
		"選択した方向: %s\n押している間だけ調整、離した瞬間で判定。\n判定は PERFECT / GOOD / NEAR / MISS。" % _adjust_action_label(_adjust_selected_action)
	)
	_clear_choices()
	_adjust_step_finished = false
	_adjust_is_holding = false
	
	var speed = 1.02 + float(abs(_heat_state)) * 0.16
	_adjust_gauge_speed = clampf(speed, 0.8, 2.4)
	_adjust_target_width = clampf(0.18 - float(abs(_heat_state)) * 0.015, 0.08, 0.22)
	_adjust_target_center = clampf(0.5 + randf_range(-0.08, 0.08), 0.2, 0.8)
	_adjust_gauge_value = clampf(_adjust_target_center + randf_range(-0.2, 0.2), 0.0, 1.0)
	_adjust_gauge_direction = 1.0

	var hold_button = Button.new()
	hold_button.text = "押して調整（離して決定）"
	hold_button.custom_minimum_size = Vector2(0, 48)
	hold_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hold_button.button_down.connect(_on_adjust_hold_started)
	hold_button.button_up.connect(func(): _on_adjust_hold_released(round_index))
	choice_container.add_child(hold_button)

	_update_adjust_text("調整待機中")


func _on_adjust_hold_started() -> void:
	if _adjust_step_finished or _adjust_is_holding:
		return
	_adjust_is_holding = true
	if _adjust_timer.is_stopped():
		_adjust_timer.start()
	GameManager.play_ui_se("cursor")
	_update_adjust_text("調整中...離すと判定")


func _on_adjust_hold_released(round_index: int) -> void:
	if _adjust_step_finished or not _adjust_is_holding:
		return
	_adjust_is_holding = false
	if not _adjust_timer.is_stopped():
		_adjust_timer.stop()
	_resolve_adjustment_round(round_index)


func _on_adjust_timer_tick() -> void:
	if not _adjust_is_holding:
		return
	var delta = _adjust_timer.wait_time
	_adjust_gauge_value += _adjust_gauge_direction * _adjust_gauge_speed * delta
	if _adjust_gauge_value >= 1.0:
		_adjust_gauge_value = 1.0
		_adjust_gauge_direction = -1.0
	elif _adjust_gauge_value <= 0.0:
		_adjust_gauge_value = 0.0
		_adjust_gauge_direction = 1.0
	_update_adjust_text("調整中...離すと判定")


func _update_adjust_text(status_text: String) -> void:
	var bar = _build_gauge_bar(_adjust_gauge_value, _adjust_target_center, _adjust_target_width)
	var lines: Array[String] = []
	lines.append(status_text)
	lines.append("タイミング目標帯 ■ / ポインタ ◆")
	lines.append(bar)
	info_label.text = "\n".join(lines)


func _resolve_adjustment_round(round_index: int) -> void:
	_adjust_step_finished = true
	var quality = _evaluate_gauge_quality(_adjust_gauge_value, _adjust_target_center, _adjust_target_width)
	var action_correct = _adjust_selected_action == _adjust_target_action
	var timing_good = quality == "perfect" or quality == "good"
	var success = action_correct and timing_good

	var result_line = ""
	if success:
		_adjustment_hits += 1
		_technical_points += 4.0
		if _heat_state > 0:
			_heat_state -= 1
		elif _heat_state < 0:
			_heat_state += 1
		result_line = "方向もタイミングも正解。見事に熱を抑え込んだ！（調整成功）"
	else:
		_technical_points -= 4.0
		match _adjust_selected_action:
			"up":
				_heat_state += 1
			"down":
				_heat_state -= 1
			_:
				if _heat_state > 0:
					_heat_state += 1
				elif _heat_state < 0:
					_heat_state -= 1
		result_line = "調整ミス。熱状態が悪化した。"

	_heat_state = clampi(_heat_state, -3, 3)
	
	GameManager.play_ui_se("confirm" if success else "cancel")
	_update_adjust_text(
		"判定: %s\n%s\n現在熱状態: %d" % [
			quality.to_upper(),
			result_line,
			_heat_state,
		]
	)
	_clear_choices()
	_adjustment_action_count += 1
	_add_choice_button("調整メニューに戻る", _show_adjustment_menu.bind(round_index))


func _finish_adjustment_phase(round_index: int) -> void:
	_adjustment_action_count = 0
	
	if round_index == 2 and _adjustment_hits >= 3:
		_technical_points += 10.0
		_audience_points += 4.0
		_show_step_result_and_next("3連続成功ボーナス獲得！", _show_mid_announcement if round_index >= 2 else _show_adjustment_menu.bind(round_index + 1))
	else:
		var next_callable: Callable = _show_adjustment_menu.bind(round_index + 1) if round_index < 2 else _show_mid_announcement
		_show_step_result_and_next("調整時間を終え、次の時間へ進む。", next_callable)


func _show_mid_announcement() -> void:
	_set_phase(13, "中間発表", "ここまでの暫定順位と、あなたとの差を表示。")
	_clear_choices()

	var player_score = _build_player_score()
	var player_total = float(player_score.get("total", 0.0))
	_mid_player_total = player_total
	_mid_rival_totals.clear()

	var ranking: Array = []
	ranking.append(player_score)
	var rivals = _build_rival_mid_scores()
	for rival in rivals:
		var row = rival as Dictionary
		_mid_rival_totals[str(row.get("id", ""))] = float(row.get("total", 0.0))
	ranking.append_array(rivals)
	ranking.sort_custom(func(a, b):
		return float(a.get("total", 0.0)) > float(b.get("total", 0.0))
	)

	var lines: Array[String] = ["【暫定順位】"]
	for i in range(ranking.size()):
		var row: Dictionary = ranking[i]
		var row_id = str(row.get("id", ""))
		var row_total = float(row.get("total", 0.0))
		if row_id == "player":
			lines.append("%d位 %s %.1f点（あなた）" % [i + 1, str(row.get("name", "-")), row_total])
		else:
			lines.append("%d位 %s %.1f点（あなたとの差 %+.1f）" % [
				i + 1,
				str(row.get("name", "-")),
				row_total,
				player_total - row_total,
			])

	var leader = ranking[0] as Dictionary
	if str(leader.get("id", "")) == "player":
		lines.append("暫定トップ。最終プレゼンで失点しなければ押し切れる。")
	else:
		lines.append("首位まで %.1f 点差。プレゼンで逆転可能。" % (float(leader.get("total", 0.0)) - player_total))

	info_label.text = "\n".join(lines)
	_add_choice_button("最終プレゼンへ", _show_presentation_intro)
	_refresh_side_panel()


func _show_presentation_intro() -> void:
	var judge_focuses = _get_active_judge_focuses()
	var judge_labels: Array[String] = []
	for focus_id in judge_focuses:
		judge_labels.append(str(PRESENTATION_FOCUS_LABEL.get(focus_id, focus_id)))
	_set_phase(
		14,
		"プレゼン: 強調ポイント",
		"売りを1〜2個だけ選んで押し出す。\n審査員が刺さる軸: %s" % " / ".join(judge_labels)
	)
	_clear_choices()
	_presentation_primary_focus = ""
	_presentation_secondary_focus = ""
	_add_choice_button("1つ目の強調ポイントを選ぶ", _show_presentation_primary_choice)
	_refresh_side_panel()


func _show_presentation_primary_choice() -> void:
	_set_phase(14, "プレゼン: 1つ目", "まず最優先で押し出す売りを1つ選ぶ。")
	_clear_choices()
	for focus in PRESENTATION_FOCUS_OPTIONS:
		var focus_id = str(focus.get("id", ""))
		var label = str(focus.get("name", focus_id))
		_add_choice_button(label, _on_presentation_primary_selected.bind(focus_id))
	_refresh_side_panel()


func _on_presentation_primary_selected(focus_id: String) -> void:
	_presentation_primary_focus = focus_id
	_show_presentation_secondary_choice()


func _show_presentation_secondary_choice() -> void:
	var primary_label = str(PRESENTATION_FOCUS_LABEL.get(_presentation_primary_focus, _presentation_primary_focus))
	_set_phase(14, "プレゼン: 2つ目", "1つ目は「%s」。2つ目を足すか、1点突破でいくか選ぶ。" % primary_label)
	_clear_choices()
	_add_choice_button("1点突破でいく", _on_presentation_secondary_selected.bind(""))
	for focus in PRESENTATION_FOCUS_OPTIONS:
		var focus_id = str(focus.get("id", ""))
		if focus_id == _presentation_primary_focus:
			continue
		var label = str(focus.get("name", focus_id))
		_add_choice_button(label, _on_presentation_secondary_selected.bind(focus_id))
	_refresh_side_panel()


func _on_presentation_secondary_selected(focus_id: String) -> void:
	_presentation_secondary_focus = focus_id
	_resolve_presentation_focus()


func _resolve_presentation_focus() -> void:
	var selected: Array[String] = [_presentation_primary_focus]
	if _presentation_secondary_focus != "":
		selected.append(_presentation_secondary_focus)

	var focus_scores = _build_focus_scores()
	var judge_focuses = _get_active_judge_focuses()
	var spec_gain = 4.0
	var aud_gain = 4.0
	var lines: Array[String] = []
	var judge_hit = false

	for focus in PRESENTATION_FOCUS_OPTIONS:
		var focus_id = str(focus.get("id", ""))
		var focus_label = str(focus.get("name", focus_id))
		var score = float(focus_scores.get(focus_id, 50.0))
		if selected.has(focus_id):
			lines.append("強調: %s（適性 %.0f）" % [focus_label, score])
			var push_gain = (score - 55.0) * 0.24
			spec_gain += push_gain * 0.75
			aud_gain += push_gain * 0.55
			if judge_focuses.has(focus_id):
				spec_gain += 4.0
				aud_gain += 2.0
				judge_hit = true
		elif score < 52.0:
			var expose = (52.0 - score) * 0.22
			spec_gain -= expose
			aud_gain -= expose * 0.7
			lines.append("未強調の弱点露出: %s（-%d）" % [focus_label, int(round(expose))])

	if selected.size() == 2:
		var pair_diff = abs(float(focus_scores.get(selected[0], 50.0)) - float(focus_scores.get(selected[1], 50.0)))
		if pair_diff <= 10.0:
			spec_gain += 3.0
			aud_gain += 3.0
			lines.append("二軸が噛み合い、説得力が上がった。")
		elif pair_diff >= 28.0:
			spec_gain -= 2.0
			aud_gain -= 1.0
			lines.append("二軸の温度差が出て、訴求がブレた。")
	else:
		var single_score = float(focus_scores.get(selected[0], 50.0))
		if single_score >= 72.0:
			spec_gain += 2.0
			aud_gain += 4.0
			lines.append("1点突破がハマった。")
		elif single_score < 55.0:
			spec_gain -= 3.0
			lines.append("1点突破の根拠が弱く、押し切れなかった。")

	if not judge_hit:
		spec_gain -= 4.0
		lines.append("審査員の好みを外したため、専門評価が伸びない。")

	if _special_mix_name != "" and selected.has("unique"):
		aud_gain += 3.0
		lines.append("特別ミックスの語りが個性評価に直結した。")
	if _easy_mode:
		spec_gain += 2.0
		aud_gain += 1.0

	_technical_points += spec_gain
	_audience_points += aud_gain
	lines.append("プレゼン結果: 専門 %+d / 一般 %+d" % [int(round(spec_gain)), int(round(aud_gain))])
	_show_step_result_and_next("\n".join(lines), _finalize_and_show_result)


func _build_focus_scores() -> Dictionary:
	var theme_hit = _count_theme_hits(_selected_flavors)
	var pull_rate = float(_pull_hit_count) / float(maxi(_pull_round, 1))
	var target_temp = _get_target_temp_range()
	var current_temp = _get_current_temp_value()
	var target_center = (target_temp.x + target_temp.y) * 0.5
	var temp_error = abs(current_temp - target_center)
	var temp_quality = clampf(1.0 - temp_error / 34.0, 0.0, 1.0)
	var stability = clampf(1.0 - float(abs(_heat_state)) / 3.0, 0.0, 1.0)
	var charcoal_bonus = 4.0 if _selected_charcoal_count == 4 else 0.0

	var taste = 46.0 + float(theme_hit) * 8.0 + PlayerData.stat_sense * 0.55 + _technical_points * 0.04 + temp_quality * 14.0
	var smoke = 44.0 + _zone_bonus * 20.0 + pull_rate * 24.0 + PlayerData.stat_guts * 0.35 + charcoal_bonus
	var ease = 45.0 + stability * 16.0 + temp_quality * 14.0 + float(_adjustment_hits) * 6.0 + PlayerData.stat_insight * 0.4
	var unique = 42.0 + PlayerData.stat_charm * 0.6 + _audience_points * 0.04 + float(_used_memo_count) * 2.0

	if _special_mix_name != "":
		unique += 16.0
	if _selected_hms == "amaburst":
		smoke += 4.0
		ease -= 4.0
	elif _selected_hms == "tanukish_lid":
		ease += 5.0
	if _easy_mode:
		taste += 2.0
		smoke += 2.0
		ease += 2.0
		unique += 2.0

	return {
		"taste": clampf(taste, 20.0, 100.0),
		"smoke": clampf(smoke, 20.0, 100.0),
		"ease": clampf(ease, 20.0, 100.0),
		"unique": clampf(unique, 20.0, 100.0),
	}


func _get_active_judge_focuses() -> Array[String]:
	var focus_ids: Array[String] = []
	var judge_ids = ["toki_kotetsu", str(_random_judge.get("id", ""))]
	for judge_id in judge_ids:
		var raw = JUDGE_FOCUS_PREFERENCES.get(judge_id, [])
		if typeof(raw) != TYPE_ARRAY:
			continue
		for focus in raw:
			var focus_id = str(focus)
			if focus_id == "":
				continue
			if not focus_ids.has(focus_id):
				focus_ids.append(focus_id)
	return focus_ids


func _finalize_and_show_result() -> void:
	_set_phase(15, "最終発表", "専門審査60% + 一般投票40%")
	_clear_choices()

	var ranking: Array = []
	var player_score = _build_player_score()
	ranking.append(player_score)
	ranking.append_array(_build_rival_scores())

	ranking.sort_custom(func(a, b):
		return float(a.get("total", 0.0)) > float(b.get("total", 0.0))
	)

	_player_rank = 4
	for i in range(ranking.size()):
		if str(ranking[i].get("id", "")) == "player":
			_player_rank = i + 1
			break

	_pending_reward = int(REWARD_BY_RANK.get(_player_rank, 0))
	if _player_rank == 1:
		EventFlags.set_value("ch1_tournament_loss_count", 0)
	else:
		_pending_reward = 0
		var losses = int(EventFlags.get_value("ch1_tournament_loss_count", 0)) + 1
		EventFlags.set_value("ch1_tournament_loss_count", losses)

	var lines: Array[String] = []
	lines.append("【あなたの得点内訳】")
	lines.append_array(_build_player_score_breakdown_lines())
	lines.append("")
	lines.append("【最終順位】")
	for i in range(ranking.size()):
		var row: Dictionary = ranking[i]
		var row_id = str(row.get("id", ""))
		var mid_total = _mid_player_total if row_id == "player" else float(_mid_rival_totals.get(row_id, float(row.get("total", 0.0))))
		var diff_from_mid = float(row.get("total", 0.0)) - mid_total
		lines.append("%d位 %s  %.1f点（専門 %.1f / 一般 %.1f）" % [
			i + 1,
			str(row.get("name", "-")),
			float(row.get("total", 0.0)),
			float(row.get("specialist", 0.0)),
			float(row.get("audience", 0.0)),
		])
		lines.append("   中間比 %+.1f" % diff_from_mid)

	if _special_mix_name != "":
		lines.append("特別ミックス: %s" % _special_mix_name)
	if _player_rank == 1:
		lines.append("賞金: %d円" % _pending_reward)
		lines.append("HAZE: GRAND SMOKE優勝！")
	else:
		lines.append("今回は %d位。1位になるまで本編進行不可。" % _player_rank)
		lines.append("賞金は再挑戦中は支給されない。")

	info_label.text = "\n".join(lines)

	# シーシャランク表示
	var player_score_data = _build_player_score()
	var rank_info = ShishaRank.calculate_rank(float(player_score_data.get("total", 0.0)), 4)
	var rank_text = ShishaRank.get_rank_display_text(float(player_score_data.get("total", 0.0)), 4)
	info_label.text += "\n\n━━━━━━━━━━━━━━━━━━━━"
	info_label.text += "\n　シーシャランク: %s" % rank_text
	info_label.text += "\n━━━━━━━━━━━━━━━━━━━━"
	EventFlags.set_value("ch4_tournament_shisha_rank", rank_info["rank"])

	# Ch5解禁判定（S/SS/SSSで真エンディングルート解禁）
	if _player_rank == 1 and ShishaRank.is_ch5_unlock_rank(float(player_score_data.get("total", 0.0)), 4):
		EventFlags.set_flag("ch5_unlocked", true)
		info_label.text += "\n\n……何かが目覚める気配がする。"
	elif _player_rank == 1:
		info_label.text += "\n\nまだ先がある気がする。もっと高みを目指せば……"

	if _player_rank == 1:
		_add_choice_button("優勝結果で進む", _apply_result_and_continue)
	else:
		_add_choice_button("もう一度挑戦する", _retry_tournament)
		var losses = int(EventFlags.get_value("ch1_tournament_loss_count", 0))
		if not _easy_mode and losses >= 2:
			_add_choice_button("難易度を下げて再挑戦", _enable_easy_mode_and_retry)
	_add_choice_button("タイトルに戻る", _return_to_title)
	_refresh_side_panel()


func _build_player_score() -> Dictionary:
	var score = _compute_player_score_components()
	return {
		"id": "player",
		"name": "はじめ",
		"specialist": float(score.get("specialist", 0.0)),
		"audience": float(score.get("audience", 0.0)),
		"total": float(score.get("total", 0.0)),
	}


func _compute_player_score_components() -> Dictionary:
	var specialist_base = _technical_points + _zone_bonus * 8.0 + float(_adjustment_hits) * 2.5
	var specialist = maxi(0.0, specialist_base)
	var audience_base = _audience_points + float(_count_theme_hits(_selected_flavors)) * 4.0
	var audience = maxi(0.0, audience_base)
	var specialist_mix_bonus = 0.0
	var audience_mix_bonus = 0.0

	if _special_mix_name == "地獄のメンソール":
		audience_mix_bonus += 8.0
	if _special_mix_name == "ピニャコラーダ":
		specialist_mix_bonus += 4.0
		audience_mix_bonus += 5.0

	
	var eq_flavor_bonus = PlayerData.get_equipment_flavor_bonus(_selected_flavors)
	specialist_mix_bonus += float(eq_flavor_bonus.get("specialist", 0.0))
	audience_mix_bonus += float(eq_flavor_bonus.get("audience", 0.0))


	var pipe_spec_bonus = 0.0
	var pipe_aud_bonus = 0.0
	if PlayerData.PIPE_DATA.has(PlayerData.equipment_pipe):
		var pd = PlayerData.PIPE_DATA[PlayerData.equipment_pipe]
		pipe_spec_bonus = float(pd.get("taste_bonus", 0) + pd.get("smoke_bonus", 0))
		pipe_aud_bonus = float(pd.get("taste_bonus", 0) + pd.get("presentation_bonus", 0))

	specialist += specialist_mix_bonus + pipe_spec_bonus
	audience += audience_mix_bonus + pipe_aud_bonus
	var weighted = specialist * 0.6 + audience * 0.4
	var easy_bonus = 3.0 if _easy_mode else 0.0
	return {
		"specialist": specialist,
		"audience": audience,
		"weighted": weighted,
		"easy_bonus": easy_bonus,
		"total": weighted + easy_bonus,
		"specialist_mix_bonus": specialist_mix_bonus,
		"audience_mix_bonus": audience_mix_bonus,
		"pipe_spec_bonus": pipe_spec_bonus,
		"pipe_aud_bonus": pipe_aud_bonus,
	}


func _build_player_score_breakdown_lines() -> Array[String]:
	var comp = _compute_player_score_components()
	var lines: Array[String] = []
	lines.append("専門 %.1f = max(0, 技術 %.1f + ゾーン %.1f + 調整 %.1f) + ミックス %.1f" % [
		float(comp.get("specialist", 0.0)),
		_technical_points,
		_zone_bonus * 8.0,
		float(_adjustment_hits) * 2.5,
		float(comp.get("specialist_mix_bonus", 0.0)),
	])
	lines.append("一般 %.1f = max(0, 一般基礎 %.1f + テーマ %.1f) + ミックス %.1f" % [
		float(comp.get("audience", 0.0)),
		_audience_points,
		float(_count_theme_hits(_selected_flavors)) * 4.0,
		float(comp.get("audience_mix_bonus", 0.0)),
	])
	lines.append("総合 %.1f = 専門×0.6 + 一般×0.4%s" % [
		float(comp.get("total", 0.0)),
		(" + EASY %+d" % int(round(float(comp.get("easy_bonus", 0.0))))) if _easy_mode else "",
	])
	return lines


func _prepare_rival_score_tables() -> void:
	var rivals = [
		{"id": "naru", "name": "なる", "specialist": 95.0, "audience": 92.0, "variance": 4.0},
		{"id": "master_hookah", "name": "マスター・フーカ", "specialist": 98.0, "audience": 90.0, "variance": 3.0},
		{"id": "sheikh", "name": "シェイク", "specialist": 100.0, "audience": 100.0, "variance": 1.0},
	]
	_rival_mid_scores.clear()
	_rival_final_scores.clear()

	for rival in rivals:
		var variance = float(rival.get("variance", 8.0))
		var rival_id = str(rival.get("id", ""))
		var rival_name = str(rival.get("name", ""))
		var base_spec = float(rival.get("specialist", 60.0)) + randf_range(-variance, variance)
		var base_aud = float(rival.get("audience", 60.0)) + randf_range(-variance, variance)
		base_spec += _get_rival_theme_bonus(rival_id, str(_theme.get("id", "")))
		if _easy_mode:
			base_spec -= 3.0
			base_aud -= 2.0

		var mid_spec = maxi(0.0, base_spec + randf_range(-4.0, 4.0))
		var mid_aud = maxi(0.0, base_aud + randf_range(-4.0, 4.0))
		var final_spec = maxi(0.0, mid_spec + randf_range(-6.0, 6.0))
		var final_aud = maxi(0.0, mid_aud + randf_range(-6.0, 6.0))

		_rival_mid_scores.append({
			"id": rival_id,
			"name": rival_name,
			"specialist": mid_spec,
			"audience": mid_aud,
			"total": mid_spec * 0.6 + mid_aud * 0.4,
		})
		_rival_final_scores.append({
			"id": rival_id,
			"name": rival_name,
			"specialist": final_spec,
			"audience": final_aud,
			"total": final_spec * 0.6 + final_aud * 0.4,
		})


func _build_rival_mid_scores() -> Array:
	if _rival_mid_scores.is_empty():
		_prepare_rival_score_tables()
	return _rival_mid_scores.duplicate(true)


func _build_rival_scores() -> Array:
	if _rival_final_scores.is_empty():
		_prepare_rival_score_tables()
	return _rival_final_scores.duplicate(true)


func _get_rival_theme_bonus(rival_id: String, theme_id: String) -> float:
	if rival_id == "naru" and (theme_id == "relax" or theme_id == "aftertaste"):
		return 6.0
	if rival_id == "master_hookah" and (theme_id == "relax" or theme_id == "fruity"):
		return 6.0
	if rival_id == "sheikh" and (theme_id == "high_heat" or theme_id == "aftertaste"):
		return 6.0
	return 0.0


func _apply_result_and_continue() -> void:
	if _player_rank == 1: # Assuming _player_rank is the correct variable for current rank
		PlayerData.add_money(REWARD_BY_RANK[1])
		PlayerData.add_stat("fame", 100)
		GameManager.log_history("第4章大会", "優勝")
		GameManager.queue_dialogue("res://data/dialogue/ending.json", "ending_start", "res://scenes/ui/staff_roll.tscn")
		get_tree().change_scene_to_file("res://scenes/dialogue/dialogue_box.tscn")
		return
	else:
		if _pending_reward > 0:
			PlayerData.add_money(_pending_reward)
			GameManager.log_money_change(_pending_reward)

		PlayerData.add_stat("charm", 2)
		PlayerData.add_stat("guts", 1)
		GameManager.log_stat_change("charm", 2)
		GameManager.log_stat_change("guts", 1)
		EventFlags.set_value("ch1_tournament_easy_mode", false)
		PlayerData.add_stat("insight", 1)
		GameManager.log_stat_change("insight", 1)

	EventFlags.set_flag("ch1_tournament_completed", true)
	EventFlags.set_value("ch1_tournament_rank", _player_rank)
	GameManager.set_transient("morning_notice", _build_post_tournament_notice())
	get_tree().change_scene_to_file("res://scenes/title/title_screen.tscn")

	if GameManager.current_phase == "interval":
		get_tree().change_scene_to_file(MORNING_PHONE_SCENE_PATH)
	else:
		get_tree().change_scene_to_file(TITLE_SCENE_PATH)


func _build_post_tournament_notice() -> String:
	var rank_text = "%d位" % _player_rank
	if _player_rank == 1:
		rank_text = "優勝"
	var notice = "HAZE: GRAND SMOKE %s。賞金 %d円 を獲得した。\n\n" % [rank_text, _pending_reward]
	notice += _build_sumi_feedback()
	return notice


func _build_sumi_feedback() -> String:
	var lines: Array[String] = ["──閉店後。スミさんがカウンターの向こうで腕を組んでいる。"]
	if _player_rank == 1:
		lines.append("スミさん「……ふん。まぐれじゃないことを、次で証明しろ」")
		lines.append("珍しく、ほんの少しだけ口元が緩んでいた気がする。")
		lines.append("スミさん「浮かれるのは今日だけだ。明日からは次の準備をしろ」")
	elif _player_rank <= 3:
		lines.append("スミさん「悪くはなかった。だが、詰めが甘い」")
		lines.append("スミさん「お前の弱点は分かっているはずだ。次までに潰せ」")
		lines.append("厳しい言葉。でも、目は真剣にこちらを見ていた。期待されているのだと思う。")
	else:
		lines.append("スミさん「……」")
		lines.append("何も言わない。それが一番堪える。")
		lines.append("スミさん「言いたいことは、お前自身が一番分かっているだろう」")
		lines.append("スミさん「悔しいなら、練習しろ。それだけだ」")
	return "\n".join(lines)


func _retry_tournament() -> void:
	get_tree().change_scene_to_file(TOURNAMENT_SCENE_PATH)


func _enable_easy_mode_and_retry() -> void:
	EventFlags.set_value("ch1_tournament_easy_mode", true)
	get_tree().change_scene_to_file(TOURNAMENT_SCENE_PATH)


func _return_to_title() -> void:
	get_tree().change_scene_to_file(TITLE_SCENE_PATH)


func _roll(success_rate: float) -> bool:
	var chance = clampf(success_rate, 5.0, 95.0)
	return randf() * 100.0 < chance


func _show_step_result_and_next(result_text: String, next_callable: Callable) -> void:
	_append_info(result_text)
	_clear_choices()
	_add_choice_button("次へ", next_callable)
	_refresh_side_panel()


func _count_theme_hits(flavor_ids: Array[String]) -> int:
	var count = 0
	var theme_flavors: Array = _theme.get("flavors", [])
	for flavor_id in flavor_ids:
		if theme_flavors.has(flavor_id):
			count += 1
	return count


func _has_alpha_heaven_flavor_selected() -> bool:
	for flavor_id in _selected_flavors:
		if ALPHA_HEAVEN_FLAVORS.has(flavor_id):
			return true
	return false


func _count_matching_memos(flavor_ids: Array[String]) -> int:
	var memo_entries = PlayerData.get_tournament_memos()
	if memo_entries.is_empty():
		return 0

	var count = 0
	for raw in memo_entries:
		if typeof(raw) != TYPE_DICTIONARY:
			continue
		var memo = raw as Dictionary
		var source_text = (str(memo.get("title", "")) + " " + str(memo.get("body", ""))).strip_edges()
		if source_text == "":
			continue

		var hit = 0
		for flavor_id in flavor_ids:
			if source_text.find(_flavor_name(flavor_id)) != -1:
				hit += 1
		if hit >= 2:
			count += 1
	return count


func _flavor_name(flavor_id: String) -> String:
	return str(FLAVOR_NAME_MAP.get(flavor_id, flavor_id))


func _selected_flavor_summary() -> String:
	if not _packing_choice.is_empty():
		return _format_pattern_grams(_packing_choice)
	var names: Array[String] = []
	for flavor_id in _selected_flavors:
		names.append(_flavor_name(flavor_id))
	return " / ".join(names)


func _heat_label() -> String:
	if _heat_state <= -2:
		return "低温"
	if _heat_state >= 2:
		return "高温"
	return "適正"


func _get_target_temp_range() -> Vector2:
	var min_temp = 178.0
	var max_temp = 204.0
	if _has_alpha_heaven_flavor_selected():
		min_temp += 8.0
		max_temp += 10.0
	match _selected_hms:
		"amaburst":
			min_temp += 6.0
			max_temp += 8.0
		"winkwink_hagal":
			min_temp -= 4.0
			max_temp -= 2.0
	return Vector2(min_temp, max_temp)


func _get_current_temp_value() -> float:
	var temp = 182.0
	temp += float(_heat_state) * 16.0
	temp += float(_steam_minutes - 6) * 2.0
	if _selected_charcoal_count == 4:
		temp += 8.0
	if _selected_hms == "amaburst":
		temp += 10.0
	elif _selected_hms == "tanukish_lid":
		temp -= 4.0
	temp += float(_pull_round) * 2.5
	return clampf(temp, TEMP_MIN, TEMP_MAX)


func _build_temperature_gauge_text(current_temp: float, target: Vector2) -> String:
	var lines: Array[String] = []
	var rows = 9
	var interval = (TEMP_MAX - TEMP_MIN) / float(rows - 1)
	for i in range(rows):
		var ratio = 1.0 - float(i) / float(rows - 1)
		var row_temp = lerpf(TEMP_MIN, TEMP_MAX, ratio)
		var in_target = row_temp >= target.x and row_temp <= target.y
		var cell = "■" if in_target else "│"
		var marker = "◆" if abs(current_temp - row_temp) <= interval * 0.5 else " "
		lines.append("%3d℃ %s%s" % [int(round(row_temp)), marker, cell])
	return "\n".join(lines)


func _refresh_side_panel() -> void:
	judge_label.text = "MC: パッキー / 焚口ショウ\n審査員: 土岐 鋼鉄 + %s\nテーマ: %s" % [
		str(_random_judge.get("name", "審査員")),
		str(_theme.get("name", "-")),
	]

	var target_temp = _get_target_temp_range()
	var current_temp = _get_current_temp_value()
	var lines: Array[String] = []
	lines.append("専門暫定: %.1f" % maxi(_technical_points, 0.0))
	lines.append("一般暫定: %.1f" % maxi(_audience_points, 0.0))
	lines.append("調整成功: %d / 3" % _adjustment_hits)
	lines.append("吸い出しヒット: %d / %d" % [_pull_hit_count, maxi(_pull_round, 1)])
	lines.append("熱状態: %s" % _heat_label())
	lines.append("温度: %d℃（目標 %d〜%d℃）" % [
		int(round(current_temp)),
		int(round(target_temp.x)),
		int(round(target_temp.y)),
	])
	lines.append("温度表示: ◆=現在 / ■=合格帯")
	lines.append(_build_temperature_gauge_text(current_temp, target_temp))
	lines.append("設定: %s + %s" % [
		PlayerData.get_equipment_name_by_value(_selected_bowl),
		PlayerData.get_equipment_name_by_value(_selected_hms),
	])
	lines.append("炭: %s" % PlayerData.get_equipped_item_name("charcoal"))
	if not _selected_flavors.is_empty():
		lines.append("配合: %s" % _selected_flavor_summary())
	if _special_mix_name != "":
		lines.append("特別: %s" % _special_mix_name)
	score_label.text = "\n".join(lines)

	var memos = PlayerData.get_tournament_memos()
	if memos.is_empty():
		memo_label.text = "攻略メモ\nなし"
		return

	var memo_lines: Array[String] = ["攻略メモ"]
	var max_rows = mini(3, memos.size())
	for i in range(max_rows):
		var row = memos[i]
		if typeof(row) != TYPE_DICTIONARY:
			continue
		memo_lines.append("・%s" % str((row as Dictionary).get("title", "メモ")))
	if memos.size() > max_rows:
		memo_lines.append("…他 %d件" % (memos.size() - max_rows))
	memo_label.text = "\n".join(memo_lines)
