extends Control

const TOTAL_STEPS := 16
const TOURNAMENT_SCENE_PATH := "res://scenes/tournament/ch1_tournament.tscn"
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

const REWARD_BY_RANK := {1: 30000, 2: 15000, 3: 5000, 4: 0}
const PULL_DIFFICULTY := [0.86, 1.0, 1.22, 1.06]


@onready var header_label: Label = %HeaderLabel
@onready var phase_label: Label = %PhaseLabel
@onready var info_label: RichTextLabel = %InfoLabel
@onready var choice_container: VBoxContainer = %ChoiceContainer
@onready var judge_label: Label = %JudgeLabel
@onready var score_label: RichTextLabel = %ScoreLabel
@onready var memo_label: RichTextLabel = %MemoLabel

var _theme: Dictionary = {}
var _random_judge: Dictionary = {}
var _selected_bowl: String = ""
var _selected_hms: String = ""
var _selected_flavors: Array[String] = []
var _flavor_checks: Array[CheckBox] = []
var _packing_choice: Dictionary = {}
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


func _ready() -> void:
	randomize()
	GameManager.play_bgm(GameManager.BGM_CHILLHOUSE_PATH, -8.0, true)
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
	_easy_mode = bool(EventFlags.get_value("ch1_tournament_easy_mode", false))

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
	for child in choice_container.get_children():
		child.queue_free()


func _add_choice_button(text: String, callback: Callable) -> Button:
	var button = Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(0, 40)
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.pressed.connect(callback)
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
		PlayerData.add_flavor("double_apple", 1)
		PlayerData.add_flavor("mint", 1)
		available = _get_available_flavors()
		_append_info("在庫不足のため運営配布フレーバーを受け取った。")

	for entry in available:
		var check = CheckBox.new()
		var flavor_id = str(entry.get("id", ""))
		check.text = "%s（在庫 %d）" % [_flavor_name(flavor_id), int(entry.get("amount", 0))]
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
	_set_phase(3, "パッキング配合（12g）", "配分を決める。配合の狙いが審査に直結。")
	_clear_choices()

	var patterns = _build_packing_patterns()
	for pattern in patterns:
		var text = "%s  |  %s" % [str(pattern.get("label", "配合")), _format_pattern_grams(pattern)]
		_add_choice_button(text, _on_packing_selected.bind(pattern))

	_refresh_side_panel()


func _build_packing_patterns() -> Array:
	var patterns: Array = []
	if _selected_flavors.is_empty():
		return patterns

	if _selected_flavors.size() == 1:
		var only_id = _selected_flavors[0]
		patterns.append({"label": "高密度パック", "style": "tight", "grams": {only_id: 12}})
		patterns.append({"label": "標準パック", "style": "balanced", "grams": {only_id: 12}})
		patterns.append({"label": "軽めパック", "style": "airy", "grams": {only_id: 12}})
		return patterns

	if _selected_flavors.size() == 2:
		var a = _selected_flavors[0]
		var b = _selected_flavors[1]
		patterns.append({"label": "均等配分", "style": "balanced", "grams": {a: 6, b: 6}})
		patterns.append({"label": "%s重視" % _flavor_name(a), "style": "focus_a", "focus": a, "grams": {a: 8, b: 4}})
		patterns.append({"label": "%s重視" % _flavor_name(b), "style": "focus_b", "focus": b, "grams": {a: 4, b: 8}})
		return patterns

	var f0 = _selected_flavors[0]
	var f1 = _selected_flavors[1]
	var f2 = _selected_flavors[2]
	patterns.append({"label": "均等配分", "style": "balanced", "grams": {f0: 4, f1: 4, f2: 4}})
	patterns.append({"label": "%s主軸" % _flavor_name(f0), "style": "focus_a", "focus": f0, "grams": {f0: 6, f1: 3, f2: 3}})
	patterns.append({"label": "高火力寄せ", "style": "heat", "focus": f0, "grams": {f0: 5, f1: 5, f2: 2}})
	return patterns


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
	_set_phase(4, "アルミ穴あけ", "リズムに合わせて通気を作る。")
	_clear_choices()
	_add_choice_button("ビート重視で穴あけ", _on_aluminum_choice.bind("beat"))
	_add_choice_button("均等に丁寧に穴あけ", _on_aluminum_choice.bind("stable"))
	_add_choice_button("高速で攻める", _on_aluminum_choice.bind("aggressive"))
	_refresh_side_panel()


func _on_aluminum_choice(mode: String) -> void:
	var success_rate = 0.0
	var success_spec = 0.0
	var fail_spec = -4.0
	var zone_gain = 0.0
	var result_line = ""

	match mode:
		"beat":
			success_rate = 58.0 + PlayerData.stat_technique * 0.45 + PlayerData.stat_sense * 0.18
			success_spec = 12.0
			zone_gain = 0.20
			result_line = "ビート穴あけ"
		"stable":
			success_rate = 66.0 + PlayerData.stat_technique * 0.35 + PlayerData.stat_sense * 0.24
			success_spec = 10.0
			zone_gain = 0.28
			result_line = "均等穴あけ"
		"aggressive":
			success_rate = 44.0 + PlayerData.stat_technique * 0.35 + PlayerData.stat_guts * 0.36
			success_spec = 17.0
			zone_gain = 0.08
			fail_spec = -8.0
			result_line = "攻め穴あけ"

	if _easy_mode:
		success_rate += 8.0
	var success = _roll(success_rate)
	if success:
		_technical_points += success_spec
		_zone_bonus += zone_gain
		if mode == "aggressive":
			_audience_points += 3.0
		_show_step_result_and_next("%s 成功（成功率 %.0f%%）" % [result_line, clampf(success_rate, 5.0, 95.0)], _show_charcoal_prep_step)
	else:
		_technical_points += fail_spec
		if mode == "aggressive":
			_heat_state += 1
		_show_step_result_and_next("%s 失敗（成功率 %.0f%%）" % [result_line, clampf(success_rate, 5.0, 95.0)], _show_charcoal_prep_step)

	_zone_bonus = clampf(_zone_bonus, -0.4, 1.2)
	_heat_state = clampi(_heat_state, -3, 3)


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
	_set_phase(6, "炭の配置", "3〜5個の炭を配置する。")
	_clear_choices()
	_add_choice_button("3個（安定）", _on_charcoal_place_selected.bind(3))
	_add_choice_button("4個（標準）", _on_charcoal_place_selected.bind(4))
	_add_choice_button("5個（高火力）", _on_charcoal_place_selected.bind(5))
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
		5:
			delta_spec += 10.0
			_zone_bonus -= 0.06
			_heat_state += 1

	if PlayerData.equipment_charcoal == "cube_charcoal":
		if count >= 4:
			delta_spec += 4.0
			delta_aud += 4.0
		else:
			delta_spec -= 4.0

	if _selected_hms == "amaburst" and count == 5:
		delta_spec += 3.0
		_heat_state += 1

	_technical_points += delta_spec
	_audience_points += delta_aud
	_zone_bonus = clampf(_zone_bonus, -0.4, 1.2)
	_heat_state = clampi(_heat_state, -3, 3)
	_show_step_result_and_next("炭配置結果: 専門 %+d / 一般 %+d" % [int(round(delta_spec)), int(round(delta_aud))], _show_steam_step)


func _show_steam_step() -> void:
	_set_phase(7, "蒸らしタイマー", "5〜10分から蒸らし時間を設定。")
	_clear_choices()
	for minute in [5, 6, 7, 8, 9, 10]:
		_add_choice_button("%d分" % minute, _on_steam_selected.bind(minute))
	_refresh_side_panel()


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
	_show_step_result_and_next("蒸らし結果: 専門 %+d（適正 %d〜%d分）" % [int(round(delta_spec)), min_minute, max_minute], _show_pull_step)


func _get_steam_optimal_range(charcoal_count: int) -> Vector2i:
	match charcoal_count:
		3:
			return Vector2i(5, 7)
		4:
			return Vector2i(4, 6)
		5:
			return Vector2i(3, 5)
		_:
			return Vector2i(5, 7)


func _show_pull_step() -> void:
	var round_number = _pull_round + 1
	var step_no = 8 + _pull_round * 2
	_set_phase(step_no, "吸い出し %d回目" % round_number, "ゲージを止める。熱状態: %s" % _heat_label())

	if _pull_round == 2:
		_append_info("3回目は最難関。")
	if PlayerData.equipment_charcoal == "cube_charcoal":
		_append_info("キューブ炭: 有効範囲が狭い代わりに成功時リターンが大きい。")

	_clear_choices()
	_add_choice_button("安全域で止める", _on_pull_choice.bind("safe"))
	_add_choice_button("有効域を狙う", _on_pull_choice.bind("normal"))
	_add_choice_button("完璧域を狙う", _on_pull_choice.bind("perfect"))
	_refresh_side_panel()


func _on_pull_choice(mode: String) -> void:
	var difficulty = float(PULL_DIFFICULTY[_pull_round])
	var heat_penalty = float(abs(_heat_state)) * 8.0
	var control = 45.0 + PlayerData.stat_technique * 0.45 + _zone_bonus * 22.0 - heat_penalty
	var brave = 18.0 + PlayerData.stat_guts * 0.55 + PlayerData.stat_technique * 0.2 + _zone_bonus * 12.0 - heat_penalty * 1.2

	if _has_alpha_heaven_flavor_selected():
		control += 2.0
		brave += 5.0
	if _selected_hms == "amaburst":
		control -= 2.0
		brave -= 4.0

	var success_rate = 0.0
	var success_spec = 0.0
	var success_aud = 0.0
	var fail_spec = 0.0
	var mode_label = ""

	match mode:
		"safe":
			success_rate = control + 24.0 - difficulty * 6.0
			success_spec = 8.0
			fail_spec = 2.0
			mode_label = "安全域"
		"normal":
			success_rate = control + 8.0 - difficulty * 8.0
			success_spec = 14.0
			success_aud = 4.0
			fail_spec = -6.0
			mode_label = "有効域"
		"perfect":
			success_rate = brave - difficulty * 10.0
			success_spec = 24.0
			success_aud = 6.0
			fail_spec = -12.0
			mode_label = "完璧域"
			if PlayerData.equipment_charcoal == "cube_charcoal":
				success_rate -= 6.0
				success_spec += 8.0
				success_aud += 5.0
				fail_spec -= 6.0

	if _easy_mode:
		success_rate += 10.0

	var rolled_success = _roll(success_rate)
	var result_text = "%s: " % mode_label
	if rolled_success:
		_technical_points += success_spec
		_audience_points += success_aud
		if mode == "perfect" and _pull_round == 2:
			_technical_points += 6.0
		result_text += "成功（成功率 %.0f%%）" % clampf(success_rate, 5.0, 95.0)
		_heat_state += 1
	else:
		_technical_points += fail_spec
		result_text += "失敗（成功率 %.0f%%）" % clampf(success_rate, 5.0, 95.0)
		if mode == "safe":
			_heat_state -= 1
		else:
			_heat_state += 2
		if mode == "perfect" and _selected_hms == "amaburst":
			_technical_points -= 2.0

	_heat_state = clampi(_heat_state, -3, 3)
	if _pull_round >= 3:
		_show_step_result_and_next(result_text, _show_presentation_intro)
	else:
		_show_step_result_and_next(result_text, _show_adjustment_step.bind(_pull_round))


func _show_adjustment_step(round_index: int) -> void:
	var step_no = 9 + round_index * 2
	var target_action = _target_adjust_action()
	_set_phase(step_no, "調整 %d回目" % (round_index + 1), _build_adjustment_cue(target_action, round_index))
	_clear_choices()
	_add_choice_button("温度を上げる（蓋を閉める）", _on_adjustment_choice.bind("up", target_action, round_index))
	_add_choice_button("現状維持", _on_adjustment_choice.bind("stay", target_action, round_index))
	_add_choice_button("温度を下げる（蓋を開ける）", _on_adjustment_choice.bind("down", target_action, round_index))
	_refresh_side_panel()


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


func _on_adjustment_choice(chosen_action: String, target_action: String, round_index: int) -> void:
	var success = chosen_action == target_action
	var result_line = ""
	if success:
		_adjustment_hits += 1
		_technical_points += 8.0
		if _heat_state > 0:
			_heat_state -= 1
		elif _heat_state < 0:
			_heat_state += 1
		result_line = "調整成功"
	else:
		_technical_points -= 6.0
		match chosen_action:
			"up":
				_heat_state += 1
			"down":
				_heat_state -= 1
			_:
				if _heat_state > 0:
					_heat_state += 1
				elif _heat_state < 0:
					_heat_state -= 1
		result_line = "調整失敗"

	if round_index == 2 and _adjustment_hits >= 3:
		_technical_points += 10.0
		_audience_points += 4.0
		result_line += "（3連続成功ボーナス）"

	_heat_state = clampi(_heat_state, -3, 3)
	_pull_round += 1
	_show_step_result_and_next(result_line, _show_pull_step)


func _show_presentation_intro() -> void:
	_set_phase(15, "プレゼン", "3ターンで審査員に意図を伝える。")
	_rebuttal_prompt = REBUTTAL_PROMPTS[randi() % REBUTTAL_PROMPTS.size()]
	_clear_choices()
	_add_choice_button("姿勢アピールへ", _show_presentation_stance)
	_refresh_side_panel()


func _show_presentation_stance() -> void:
	_set_phase(15, "プレゼン: 姿勢", "どの姿勢で語る？")
	_clear_choices()
	_add_choice_button("技術で語る", _on_stance_selected.bind("tech"))
	_add_choice_button("想いで語る", _on_stance_selected.bind("heart"))
	_add_choice_button("素直に語る", _on_stance_selected.bind("honest"))
	_add_choice_button("攻めて語る", _on_stance_selected.bind("aggressive"))
	_refresh_side_panel()


func _on_stance_selected(stance_id: String) -> void:
	var preference = str(STANCE_PREFERENCE.get(str(_random_judge.get("id", "")), "tech"))
	var spec_gain = 6.0
	var aud_gain = 4.0

	if stance_id == preference:
		spec_gain += 6.0
	if stance_id == "tech":
		spec_gain += PlayerData.stat_technique * 0.08
	if stance_id == "heart" or stance_id == "aggressive":
		aud_gain += 6.0
	if stance_id == "honest":
		spec_gain += 2.0
		aud_gain += 2.0
	if _easy_mode:
		spec_gain += 2.0

	_technical_points += spec_gain
	_audience_points += aud_gain
	_show_step_result_and_next("姿勢アピール: 専門 %+d / 一般 %+d" % [int(round(spec_gain)), int(round(aud_gain))], _show_presentation_rebuttal)


func _show_presentation_rebuttal() -> void:
	_set_phase(15, "プレゼン: 切り返し", str(_rebuttal_prompt.get("question", "質問が飛んできた。")))
	_clear_choices()
	_add_choice_button("正面から返す", _on_rebuttal_selected.bind("front"))
	_add_choice_button("素直に認める", _on_rebuttal_selected.bind("admit"))
	_add_choice_button("切り口を変える", _on_rebuttal_selected.bind("reframe"))
	_refresh_side_panel()


func _on_rebuttal_selected(option_id: String) -> void:
	var best = str(_rebuttal_prompt.get("best", "front"))
	var spec_gain = 0.0
	var aud_gain = 0.0
	if option_id == best:
		spec_gain += 12.0 + PlayerData.stat_insight * 0.06
		aud_gain += 4.0
	elif option_id == "admit":
		spec_gain += 2.0
		aud_gain += 2.0
	else:
		spec_gain -= 4.0
		aud_gain -= 1.0

	_technical_points += spec_gain
	_audience_points += aud_gain
	_show_step_result_and_next("切り返し: 専門 %+d / 一般 %+d" % [int(round(spec_gain)), int(round(aud_gain))], _show_presentation_final_word)


func _show_presentation_final_word() -> void:
	_set_phase(15, "プレゼン: 最後の一言", "最後に何を残すか。")
	_clear_choices()

	_add_choice_button("今日まで支えてくれた人に届く一杯です", _on_final_word_selected.bind({"spec": 4.0, "aud": 10.0}))
	_add_choice_button("温度と密度を最後まで整えました", _on_final_word_selected.bind({"spec": 10.0, "aud": 3.0}))
	_add_choice_button("まだ未熟ですが今の全力です", _on_final_word_selected.bind({"spec": 6.0, "aud": 6.0}))

	if _used_memo_count > 0:
		_add_choice_button("集めたメモを全部つないで仕上げました", _on_final_word_selected.bind({"spec": 8.0, "aud": 6.0}))
	if AffinityManager.get_level("kirara") >= 2:
		_add_choice_button("見た目も味も最後まで魅せ切ります", _on_final_word_selected.bind({"spec": 4.0, "aud": 12.0}))
	if AffinityManager.get_level("adam") >= 2:
		_add_choice_button("理論で積み上げた配合です", _on_final_word_selected.bind({"spec": 12.0, "aud": 3.0}))

	_refresh_side_panel()


func _on_final_word_selected(gain: Dictionary) -> void:
	var spec_gain = float(gain.get("spec", 0.0))
	var aud_gain = float(gain.get("aud", 0.0))
	_technical_points += spec_gain
	_audience_points += aud_gain
	_show_step_result_and_next("最後の一言: 専門 %+d / 一般 %+d" % [int(round(spec_gain)), int(round(aud_gain))], _finalize_and_show_result)


func _finalize_and_show_result() -> void:
	_set_phase(16, "審査結果", "専門審査60% + 一般投票40%")
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
	for i in range(ranking.size()):
		var row: Dictionary = ranking[i]
		lines.append("%d位 %s  %.1f点（専門 %.1f / 一般 %.1f）" % [
			i + 1,
			str(row.get("name", "-")),
			float(row.get("total", 0.0)),
			float(row.get("specialist", 0.0)),
			float(row.get("audience", 0.0)),
		])

	if _special_mix_name != "":
		lines.append("特別ミックス: %s" % _special_mix_name)
	if _player_rank == 1:
		lines.append("賞金: %d円" % _pending_reward)
		lines.append("地方大会優勝！")
	else:
		lines.append("今回は %d位。1位になるまで本編進行不可。" % _player_rank)
		lines.append("賞金は再挑戦中は支給されない。")

	info_label.text = "\n".join(lines)

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
	var specialist = maxi(0.0, _technical_points + _zone_bonus * 8.0 + float(_adjustment_hits) * 2.5)
	var audience = maxi(0.0, _audience_points + float(_count_theme_hits(_selected_flavors)) * 4.0)
	if _special_mix_name == "地獄のメンソール":
		audience += 8.0
	if _special_mix_name == "ピニャコラーダ":
		specialist += 4.0
		audience += 5.0
	var total = specialist * 0.6 + audience * 0.4
	if _easy_mode:
		total += 3.0
	return {
		"id": "player",
		"name": "はじめ",
		"specialist": specialist,
		"audience": audience,
		"total": total,
	}


func _build_rival_scores() -> Array:
	var rivals = [
		{"id": "nishio", "name": "にしお", "specialist": 66.0, "audience": 55.0, "variance": 8.0},
		{"id": "adam", "name": "アダム", "specialist": 73.0, "audience": 48.0, "variance": 9.0},
		{"id": "ryuji", "name": "リュウジ", "specialist": 60.0, "audience": 67.0, "variance": 9.0},
	]
	var result: Array = []
	for rival in rivals:
		var variance = float(rival.get("variance", 8.0))
		var spec = float(rival.get("specialist", 60.0)) + randf_range(-variance, variance)
		var aud = float(rival.get("audience", 60.0)) + randf_range(-variance, variance)
		spec += _get_rival_theme_bonus(str(rival.get("id", "")), str(_theme.get("id", "")))
		if _easy_mode:
			spec -= 3.0
			aud -= 2.0
		var total = spec * 0.6 + aud * 0.4
		result.append({
			"id": str(rival.get("id", "")),
			"name": str(rival.get("name", "")),
			"specialist": spec,
			"audience": aud,
			"total": total,
		})
	return result


func _get_rival_theme_bonus(rival_id: String, theme_id: String) -> float:
	if rival_id == "nishio" and (theme_id == "relax" or theme_id == "aftertaste"):
		return 4.0
	if rival_id == "adam" and theme_id == "high_heat":
		return 6.0
	if rival_id == "ryuji" and (theme_id == "high_heat" or theme_id == "fruity"):
		return 5.0
	return 0.0


func _apply_result_and_continue() -> void:
	if _pending_reward > 0:
		PlayerData.add_money(_pending_reward)
		GameManager.log_money_change(_pending_reward)

	if _player_rank == 1:
		PlayerData.add_stat("charm", 2)
		PlayerData.add_stat("guts", 1)
		GameManager.log_stat_change("charm", 2)
		GameManager.log_stat_change("guts", 1)
		EventFlags.set_value("ch1_tournament_easy_mode", false)
	else:
		PlayerData.add_stat("insight", 1)
		GameManager.log_stat_change("insight", 1)

	EventFlags.set_flag("ch1_tournament_completed", true)
	EventFlags.set_value("ch1_tournament_rank", _player_rank)
	GameManager.set_transient("morning_notice", _build_post_tournament_notice())
	GameManager.transition_to_interval()

	if GameManager.current_phase == "interval":
		get_tree().change_scene_to_file(MORNING_PHONE_SCENE_PATH)
	else:
		get_tree().change_scene_to_file(TITLE_SCENE_PATH)


func _build_post_tournament_notice() -> String:
	var rank_text = "%d位" % _player_rank
	if _player_rank == 1:
		rank_text = "優勝"
	return "地方大会 %s。賞金 %d円 を獲得した。" % [rank_text, _pending_reward]


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


func _refresh_side_panel() -> void:
	judge_label.text = "MC: パッキー / 焚口ショウ\n審査員: 土岐 鋼鉄 + %s\nテーマ: %s" % [
		str(_random_judge.get("name", "審査員")),
		str(_theme.get("name", "-")),
	]

	var lines: Array[String] = []
	lines.append("専門暫定: %.1f" % maxi(_technical_points, 0.0))
	lines.append("一般暫定: %.1f" % maxi(_audience_points, 0.0))
	lines.append("調整成功: %d / 3" % _adjustment_hits)
	lines.append("熱状態: %s" % _heat_label())
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
