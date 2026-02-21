extends Control

const TOTAL_STEPS := 6
const DEFAULT_NEXT_SCENE := "res://scenes/daily/map.tscn"
const GAUGE_TIMER_WAIT := 0.03
const ADJUST_TOTAL_ROUNDS := 3
const TEMP_PASS_LINE := 0.56
const TEMP_TOP_LINE := 0.78
const TEMP_LEVEL_MIN := 0.0
const TEMP_LEVEL_MAX := 1.0

@onready var header_label: Label = %HeaderLabel
@onready var phase_label: Label = %PhaseLabel
@onready var info_label: RichTextLabel = %InfoLabel
@onready var choice_container: VBoxContainer = %ChoiceContainer

var _selected_pack_style: String = ""
var _selected_charcoal_count: int = 3
var _selected_steam_minutes: int = 6

var _pull_quality: String = "未判定"
var _pull_step_finished: bool = false
var _pull_timer: Timer
var _pull_is_holding: bool = false
var _pull_gauge_value: float = 0.5
var _pull_gauge_direction: float = 1.0
var _pull_gauge_speed: float = 1.0
var _pull_target_center: float = 0.5
var _pull_target_width: float = 0.18

var _adjust_timer: Timer
var _adjust_is_holding: bool = false
var _adjust_step_finished: bool = false
var _adjust_round: int = 0
var _adjust_success_count: int = 0
var _adjust_target_action: String = ""
var _adjust_selected_action: String = ""
var _adjust_gauge_value: float = 0.5
var _adjust_gauge_direction: float = 1.0
var _adjust_gauge_speed: float = 1.0
var _adjust_target_center: float = 0.5
var _adjust_target_width: float = 0.18

var _temp_level: float = 0.34
var _adjust_round_drift: float = 0.0


func _ready() -> void:
	GameManager.play_bgm(GameManager.BGM_TONARI_PATH, -10.0, true)
	_pull_timer = Timer.new()
	_pull_timer.wait_time = GAUGE_TIMER_WAIT
	_pull_timer.one_shot = false
	_pull_timer.timeout.connect(_on_pull_timer_tick)
	add_child(_pull_timer)

	_adjust_timer = Timer.new()
	_adjust_timer.wait_time = GAUGE_TIMER_WAIT
	_adjust_timer.one_shot = false
	_adjust_timer.timeout.connect(_on_adjust_timer_tick)
	add_child(_adjust_timer)

	_show_intro_step()


func _set_phase(step_num: int, title: String, body: String) -> void:
	header_label.text = title
	phase_label.text = "TUTORIAL STEP %d / %d" % [step_num, TOTAL_STEPS]
	info_label.text = body


func _clear_choices() -> void:
	for child in choice_container.get_children():
		child.queue_free()
	if _pull_timer != null:
		_pull_timer.stop()
	_pull_is_holding = false
	if _adjust_timer != null:
		_adjust_timer.stop()
	_adjust_is_holding = false


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


func _show_intro_step() -> void:
	_set_phase(
		1,
		"スミさんの特訓",
		"\n".join([
			"スミ「さっき渡したダブルアップルとミント、練習に使え」",
			"スミ「大会は基礎で勝つ。まずは王道のミックスだ」",
			"",
			"ここではシーシャ作りの流れを短く実演する。",
			"1. 配分を決める",
			"2. 詰め方を決める",
			"3. 炭と蒸らしを決める",
			"4. 吸い出しで温度帯へ入れる",
			"5. 温度維持の調整をやる",
		])
	)
	_clear_choices()
	_add_choice_button("特訓を始める", _show_mix_step)

func _show_mix_step() -> void:
	_set_phase(2, "フレーバーの配分", "ダブルアップルとミントの配合を決める。\n使うのは中東産のクラシックなダブルアップルと、それに負けない強めのミントだ。")
	_clear_choices()
	_add_choice_button("ダブルアップル6g / ミント6g（推奨）", _on_mix_selected.bind("half"))
	_add_choice_button("ダブルアップル8g / ミント4g", _on_mix_selected.bind("apple_heavy"))
	_add_choice_button("ダブルアップル4g / ミント8g", _on_mix_selected.bind("mint_heavy"))

func _on_mix_selected(mix_type: String) -> void:
	var feedback = ""
	match mix_type:
		"half":
			feedback = "甘さと清涼感のバランスが良い王道の配合。\nスミ「ダブルの甘さをミントが引き締める。これが基本の形だ」"
		"apple_heavy":
			feedback = "アップルの主張が強い重厚な味。ミントは後味程度。\nスミ「重たい煙で満足感を出したい時にはこれだ」"
		"mint_heavy":
			feedback = "清涼感が先行する。味が少し軽く飛ぶリスクがある。\nスミ「爽快感は出るが、熱を入れすぎると味が消えるぞ」"
		_:
			feedback = "配合を決めた。"

	_set_phase(
		2,
		"フレーバーの配分: 決定",
		"選んだ配合: %s\n%s\n\nスミ「ミックスは自由だが、芯がないとただ味が濁るだけだ。次は詰め方だ」" % [mix_type.to_upper(), feedback]
	)
	_clear_choices()
	_add_choice_button("次へ（詰め方）", _show_pack_step)


func _show_pack_step() -> void:
	_set_phase(3, "詰め方", "フレーバーをボウル（陶器）に盛る方法を選ぶ。\nスミ「空気の通り道をどう作るかで、煙の重さも味の出方も変わる」")
	_clear_choices()
	_add_choice_button("ふんわり詰める（推奨）", _on_pack_style_selected.bind("light"))
	_add_choice_button("標準で詰める", _on_pack_style_selected.bind("standard"))
	_add_choice_button("ぎゅうぎゅうに詰める", _on_pack_style_selected.bind("tight"))


func _on_pack_style_selected(style_id: String) -> void:
	_selected_pack_style = style_id
	var feedback = ""
	match style_id:
		"light":
			feedback = "煙道が確保されて立ち上がりが安定。\nスミ「空気が通るから焦げにくい。最初のうちはこれで感覚を掴め」"
		"standard":
			feedback = "煙量は出るが、熱管理で差が出る。\nスミ「これでもいいが、火の入れ方を間違えれば台無しになるぞ」"
		"tight":
			feedback = "熱が籠もりやすく、焦げやすい。\nスミ「味が重くなる分、吸い出しはシビアだ。玄人向けだな」"
		_:
			feedback = "詰め方を決めた。"

	_set_phase(
		3,
		"詰め方: 決定",
		"選んだ詰め方: %s\n%s\n\nスミ「詰めで半分決まる。ここからが本当の勝負、熱の入れ方だ」" % [style_id.to_upper(), feedback]
	)
	_clear_choices()
	_add_choice_button("次へ（炭と蒸らし）", _show_heat_step)


func _show_heat_step() -> void:
	_set_phase(
		4,
		"熱を作る",
		"炭の数と蒸らし時間をセットで決める。\nスミ「高温で一気に味を出すか、じっくり温めるか。お前の意図が問われる」"
	)
	_clear_choices()
	_add_choice_button("炭3個 / 蒸らし6分（安定）", _on_heat_selected.bind(3, 6))
	_add_choice_button("炭4個 / 蒸らし5分（立ち上がり重視）", _on_heat_selected.bind(4, 5))
	_add_choice_button("炭4個 / 蒸らし8分（過熱リスク）", _on_heat_selected.bind(4, 8))


func _on_heat_selected(charcoal_count: int, steam_minutes: int) -> void:
	_selected_charcoal_count = charcoal_count
	_selected_steam_minutes = steam_minutes
	var risk = "安定寄り"
	if charcoal_count >= 4 and steam_minutes >= 8:
		risk = "過熱リスク高"
	elif charcoal_count >= 4:
		risk = "高火力寄り"

	_set_phase(
		4,
		"熱を作る: 決定",
		"設定: 炭%d個 / 蒸らし%d分\n判定: %s\n\nスミ「いいだろう。仕上げに自分で吸って、煙の温度を狙った場所に落とし込め」" % [
			_selected_charcoal_count,
			_selected_steam_minutes,
			risk,
		]
	)
	_clear_choices()
	_add_choice_button("次へ（吸い出し練習）", _show_pull_step)


func _show_pull_step() -> void:
	_temp_level = _compute_pull_start_temp_level()
	_set_phase(
		5,
		"吸い出し練習",
		"吸い出し前は温度が合格ライン未達。吸い出しで温度帯に置く。\n※吸い出しゲージはタイミング用、温度状態は別管理。"
	)
	_clear_choices()
	_pull_step_finished = false
	_pull_is_holding = false
	_configure_pull_by_setup()

	var hold_button = Button.new()
	hold_button.text = "押して吸う（離して止める）"
	hold_button.custom_minimum_size = Vector2(0, 48)
	hold_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hold_button.button_down.connect(_on_pull_hold_started)
	hold_button.button_up.connect(_on_pull_hold_released)
	choice_container.add_child(hold_button)

	_update_pull_text("スミ「焦るな。合格ラインと最高ラインの間に置け」")


func _compute_pull_start_temp_level() -> float:
	var level = TEMP_PASS_LINE - 0.22
	if _selected_pack_style == "light":
		level += 0.03
	elif _selected_pack_style == "tight":
		level -= 0.04
	if _selected_charcoal_count >= 4:
		level += 0.02
	if _selected_steam_minutes >= 7:
		level += 0.03
	elif _selected_steam_minutes <= 5:
		level -= 0.02
	return clampf(level, 0.14, TEMP_PASS_LINE - 0.04)


func _configure_pull_by_setup() -> void:
	var speed = 0.95
	var width = 0.18
	var center = _temperature_center()
	if _selected_pack_style == "light":
		speed -= 0.08
		width += 0.02
		center -= 0.01
	elif _selected_pack_style == "tight":
		speed += 0.16
		width -= 0.03
		center += 0.02

	if _selected_charcoal_count >= 4:
		speed += 0.08
	if _selected_steam_minutes >= 7:
		speed += 0.18
		width -= 0.02
		center += 0.03
	elif _selected_steam_minutes <= 5:
		speed -= 0.05
		center -= 0.02

	_pull_gauge_speed = clampf(speed, 0.65, 2.2)
	_pull_target_width = clampf(width, 0.08, 0.25)
	_pull_target_center = clampf(center + randf_range(-0.03, 0.03), TEMP_PASS_LINE + 0.03, TEMP_TOP_LINE - 0.03)
	_pull_gauge_value = clampf(_temp_level + randf_range(-0.04, 0.08), TEMP_LEVEL_MIN, TEMP_LEVEL_MAX)
	_pull_gauge_direction = 1.0


func _on_pull_hold_started() -> void:
	if _pull_step_finished:
		return
	if _pull_is_holding:
		return
	_pull_is_holding = true
	if _pull_timer.is_stopped():
		_pull_timer.start()
	GameManager.play_ui_se("cursor")
	_update_pull_text("吸い出し中...離すと判定")


func _on_pull_hold_released() -> void:
	if _pull_step_finished:
		return
	if not _pull_is_holding:
		return
	_pull_is_holding = false
	if not _pull_timer.is_stopped():
		_pull_timer.stop()
	_resolve_pull_quality()


func _on_pull_timer_tick() -> void:
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
	_update_pull_text("吸い出し中...離すと判定")


func _resolve_pull_quality() -> void:
	_pull_step_finished = true
	var quality = _evaluate_gauge_quality(_pull_gauge_value, _pull_target_center, _pull_target_width)
	_pull_quality = quality

	var settled = _pull_gauge_value
	match quality:
		"perfect":
			settled = lerpf(_pull_gauge_value, _pull_target_center, 0.35)
		"good":
			settled = lerpf(_pull_gauge_value, _pull_target_center, 0.2)
		"near":
			settled = _pull_gauge_value
		_:
			if _pull_gauge_value >= _pull_target_center:
				settled = _pull_gauge_value + 0.05
			else:
				settled = _pull_gauge_value - 0.05

	_temp_level = clampf(settled, TEMP_LEVEL_MIN, TEMP_LEVEL_MAX)

	var feedback = ""
	match quality:
		"perfect":
			feedback = "完璧な温度帯にピタッと入った。\nスミ「いい腕だ。煙が一番旨い瞬間を捉えている」"
		"good":
			feedback = "実戦でも十分通る合格ライン。\nスミ「悪くない。客に出せるレベルには乗っている」"
		"near":
			feedback = "合格ラインギリギリ。\nスミ「惜しい。熱が少し暴れているな。意識を集中しろ」"
		_:
			feedback = "温度帯を完全に外した。\nスミ「焦りすぎだ。煙の味を殺しているぞ」"

	GameManager.play_ui_se("confirm" if quality != "miss" else "cancel")
	_update_pull_text("吸い出し判定: %s\n%s\n\n現在の温度状態: %s" % [quality.to_upper(), feedback, _temperature_zone_label(_temp_level)])
	_clear_choices()
	_add_choice_button("次へ（温度調整の特訓）", _start_adjustment_tutorial)


func _update_pull_text(status_text: String) -> void:
	var preview_temp = _temp_level
	if _pull_is_holding:
		preview_temp = _pull_gauge_value
	elif _pull_step_finished:
		preview_temp = _temp_level
	var bar = _build_gauge_bar(_pull_gauge_value, _pull_target_center, _pull_target_width)
	var lines: Array[String] = []
	lines.append(status_text)
	lines.append("吸い出しで◆を合格ライン〜最高ラインの間に置く。")
	lines.append("ゲージ◆=手元のタイミング / 温度状態=右下の帯表示")
	lines.append_array(_build_temperature_band_lines(preview_temp))
	lines.append("タイミング目標帯 ■ / ポインタ ◆")
	lines.append(bar)
	info_label.text = "\n".join(lines)


func _start_adjustment_tutorial() -> void:
	_adjust_round = 0
	_adjust_success_count = 0
	_adjust_round_drift = 0.0
	_show_adjustment_round()


func _show_adjustment_round() -> void:
	_prepare_adjustment_target(_adjust_round)
	var round_num = _adjust_round + 1
	var cue = _build_adjustment_cue()
	var lines: Array[String] = []
	lines.append("吸っていると温度はぶれてくる。合格ラインと最高ラインを維持する。")
	lines.append(cue)
	lines.append_array(_build_temperature_band_lines(_temp_level, _adjust_round_drift))
	lines.append("まず方向を選択してから、ゲージでタイミング調整する。")
	lines.append("成功条件: 方向が正解 + タイミングGOOD以上 + 温度帯へ近づく。")
	_set_phase(
		6,
		"温度調整 %d / %d" % [round_num, ADJUST_TOTAL_ROUNDS],
		"\n".join(lines)
	)
	_clear_choices()
	_add_choice_button("温度を上げる", _on_adjust_action_selected.bind("up"))
	_add_choice_button("現状維持", _on_adjust_action_selected.bind("stay"))
	_add_choice_button("温度を下げる", _on_adjust_action_selected.bind("down"))


func _prepare_adjustment_target(round_index: int) -> void:
	_apply_adjustment_drift(round_index)
	_adjust_target_action = _determine_adjust_target_action()


func _apply_adjustment_drift(round_index: int) -> void:
	var drift = 0.0
	match round_index:
		0:
			drift = -randf_range(0.10, 0.16)
		1:
			drift = randf_range(0.11, 0.17)
		_:
			drift = randf_range(-0.12, 0.12)

	if _selected_pack_style == "tight":
		if drift > 0.0:
			drift += 0.02
		else:
			drift -= 0.02
	elif _selected_pack_style == "light":
		drift *= 0.9

	if _selected_steam_minutes >= 7 and drift > 0.0:
		drift += 0.02
	elif _selected_steam_minutes <= 5 and drift < 0.0:
		drift -= 0.01

	_adjust_round_drift = drift
	_temp_level = clampf(_temp_level + drift, TEMP_LEVEL_MIN, TEMP_LEVEL_MAX)


func _determine_adjust_target_action() -> String:
	if _temp_level < TEMP_PASS_LINE:
		return "up"
	if _temp_level > TEMP_TOP_LINE:
		return "down"
	var center = _temperature_center()
	if abs(_temp_level - center) <= 0.045:
		return "stay"
	return "up" if _temp_level < center else "down"


func _build_adjustment_cue() -> String:
	var drift_note = ""
	if _adjust_round_drift <= -0.08:
		drift_note = "（吸っている間に温度が落ちた）"
	elif _adjust_round_drift >= 0.08:
		drift_note = "（吸っている間に温度が上がった）"
	else:
		drift_note = "（温度はわずかにぶれている）"

	if _adjust_target_action == "up":
		return "スミ「温度が下がってるな。上げて合格ラインまで戻すぞ」%s" % drift_note
	if _adjust_target_action == "down":
		return "スミ「温度が上がってる。下げて最高ラインの内側に戻せ」%s" % drift_note
	return "スミ「今はちょうどいい。触りすぎるな」%s" % drift_note


func _on_adjust_action_selected(action_id: String) -> void:
	_adjust_selected_action = action_id
	_show_adjustment_gauge_step()


func _show_adjustment_gauge_step() -> void:
	var round_num = _adjust_round + 1
	_set_phase(
		6,
		"調整ゲージ %d / %d" % [round_num, ADJUST_TOTAL_ROUNDS],
		"選択した方向: %s\n押している間だけ調整、離した瞬間で判定。\n判定は PERFECT / GOOD / NEAR / MISS。" % _adjust_action_label(_adjust_selected_action)
	)
	_clear_choices()
	_adjust_step_finished = false
	_adjust_is_holding = false
	_configure_adjust_gauge()

	var hold_button = Button.new()
	hold_button.text = "押して調整（離して決定）"
	hold_button.custom_minimum_size = Vector2(0, 48)
	hold_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hold_button.button_down.connect(_on_adjust_hold_started)
	hold_button.button_up.connect(_on_adjust_hold_released)
	choice_container.add_child(hold_button)

	_update_adjust_text("調整待機中")


func _configure_adjust_gauge() -> void:
	var speed = 1.02 + float(_adjust_round) * 0.16
	var width = 0.18 - float(_adjust_round) * 0.015
	if _selected_pack_style == "tight":
		speed += 0.1
		width -= 0.01
	if _selected_charcoal_count >= 4:
		speed += 0.06
	if _selected_steam_minutes >= 7:
		speed += 0.08
	_adjust_gauge_speed = clampf(speed, 0.8, 2.4)
	_adjust_target_width = clampf(width, 0.08, 0.22)
	_adjust_target_center = clampf(0.5 + randf_range(-0.08, 0.08), 0.2, 0.8)
	_adjust_gauge_value = clampf(_adjust_target_center + randf_range(-0.2, 0.2), 0.0, 1.0)
	_adjust_gauge_direction = 1.0


func _on_adjust_hold_started() -> void:
	if _adjust_step_finished:
		return
	if _adjust_is_holding:
		return
	_adjust_is_holding = true
	if _adjust_timer.is_stopped():
		_adjust_timer.start()
	GameManager.play_ui_se("cursor")
	_update_adjust_text("調整中...離すと判定")


func _on_adjust_hold_released() -> void:
	if _adjust_step_finished:
		return
	if not _adjust_is_holding:
		return
	_adjust_is_holding = false
	if not _adjust_timer.is_stopped():
		_adjust_timer.stop()
	_resolve_adjustment_round()


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


func _resolve_adjustment_round() -> void:
	_adjust_step_finished = true
	var quality = _evaluate_gauge_quality(_adjust_gauge_value, _adjust_target_center, _adjust_target_width)
	var action_correct = _adjust_selected_action == _adjust_target_action
	var timing_good = quality == "perfect" or quality == "good"
	var before_temp = _temp_level
	var before_gap = _temperature_eval_gap(before_temp)
	_apply_adjustment_with_quality(quality)
	var after_gap = _temperature_eval_gap(_temp_level)
	var moved_better = after_gap <= before_gap - 0.01
	if not moved_better and _adjust_target_action == "stay":
		moved_better = after_gap <= before_gap + 0.005
	var success = action_correct and timing_good and moved_better

	if success:
		_adjust_success_count += 1

	var result_line = ""
	if action_correct:
		if success:
			match quality:
				"perfect":
					result_line = "方向もタイミングも完璧。温度帯の芯に戻した。"
				"good":
					result_line = "方向は正解。実戦でも十分通る調整。"
				_:
					result_line = "方向は正解。温度帯へ戻せた。"
		elif moved_better:
			result_line = "方向は正しいが、合わせが浅い。"
		else:
			result_line = "方向は正しいが、触り幅を誤って戻し切れない。"
	else:
		result_line = "逆方向に触ってしまった。温度がさらにずれた。"

	GameManager.play_ui_se("confirm" if success else "cancel")
	_update_adjust_text(
		"判定: %s\n%s\n現在状態: %s" % [
			quality.to_upper(),
			result_line,
			_temperature_zone_label(_temp_level),
		]
	)
	_clear_choices()
	if _adjust_round < ADJUST_TOTAL_ROUNDS - 1:
		_add_choice_button("次の調整へ", _advance_adjustment_round)
	else:
		_add_choice_button("調整特訓の結果を見る", _show_adjustment_summary)


func _apply_adjustment_with_quality(quality: String) -> void:
	var strength = _adjust_strength_from_quality(quality)
	match _adjust_selected_action:
		"up":
			_temp_level += strength
		"down":
			_temp_level -= strength
		_:
			_temp_level = lerpf(_temp_level, _temperature_center(), 0.18 + strength * 0.35)
	_temp_level = clampf(_temp_level, TEMP_LEVEL_MIN, TEMP_LEVEL_MAX)


func _adjust_strength_from_quality(quality: String) -> float:
	var base = 0.08
	match quality:
		"perfect":
			base = 0.18
		"good":
			base = 0.14
		"near":
			base = 0.10
		_:
			base = 0.06
	if _selected_pack_style == "tight":
		base += 0.01
	if _selected_charcoal_count >= 4:
		base += 0.01
	return clampf(base, 0.05, 0.24)


func _advance_adjustment_round() -> void:
	_adjust_round += 1
	_show_adjustment_round()


func _show_adjustment_summary() -> void:
	var summary = ""
	var final_ok = _temperature_distance_to_band(_temp_level) <= 0.001
	if _adjust_success_count >= 3 and final_ok:
		summary = "スミ「完璧だ。客のどんなペースにも合わせて、最後まで旨い煙を出せるな」"
	elif _adjust_success_count >= 2:
		summary = "スミ「悪くない。ある程度の変化には対応できる。あとは実戦で感覚を磨け」"
	elif _adjust_success_count >= 1:
		summary = "スミ「方向は見えてるが精度が足りない。このままじゃ客に飽きられるぞ」"
	else:
		summary = "スミ「熱の動きがまるで見えてない。……もう一度基礎からやり直しだ」"

	var lines: Array[String] = []
	lines.append("調整成功 %d / %d" % [_adjust_success_count, ADJUST_TOTAL_ROUNDS])
	lines.append("最終状態: %s" % _temperature_zone_label(_temp_level))
	lines.append_array(_build_temperature_band_lines(_temp_level))
	lines.append(summary)
	lines.append("特訓報酬: technique +1（調整成功2回以上で insight +1）")
	_set_phase(
		6,
		"温度調整: 終了",
		"\n".join(lines)
	)
	_clear_choices()
	_add_choice_button("特訓を終える", _finish_tutorial)


func _update_adjust_text(status_text: String) -> void:
	var bar = _build_gauge_bar(_adjust_gauge_value, _adjust_target_center, _adjust_target_width)
	var lines: Array[String] = []
	lines.append("選択した方向: %s" % _adjust_action_label(_adjust_selected_action))
	lines.append(status_text)
	lines.append("成功基準: 方向正解 + GOOD以上 + 温度帯へ接近")
	lines.append_array(_build_temperature_band_lines(_temp_level))
	lines.append("調整タイミング目標帯 ■ / ポインタ ◆")
	lines.append(bar)
	info_label.text = "\n".join(lines)


func _build_temperature_band_lines(value: float, drift: float = 0.0) -> Array[String]:
	var lines: Array[String] = []
	lines.append("温度状態（吸い出しゲージとは別）")
	lines.append("目標: 合格ライン〜最高ラインを維持")
	lines.append("現在: %s / %d℃" % [_temperature_zone_label(value), _temperature_to_celsius(value)])
	lines.append("読み方: [低温][合格][最高][過熱] の ● が現在位置")
	lines.append(_build_temperature_zone_cells(value))
	if abs(drift) >= 0.03:
		lines.append("傾向: %s" % _temperature_trend_text(drift))
	lines.append("状態: %s" % _temperature_zone_label(value))
	return lines


func _build_temperature_zone_cells(value: float) -> String:
	var low = "●" if value < TEMP_PASS_LINE else " "
	var p = "●" if value >= TEMP_PASS_LINE and value < _temperature_center() else " "
	var top = "●" if value >= _temperature_center() and value <= TEMP_TOP_LINE else " "
	var high = "●" if value > TEMP_TOP_LINE else " "
	return "[低温 %s] [合格 %s] [最高 %s] [過熱 %s]" % [low, p, top, high]


func _temperature_to_celsius(value: float) -> int:
	return int(round(160.0 + clampf(value, TEMP_LEVEL_MIN, TEMP_LEVEL_MAX) * 90.0))


func _temperature_center() -> float:
	return (TEMP_PASS_LINE + TEMP_TOP_LINE) * 0.5


func _temperature_zone_label(value: float) -> String:
	if value < TEMP_PASS_LINE:
		return "未達（低温）"
	if value > TEMP_TOP_LINE:
		return "過熱（高温）"
	if value >= _temperature_center():
		return "最高帯"
	return "合格帯"


func _temperature_trend_text(drift: float) -> String:
	if drift >= 0.09:
		return "↑ 急上昇"
	if drift >= 0.03:
		return "↑ 上昇"
	if drift <= -0.09:
		return "↓ 急低下"
	if drift <= -0.03:
		return "↓ 低下"
	return "→ 安定"


func _temperature_distance_to_band(value: float) -> float:
	if value < TEMP_PASS_LINE:
		return TEMP_PASS_LINE - value
	if value > TEMP_TOP_LINE:
		return value - TEMP_TOP_LINE
	return 0.0


func _temperature_eval_gap(value: float) -> float:
	var outside = _temperature_distance_to_band(value)
	if outside > 0.0:
		return outside + 0.12
	return abs(value - _temperature_center()) * 0.45


func _build_gauge_bar(value: float, target_center: float, target_width: float) -> String:
	var bar_len = 24
	var pointer_index = int(round(value * float(bar_len - 1)))
	var target_start = int(round(clampf(target_center - target_width, 0.0, 1.0) * float(bar_len - 1)))
	var target_end = int(round(clampf(target_center + target_width, 0.0, 1.0) * float(bar_len - 1)))
	var chars: Array[String] = []
	for i in range(bar_len):
		var c = "─"
		if i >= target_start and i <= target_end:
			c = "■"
		if i == pointer_index:
			c = "◆"
		chars.append(c)
	return "".join(chars)


func _evaluate_gauge_quality(value: float, target_center: float, target_width: float) -> String:
	var distance = abs(value - target_center)
	if distance <= target_width * 0.35:
		return "perfect"
	if distance <= target_width:
		return "good"
	if distance <= target_width * 1.7:
		return "near"
	return "miss"


func _adjust_action_label(action_id: String) -> String:
	match action_id:
		"up":
			return "温度を上げる"
		"down":
			return "温度を下げる"
		_:
			return "現状維持"


func _finish_tutorial() -> void:
	if _pull_timer != null:
		_pull_timer.stop()
	if _adjust_timer != null:
		_adjust_timer.stop()

	EventFlags.set_flag("ch1_opening_tutorial_done")
	PlayerData.add_stat("technique", 1)
	GameManager.log_stat_change("technique", 1)
	if _adjust_success_count >= 2:
		PlayerData.add_stat("insight", 1)
		GameManager.log_stat_change("insight", 1)

	var next_scene = str(GameManager.pop_transient("post_tutorial_next_scene", DEFAULT_NEXT_SCENE))
	if next_scene == "":
		next_scene = DEFAULT_NEXT_SCENE
	get_tree().change_scene_to_file(next_scene)
