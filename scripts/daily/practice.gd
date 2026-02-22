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
@onready var status_panel = $StatusPanel

var _selected_pack_style: String = "standard"
var _selected_charcoal_count: int = 3
var _selected_steam_minutes: int = 6

const TUTORIAL_TOTAL_GRAMS := 12
const TUTORIAL_FLAVORS := ["double_apple", "mint"]
var _tutorial_packing_grams: Dictionary = {"double_apple": 6, "mint": 6}
var _tutorial_sliders: Dictionary = {}
var _tutorial_value_labels: Dictionary = {}
var _tutorial_remaining_label: Label = null
var _tutorial_confirm_button: Button = null

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
var _adjustment_action_count: int = 0
var _adjust_gauge_value: float = 0.5
var _adjust_gauge_direction: float = 1.0
var _adjust_gauge_speed: float = 1.0
var _adjust_target_center: float = 0.5
var _adjust_target_width: float = 0.18

var _temp_level: float = 0.34
var _adjust_round_drift: float = 0.0

# Aluminum
var _aluminum_timer: Timer
var _aluminum_active: bool = false
var _aluminum_slot_count: int = 12
var _aluminum_hit_slot: int = 9
var _aluminum_notes: Array[Dictionary] = []
var _aluminum_notes_spawned: int = 0
var _aluminum_spawn_cooldown: int = 0
var _aluminum_hit_perfect: int = 0
var _aluminum_hit_good: int = 0
var _aluminum_hit_near: int = 0
var _aluminum_hit_miss: int = 0
var _aluminum_bad_press: int = 0
var _aluminum_required_hits: int = 6
var _aluminum_total_notes: int = 8
var _aluminum_spawn_interval_ticks: int = 2

# Mind Barrage
const MIND_BARRAGE_BASE_LIVES := 3
const MIND_BARRAGE_WORST_PULL_SPEED := 2.35
const MIND_BARRAGE_MIN_SECONDS := 8.0
const MIND_BARRAGE_MAX_SECONDS := 16.0
const MIND_BARRAGE_WORDS := [
	"もっと上手くできるはず…",
	"炭が熱すぎる？",
	"フレーバー足りなかったかも",
	"詰め方が甘かったか？",
	"お客さん待たせてる",
	"これで美味しいのか？",
	"スミさんに怒られる…",
	"煙が薄い気がする",
	"焦げたらどうしよう",
]
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

var _heat_state: int = 0

func _process(_delta: float) -> void:
	if status_panel and status_panel.has_method("update_status"):
		status_panel.update_status(_temp_level, _temperature_zone_label(_temp_level), _selected_charcoal_count, TEMP_PASS_LINE, TEMP_TOP_LINE)

func _ready() -> void:
	print("[DEBUG] Practice _ready called")
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

	_aluminum_timer = Timer.new()
	_aluminum_timer.wait_time = 0.16
	_aluminum_timer.one_shot = false
	_aluminum_timer.timeout.connect(_on_aluminum_tick)
	add_child(_aluminum_timer)

	_mind_timer = Timer.new()
	_mind_timer.wait_time = 0.033
	_mind_timer.one_shot = false
	_mind_timer.timeout.connect(_on_mind_barrage_tick)
	add_child(_mind_timer)

	_show_intro_step()
	print("[DEBUG] _show_intro_step invoked")


func _set_phase(step_num: int, title: String, body: String) -> void:
	header_label.text = title
	phase_label.text = "TUTORIAL STEP %d / %d" % [step_num, TOTAL_STEPS]
	info_label.text = body

func _join_lines(lines: Array) -> String:
	var result = ""
	for i in range(lines.size()):
		result += str(lines[i])
		if i < lines.size() - 1:
			result += "\n"
	return result

func _join_chars(chars: Array) -> String:
	var result = ""
	for c in chars:
		result += str(c)
	return result



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
	print("[DEBUG] Choice button added: %s" % text)
	return button


func _show_intro_step() -> void:
	print("[DEBUG] _show_intro_step start")
	_set_phase(
		1,
		"スミさんの特訓",
		_join_lines([
			"スミ「さっき渡したダブルアップルとミント、練習に使え」",
			"スミ「大会は基礎で勝つ。まずは王道のミックスだ」",
			"",
			"ここではシーシャ作りの流れを短く実演する。",
			"1. 配分を決める",
			"2. 詰め方を決める",
			"3. 炭と蒸らしを決める",
			"4. 吸い出しで温度帯へ入れる",
			"5. 温度維持の調整をやる"
		])
	)
	print("[DEBUG] _show_intro_step phase set")
	_clear_choices()
	_add_choice_button("特訓を始める", _show_mix_step)

func _show_mix_step() -> void:
	print("[DEBUG] _show_mix_step start")
	_set_phase(2, "フレーバーの配分", "ダブルアップルとミントの配合を決める。\n合計12gになるようスライダーで調整する。")
	_clear_choices()
	_tutorial_sliders.clear()
	_tutorial_value_labels.clear()

	var title = Label.new()
	title.text = "配分ゲージ（1g刻み / 合計12g）"
	title.add_theme_font_size_override("font_size", 20)
	choice_container.add_child(title)

	for flavor_id in TUTORIAL_FLAVORS:
		choice_container.add_child(_build_tutorial_slider_row(flavor_id))

	_tutorial_remaining_label = Label.new()
	choice_container.add_child(_tutorial_remaining_label)

	_tutorial_confirm_button = _add_choice_button("この配合で確定", _on_tutorial_mix_confirmed)
	_refresh_tutorial_packing()


func _build_tutorial_slider_row(flavor_id: String) -> Control:
	var wrapper = VBoxContainer.new()
	wrapper.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	wrapper.add_theme_constant_override("separation", 4)

	var label = Label.new()
	var holding_amount = PlayerData.get_flavor_amount(flavor_id)
	label.text = "%s  %dg (所持: %dg)" % [_tutorial_flavor_name(flavor_id), int(_tutorial_packing_grams.get(flavor_id, 0)), holding_amount]
	label.custom_minimum_size = Vector2(160, 0)
	wrapper.add_child(label)
	_tutorial_value_labels[flavor_id] = label

	var slider = HSlider.new()
	slider.min_value = 0
	slider.max_value = TUTORIAL_TOTAL_GRAMS
	slider.step = 1
	slider.value = int(_tutorial_packing_grams.get(flavor_id, 0))
	slider.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	slider.value_changed.connect(_on_tutorial_slider_changed.bind(flavor_id))
	wrapper.add_child(slider)
	_tutorial_sliders[flavor_id] = slider

	return wrapper


func _tutorial_flavor_name(flavor_id: String) -> String:
	match flavor_id:
		"double_apple":
			return "ダブルアップル"
		"mint":
			return "ミント"
		_:
			return flavor_id


func _on_tutorial_slider_changed(value: float, flavor_id: String) -> void:
	_tutorial_packing_grams[flavor_id] = int(round(value))
	_refresh_tutorial_packing()


func _refresh_tutorial_packing() -> void:
	var total = 0
	for fid in TUTORIAL_FLAVORS:
		var grams = int(_tutorial_packing_grams.get(fid, 0))
		total += grams
		if _tutorial_value_labels.has(fid):
			var label = _tutorial_value_labels[fid] as Label
			if label != null:
				var holding_amount = PlayerData.get_flavor_amount(fid)
				label.text = "%s  %dg (所持: %dg)" % [_tutorial_flavor_name(fid), grams, holding_amount]
		if _tutorial_sliders.has(fid):
			var slider = _tutorial_sliders[fid] as HSlider
			if slider != null and int(round(slider.value)) != grams:
				slider.value = grams

	var remaining = TUTORIAL_TOTAL_GRAMS - total
	if _tutorial_remaining_label != null:
		if remaining == 0:
			_tutorial_remaining_label.text = "残り: 0g（確定可能）"
		elif remaining > 0:
			_tutorial_remaining_label.text = "残り: %dg" % remaining
		else:
			_tutorial_remaining_label.text = "超過: %dg（12gに戻して）" % abs(remaining)
	if _tutorial_confirm_button != null:
		_tutorial_confirm_button.disabled = remaining != 0


func _on_tutorial_mix_confirmed() -> void:
	var total = 0
	for fid in TUTORIAL_FLAVORS:
		total += int(_tutorial_packing_grams.get(fid, 0))
	if total != TUTORIAL_TOTAL_GRAMS:
		GameManager.play_ui_se("cancel")
		return

	GameManager.play_ui_se("confirm")
	var apple_g = int(_tutorial_packing_grams.get("double_apple", 0))
	var mint_g = int(_tutorial_packing_grams.get("mint", 0))
	var feedback = ""
	if abs(apple_g - mint_g) <= 2:
		feedback = "甘さと清涼感のバランスが良い王道の配合。\nスミ「ダブルの甘さをミントが引き締める。これが基本の形だ」"
	elif apple_g > mint_g:
		feedback = "アップルの主張が強い重厚な味。ミントは後味程度。\nスミ「重たい煙で満足感を出したい時にはこれだ」"
	else:
		feedback = "清涼感が先行する。味が少し軽く飛ぶリスクがある。\nスミ「爽快感は出るが、熱を入れすぎると味が消えるぞ」"

	_set_phase(
		2,
		"フレーバーの配分: 決定",
		"配合: ダブルアップル %dg / ミント %dg\n%s\n\nスミ「ミックスは自由だが、芯がないとただ味が濁るだけだ。次はアルミ張りだ」" % [apple_g, mint_g, feedback]
	)
	_clear_choices()
	_add_choice_button("次へ（アルミ張り）", _show_aluminum_step)

func _show_aluminum_step() -> void:
	_set_phase(4, "アルミ穴あけ", "円形レーンの判定点にノーツが来たら叩く。Taiko風のタイミング勝負。\nスミ「ここでお前のリズム感が熱を左右する。ズレれば味も濁るぞ」")
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
	_aluminum_spawn_interval_ticks = 2
	_aluminum_timer.wait_time = beat_wait
	_aluminum_timer.start()
	_spawn_aluminum_note()

	var press_button = Button.new()
	press_button.text = "ドン（穴を開ける）"
	press_button.custom_minimum_size = Vector2(0, 44)
	press_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	press_button.pressed.connect(_on_aluminum_press_hole)
	choice_container.add_child(press_button)
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
	_aluminum_notes.append({"distance": float(_aluminum_slot_count - 2)})
	_aluminum_notes_spawned += 1
	_aluminum_spawn_cooldown = _aluminum_spawn_interval_ticks

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

	var hits = _count_aluminum_hits()
	var result_text = ""
	if hits < _aluminum_required_hits:
		result_text = "穴あけ不足（必要数未達）"
		_heat_state -= 1
	else:
		var weighted = float(_aluminum_hit_perfect) + float(_aluminum_hit_good) * 0.72 + float(_aluminum_hit_near) * 0.42
		var penalty = float(_aluminum_hit_miss) * 0.25 + float(_aluminum_bad_press) * 0.18
		var score = (weighted - penalty) / float(maxi(_aluminum_total_notes, 1))
		if score >= 0.78:
			result_text = "穴あけリズム（良好）"
		elif score >= 0.5:
			result_text = "穴あけリズム（可）"
		else:
			result_text = "穴あけが荒れた"
			_heat_state -= 1

	GameManager.play_ui_se("confirm")
	_set_phase(
		4,
		"アルミ穴あけ: 結果",
		"%s\n判定 P%d / G%d / N%d / M%d / 空振り%d\n\nスミ「次へ進むぞ」" % [
			result_text,
			_aluminum_hit_perfect,
			_aluminum_hit_good,
			_aluminum_hit_near,
			_aluminum_hit_miss,
			_aluminum_bad_press,
		]
	)
	_clear_choices()
	_add_choice_button("次へ（炭の配置）", _show_charcoal_place_step)

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
	info_label.text = _join_lines(lines)

func _build_aluminum_ring_text() -> String:
	var slot_note_count: Dictionary = {}
	for note in _aluminum_notes:
		var slot_idx = _get_aluminum_note_slot(note)
		slot_note_count[slot_idx] = int(slot_note_count.get(slot_idx, 0)) + 1

	var sym = func(slot_idx: int) -> String:
		var note_count = int(slot_note_count.get(slot_idx, 0))
		if slot_idx == _aluminum_hit_slot:
			if note_count <= 0: return "★"
			if note_count == 1: return "◆"
			return "✦"
		if note_count <= 0: return "○"
		if note_count == 1: return "●"
		return "◎"

	var lines: Array[String] = []
	lines.append("          %s" % sym.call(0))
	lines.append("      %s       %s" % [sym.call(11), sym.call(1)])
	lines.append("   %s             %s" % [sym.call(10), sym.call(2)])
	lines.append(" %s                 %s" % [sym.call(9), sym.call(3)])
	lines.append("   %s             %s" % [sym.call(8), sym.call(4)])
	lines.append("      %s       %s" % [sym.call(7), sym.call(5)])
	lines.append("          %s" % sym.call(6))
	return _join_lines(lines)

func _get_aluminum_note_slot(note: Dictionary) -> int:
	var distance = int(round(float(note.get("distance", 0.0))))
	var slot = (_aluminum_hit_slot + distance) % _aluminum_slot_count
	if slot < 0: slot += _aluminum_slot_count
	return slot

func _count_aluminum_hits() -> int:
	return _aluminum_hit_perfect + _aluminum_hit_good + _aluminum_hit_near

func _show_charcoal_place_step() -> void:
	_set_phase(4, "炭の配置", "3個か4個を選んで配置する。機材と好みに合わせる。")
	_clear_choices()
	var hint = "通常は3個が基本。"
	info_label.text = "【ヒント】\n" + hint
	_add_choice_button("3個（基本／安定）", _on_charcoal_place_selected.bind(3))
	_add_choice_button("4個（攻め／狙いがある時）", _on_charcoal_place_selected.bind(4))

func _on_charcoal_place_selected(count: int) -> void:
	_selected_charcoal_count = count
	_set_phase(4, "炭の配置: 決定", "選んだ炭の個数: %d個\n\nスミ「よし。次は蒸らし時間だ」" % count)
	_clear_choices()
	_add_choice_button("次へ（蒸らし時間）", _show_steam_step)

var _tutorial_steam_minutes_setting: int = 6
var _tutorial_timer_label: Label

func _show_steam_step() -> void:
	_set_phase(5, "蒸らしタイマー", "5〜10分から蒸らし時間を設定。\nスミ「じっくり温めるか、高温で一足飛びに行くか。意図を持て」")
	_clear_choices()
	_tutorial_steam_minutes_setting = 6
	
	var ui_container = VBoxContainer.new()
	ui_container.alignment = BoxContainer.ALIGNMENT_CENTER
	ui_container.add_theme_constant_override("separation", 16)
	choice_container.add_child(ui_container)
	
	_tutorial_timer_label = Label.new()
	_tutorial_timer_label.add_theme_font_size_override("font_size", 48)
	_tutorial_timer_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	ui_container.add_child(_tutorial_timer_label)
	
	var control_row = HBoxContainer.new()
	control_row.alignment = BoxContainer.ALIGNMENT_CENTER
	control_row.add_theme_constant_override("separation", 24)
	ui_container.add_child(control_row)
	
	var minus_btn = Button.new()
	minus_btn.text = "－1分"
	minus_btn.custom_minimum_size = Vector2(80, 48)
	minus_btn.pressed.connect(_on_tutorial_steam_adjust.bind(-1))
	control_row.add_child(minus_btn)
	
	var plus_btn = Button.new()
	plus_btn.text = "＋1分"
	plus_btn.custom_minimum_size = Vector2(80, 48)
	plus_btn.pressed.connect(_on_tutorial_steam_adjust.bind(1))
	control_row.add_child(plus_btn)
	
	var start_btn = Button.new()
	start_btn.text = "START (決定)"
	start_btn.custom_minimum_size = Vector2(200, 56)
	start_btn.add_theme_color_override("font_color", Color(1, 0.9, 0.4))
	start_btn.pressed.connect(_on_tutorial_steam_confirmed)
	ui_container.add_child(start_btn)
	
	_update_tutorial_steam_timer_display()

func _on_tutorial_steam_adjust(diff: int) -> void:
	_tutorial_steam_minutes_setting += diff
	if _tutorial_steam_minutes_setting < 5:
		_tutorial_steam_minutes_setting = 5
	elif _tutorial_steam_minutes_setting > 10:
		_tutorial_steam_minutes_setting = 10
	GameManager.play_ui_se("cursor")
	_update_tutorial_steam_timer_display()

func _update_tutorial_steam_timer_display() -> void:
	if _tutorial_timer_label:
		_tutorial_timer_label.text = "%02d : 00" % _tutorial_steam_minutes_setting

func _on_tutorial_steam_confirmed() -> void:
	GameManager.play_ui_se("confirm")
	_selected_steam_minutes = _tutorial_steam_minutes_setting
	_show_mind_barrage_intro()

func _show_mind_barrage_intro() -> void:
	if _mind_barrage_done:
		_show_pull_step()
		return
	var duration_sec = _compute_mind_barrage_duration()
	var lives = MIND_BARRAGE_BASE_LIVES
	_set_phase(6, "吸い出し前: 思考の暴走", "吸い出し直前、頭の中で不安と記憶が弾幕になる。\n\nスミ「客に提供する前、ブレるな。自分のレシピを信じ切れ」")
	_clear_choices()
	var lines: Array[String] = []
	lines.append("弾を避ける = 雑念をかわす")
	lines.append("当たる = 心がブレる")
	lines.append("ここでの成績が良いほど、この後の吸い出し操作が安定する。")
	lines.append("蒸らし %d分 -> 耐久 %.1f秒" % [_selected_steam_minutes, duration_sec])
	lines.append("残機: %d（0になると吸い出し難易度MAX）" % lives)
	info_label.text = _join_lines(lines)
	_add_choice_button("弾幕開始", _start_mind_barrage_step)

func _compute_mind_barrage_duration() -> float:
	var ratio = clampf(float(_selected_steam_minutes - 5) / 5.0, 0.0, 1.0)
	var duration_sec = lerpf(MIND_BARRAGE_MIN_SECONDS * 1.5, MIND_BARRAGE_MAX_SECONDS * 1.5, ratio)
	duration_sec += float(maxi(_heat_state, 0)) * 0.4
	return clampf(duration_sec, 12.0, 30.0)

func _compute_mind_barrage_spawn_interval() -> float:
	var ratio = clampf(float(_selected_steam_minutes - 5) / 5.0, 0.0, 1.0)
	var interval = lerpf(0.56, 0.34, ratio)
	interval -= float(abs(_heat_state)) * 0.02
	return clampf(interval, 0.22, 0.72)

func _start_mind_barrage_step() -> void:
	if _mind_barrage_done:
		_show_pull_step()
		return
	_set_phase(6, "思考弾幕", "弾をかわして時間まで耐える。")
	_clear_choices()
	_mind_active = true
	_mind_duration_total = _compute_mind_barrage_duration()
	_mind_elapsed = 0.0
	_mind_spawn_cooldown = 0.0
	_mind_spawn_interval = _compute_mind_barrage_spawn_interval()
	_mind_hits = 0
	_mind_spawned = 0
	_mind_hit_se_cooldown = 0.0
	_mind_lives_max = MIND_BARRAGE_BASE_LIVES
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
	call_deferred("_begin_mind_barrage_loop")

func _add_mind_pad_spacer(parent: GridContainer) -> void:
	var spacer = Control.new()
	spacer.custom_minimum_size = Vector2(56, 40)
	parent.add_child(spacer)

func _add_mind_direction_button(parent: GridContainer, button_text: String, dir_id: String) -> void:
	var button = Button.new()
	button.text = button_text
	button.custom_minimum_size = Vector2(56, 40)
	button.button_down.connect(func() -> void: _set_mind_direction(dir_id, true))
	button.button_up.connect(func() -> void: _set_mind_direction(dir_id, false))
	button.mouse_exited.connect(func() -> void: _set_mind_direction(dir_id, false))
	parent.add_child(button)

func _set_mind_direction(dir_id: String, pressed: bool) -> void:
	match dir_id:
		"left": _mind_move_left = pressed
		"right": _mind_move_right = pressed
		"up": _mind_move_up = pressed
		"down": _mind_move_down = pressed

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

	var speed = 214.0 + float(maxi(_selected_steam_minutes - 5, 0)) * 4.0
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
		0: spawn = Vector2(randf_range(0.0, arena_size.x), -size.y * 0.5 - 4.0)
		1: spawn = Vector2(arena_size.x + size.x * 0.5 + 4.0, randf_range(0.0, arena_size.y))
		2: spawn = Vector2(randf_range(0.0, arena_size.x), arena_size.y + size.y * 0.5 + 4.0)
		_: spawn = Vector2(-size.x * 0.5 - 4.0, randf_range(0.0, arena_size.y))

	var target = _mind_player_pos + Vector2(randf_range(-64.0, 64.0), randf_range(-42.0, 42.0))
	target.x = clampf(target.x, 20.0, arena_size.x - 20.0)
	target.y = clampf(target.y, 20.0, arena_size.y - 20.0)
	var to_target = target - spawn
	if to_target.length_squared() <= 0.0001:
		to_target = Vector2.DOWN
	var direction = to_target.normalized()

	var speed = 112.0 + float(_selected_steam_minutes - 5) * 14.0 + float(abs(_heat_state)) * 9.0 + randf_range(0.0, 54.0)
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
			_mind_invincible_timer = 1.0
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
	info_label.text = _join_lines(lines)

func _build_mind_life_text() -> String:
	var chars: Array[String] = []
	for i in range(_mind_lives_max):
		chars.append("●" if i < _mind_lives_remaining else "○")
	return _join_chars(chars)

func _build_mind_barrage_progress_bar(ratio: float) -> String:
	var length = 24
	var fill = int(round(clampf(ratio, 0.0, 1.0) * float(length)))
	var chars: Array[String] = []
	for i in range(length):
		chars.append("■" if i < fill else "─")
	return _join_chars(chars)

func _finish_mind_barrage_step() -> void:
	if not _mind_active:
		return
	var result = _evaluate_mind_barrage_result()
	var result_text = str(result.get("text", "精神戦を抜けた。"))
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

	_heat_state = clampi(_heat_state + heat_shift, -3, 3)
	GameManager.play_ui_se("confirm")

	_set_phase(
		6,
		"思考弾幕: 結果",
		"%s\n被弾 %d / 出現 %d\n吸い出し速度補正: %s\n\nスミ「ここから吸い出しだ。心を落ち着けろ」" % [
			result_text,
			hit_count,
			maxi(spawn_count, 1),
			_mind_pull_adjust_text(),
		]
	)
	_clear_choices()
	_add_choice_button("次へ（吸い出し）", _show_pull_step)

func _evaluate_mind_barrage_result() -> Dictionary:
	if _mind_lives_remaining <= 0:
		return {
			"text": "心が折れた。雑音に飲まれたまま吸い出しへ入る。",
			"heat_shift": 2,
			"pull_speed_adjust": 0.45,
			"force_worst_pull_speed": true,
		}

	var pressure = float(_mind_hits) / float(maxi(_mind_spawned, 1))
	var life_ratio = float(_mind_lives_remaining) / float(maxi(_mind_lives_max, 1))
	var resilience = clampf(1.0 - pressure * 1.9 + life_ratio * 0.35, 0.0, 1.0)

	if resilience >= 0.86:
		return {
			"text": "表情が落ち着いた。冷静さを取り戻した。",
			"heat_shift": -1,
			"pull_speed_adjust": -0.18,
			"force_worst_pull_speed": false,
		}
	if resilience >= 0.68:
		return {
			"text": "揺れを抑えて、レシピに意識を戻した。",
			"heat_shift": 0,
			"pull_speed_adjust": -0.10,
			"force_worst_pull_speed": false,
		}
	if resilience >= 0.45:
		return {
			"text": "迷いは残るが、ギリギリ持ちこたえた。",
			"heat_shift": 0,
			"pull_speed_adjust": 0.06,
			"force_worst_pull_speed": false,
		}

	return {
		"text": "雑念に呑まれ、心がブレた。",
		"heat_shift": 1,
		"pull_speed_adjust": 0.14,
		"force_worst_pull_speed": false,
	}

func _mind_pull_adjust_text() -> String:
	if _mind_force_worst_pull_speed:
		return "最悪速度固定（%.2f以上）" % MIND_BARRAGE_WORST_PULL_SPEED
	var trend = "遅くなる"
	if _mind_pull_speed_adjust > 0.0:
		trend = "速くなる"
	elif abs(_mind_pull_speed_adjust) < 0.001:
		trend = "変化なし"
	return "%+.2f（%s）" % [_mind_pull_speed_adjust, trend]


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

	_update_pull_text("スミ「ここでの吸い出しが仕上がりを決める。精神戦の結果でゲージ速度が変わるぞ」\n現在の速度補正: %s" % _mind_pull_adjust_text())


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

	if _mind_force_worst_pull_speed:
		speed = MIND_BARRAGE_WORST_PULL_SPEED
	else:
		speed += _mind_pull_speed_adjust

	_pull_gauge_speed = clampf(speed, 0.65, 3.25)
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
	info_label.text = _join_lines(lines)


func _start_adjustment_tutorial() -> void:
	_adjust_round = 0
	_adjust_success_count = 0
	_adjustment_action_count = 0
	_adjust_round_drift = 0.0
	_show_adjustment_menu()


func _show_adjustment_menu() -> void:
	var cue = "スミ「どう調整する？」"
	_set_phase(
		6,
		"調整フェーズ",
		cue + "\n現在の炭: %d個\n現在の温度状態: %s" % [_selected_charcoal_count, _temperature_zone_label(_temp_level)]
	)
	_clear_choices()
	
	_add_choice_button("炭の調整を行う", _show_charcoal_adjust_step)
	_add_choice_button("吸い出しで微調整する", _show_pull_adjust_step)
	
	if _adjustment_action_count >= 2:
		_add_choice_button("何もしない（審査へ）", _show_adjustment_summary)
	else:
		var btn = _add_choice_button("何もしない（あと%d回アクションが必要）" % (2 - _adjustment_action_count), _show_adjustment_summary)
		btn.disabled = true


func _show_charcoal_adjust_step() -> void:
	_set_phase(
		6,
		"炭の調整",
		"現在の炭は%d個だ。どうする？\n※炭を増やすとベース温度が上がり、減らすと下がる。\n※「新しい炭に交換」は個数を維持しつつ少し温度を上げる。" % _selected_charcoal_count
	)
	_clear_choices()
	
	if _selected_charcoal_count > 2:
		_add_choice_button("炭を1個減らす（現在%d -> %d）" % [_selected_charcoal_count, _selected_charcoal_count - 1], _apply_charcoal_change.bind(-1, false))
	if _selected_charcoal_count < 4:
		_add_choice_button("炭を1個増やす（現在%d -> %d）" % [_selected_charcoal_count, _selected_charcoal_count + 1], _apply_charcoal_change.bind(1, false))
	_add_choice_button("新しい炭に交換する", _apply_charcoal_change.bind(0, true))
	_add_choice_button("戻る", _show_adjustment_menu)


func _apply_charcoal_change(diff: int, is_new: bool) -> void:
	_selected_charcoal_count += diff
	var temp_change = float(diff) * 0.15
	if is_new:
		temp_change += 0.08
	
	_temp_level = clampf(_temp_level + temp_change, TEMP_LEVEL_MIN, TEMP_LEVEL_MAX)
	_adjustment_action_count += 1
	
	var msg = "炭の数を調整した。" if diff != 0 else "新しい炭に交換した。温度が少し上がる。"
	GameManager.play_ui_se("confirm")
	_show_step_result_and_next(msg, _show_adjustment_menu)


func _show_pull_adjust_step() -> void:
	_prepare_adjustment_target(_adjust_round)
	var cue = _build_adjustment_cue()
	var lines: Array[String] = []
	lines.append("吸っていると温度はぶれてくる。合格ラインと最高ラインを維持する。")
	lines.append(cue)
	lines.append_array(_build_temperature_band_lines(_temp_level, _adjust_round_drift))
	lines.append("まず方向を選択してから、ゲージでタイミング調整する。")
	lines.append("成功条件: 方向が正解 + タイミングGOOD以上 + 温度帯へ近づく。")
	_set_phase(
		6,
		"吸い出し微調整",
		_join_lines(lines)
	)
	_clear_choices()
	_add_choice_button("温度を上げる（強めに吸う）", _on_adjust_action_selected.bind("up"))
	_add_choice_button("現状維持（普通に吸う）", _on_adjust_action_selected.bind("stay"))
	_add_choice_button("温度を下げる（弱めに吹く）", _on_adjust_action_selected.bind("down"))
	_add_choice_button("戻る", _show_adjustment_menu)


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
	_adjustment_action_count += 1
	_adjust_round += 1
	_add_choice_button("調整メニューに戻る", _show_adjustment_menu)


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
	pass


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
		_join_lines(lines)
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
	info_label.text = _join_lines(lines)


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
	return _join_chars(chars)


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
	# Disable all buttons immediately to prevent double-press
	for child in choice_container.get_children():
		if child is Button:
			child.disabled = true

	if _pull_timer != null:
		_pull_timer.stop()
	if _adjust_timer != null:
		_adjust_timer.stop()

	EventFlags.set_flag("ch1_opening_tutorial_done")
	EventFlags.set_flag("ch1_rival_shops_open")
	PlayerData.add_stat("technique", 1)
	GameManager.log_stat_change("technique", 1)
	if _adjust_success_count >= 2:
		PlayerData.add_stat("insight", 1)
		GameManager.log_stat_change("insight", 1)

	var next_scene = str(GameManager.pop_transient("post_tutorial_next_scene", DEFAULT_NEXT_SCENE))
	print("[Tutorial] post_tutorial_next_scene derived as: ", next_scene)
	if next_scene == "":
		next_scene = DEFAULT_NEXT_SCENE
		print("[Tutorial] fallback to DEFAULT_NEXT_SCENE: ", next_scene)
	
	print("[Tutorial] Changing scene to: ", next_scene)
	
	# wait a frame then defer call to change scene to ensure clean UI state
	await get_tree().process_frame
	get_tree().change_scene_to_file.call_deferred(next_scene)


