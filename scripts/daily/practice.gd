extends Control

const TOTAL_STEPS := 10
const DEFAULT_NEXT_SCENE := "res://scenes/daily/map.tscn"
const GAUGE_TIMER_WAIT := 0.03
const ADJUST_TOTAL_ROUNDS := 3
const INFO_WRAP_CHARS := 24
const INFO_PAGE_MAX_LINES := 6
const MAIN_PANEL_TOP_DEFAULT := 34.0
const MAIN_PANEL_TOP_COMPACT := 22.0
const MAIN_PANEL_BOTTOM := 718.0
const STEP_CARD_HEIGHT_DEFAULT := 110.0
const STEP_CARD_HEIGHT_COMPACT := 92.0
const PREVIEW_PANEL_WIDTH := 260.0
const INFO_HEIGHT_DEFAULT := 116.0
const INFO_HEIGHT_COMPACT := 88.0
const TEMP_PASS_LINE := 0.56
const TEMP_TOP_LINE := 0.78
const TEMP_LEVEL_MIN := 0.0
const TEMP_LEVEL_MAX := 1.0
const STEP_STAGE_META := {
	1: {
		"tag": "FLOW",
		"summary": "大会導線の短縮版を確認する",
		"hint": "ここに導入カットインや立ち絵演出を差し込める。",
		"preview": "導入演出 / 会話差し込み予定",
		"color": Color("feae34"),
	},
	2: {
		"tag": "MIX",
		"summary": "配合バランスを決める",
		"hint": "後でボウル断面図やレシピ画像を置ける。",
		"preview": "レシピ図 / 断面図 / 素材",
		"color": Color("f77622"),
	},
	3: {
		"tag": "PACK",
		"summary": "詰め方で立ち上がりを決める",
		"hint": "葉の密度差をアニメで見せやすい工程。",
		"preview": "パッキング比較アニメ予定",
		"color": Color("e4a672"),
	},
	4: {
		"tag": "FOIL",
		"summary": "アルミ穴あけの精度を整える",
		"hint": "譜面・光エフェクト追加向きの工程。",
		"preview": "リズム演出 / ヒット演出予定",
		"color": Color("8bd5ff"),
	},
	5: {
		"tag": "COAL",
		"summary": "炭を返すタイミングで火力の初速を決める",
		"hint": "炭の返しや火花の演出を入れやすい。",
		"preview": "炭準備カット / 火花演出予定",
		"color": Color("ff7a59"),
	},
	6: {
		"tag": "HEAT",
		"summary": "炭配置で温度の土台を作る",
		"hint": "配置図や比較画像を後で追加できる。",
		"preview": "炭配置図 / 熱量比較予定",
		"color": Color("ff9466"),
	},
	7: {
		"tag": "STEAM",
		"summary": "蒸らし時間で煙の芯を作る",
		"hint": "湯気やタイマー演出を乗せやすい。",
		"preview": "蒸らしタイマー演出予定",
		"color": Color("cfe7ff"),
	},
	8: {
		"tag": "FOCUS",
		"summary": "思考を整えてブレを抑える",
		"hint": "不安ワードや小アニメの差し込み用。",
		"preview": "思考弾幕 / 心理演出予定",
		"color": Color("b55088"),
	},
	9: {
		"tag": "PULL",
		"summary": "吸い出しで適温帯へ入れる",
		"hint": "煙量の変化や温度演出を重ねやすい。",
		"preview": "吸い出し演出 / 温度変化予定",
		"color": Color("2ce8f5"),
	},
	10: {
		"tag": "ADJUST",
		"summary": "提供後の温度維持を練習する",
		"hint": "提供中の差分演出やリアクションを追加できる。",
		"preview": "提供後の調整演出予定",
		"color": Color("3e8948"),
	},
}

@onready var header_label: Label = %HeaderLabel
@onready var phase_label: Label = %PhaseLabel
@onready var main_panel: PanelContainer = $MainPanel
@onready var deck_hbox: HBoxContainer = $MainPanel/MainMargin/MainVBox/DeckHBox
@onready var step_card: PanelContainer = $MainPanel/MainMargin/MainVBox/DeckHBox/StepCard
@onready var preview_panel: PanelContainer = $MainPanel/MainMargin/MainVBox/DeckHBox/PreviewPanel
@onready var step_tag_label: Label = %StepTagLabel
@onready var step_summary_label: Label = %StepSummaryLabel
@onready var step_hint_label: Label = %StepHintLabel
@onready var preview_label: Label = %PreviewLabel
@onready var preview_subtitle_label: Label = %PreviewSubtitleLabel
@onready var preview_accent: ColorRect = %PreviewAccent
@onready var info_label: RichTextLabel = %InfoLabel
@onready var info_footer: HBoxContainer = %InfoFooter
@onready var info_page_label: Label = %InfoPageLabel
@onready var info_prev_button: Button = %InfoPrevButton
@onready var info_next_button: Button = %InfoNextButton
@onready var choice_container: VBoxContainer = %ChoiceContainer
@onready var status_panel = $StatusPanel

var _selected_pack_style: String = "normal"
var _selected_charcoal_count: int = 3
var _selected_steam_minutes: int = 6

const TUTORIAL_TOTAL_GRAMS := 12
const TUTORIAL_FLAVOR_STOCK := 50
const TUTORIAL_FLAVORS := ["double_apple", "mint"]
var _tutorial_packing_grams: Dictionary = {"double_apple": 6, "mint": 6}
var _tutorial_sliders: Dictionary = {}
var _tutorial_value_labels: Dictionary = {}
var _tutorial_remaining_label: Label = null
var _tutorial_confirm_button: Button = null
var _current_step_num: int = 1
var _focus_mode_active: bool = false
var _focus_status_panel: PanelContainer = null
var _focus_status_label: RichTextLabel = null

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
var _aluminum_glow_timer: Timer
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
var _aluminum_grid_holes: Array[Dictionary] = []
var _aluminum_current_hole: int = 0
var _aluminum_glow_active: bool = false
var _aluminum_glow_elapsed: float = 0.0
var _aluminum_glow_window: float = 1.15

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
var _info_raw_text: String = ""
var _info_pages: Array[String] = []
var _info_page_index: int = 0

var _heat_state: int = 0
var _pull_step_active: bool = false
var _adjust_gauge_active: bool = false

func _process(_delta: float) -> void:
	if status_panel and status_panel.has_method("update_status"):
		status_panel.update_status(_temp_level, _temperature_zone_label(_temp_level), _selected_charcoal_count, TEMP_PASS_LINE, TEMP_TOP_LINE)

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

	_aluminum_timer = Timer.new()
	_aluminum_timer.wait_time = 0.03
	_aluminum_timer.one_shot = false
	_aluminum_timer.timeout.connect(_on_aluminum_tick)
	add_child(_aluminum_timer)

	_aluminum_glow_timer = Timer.new()
	_aluminum_glow_timer.wait_time = 0.03
	_aluminum_glow_timer.one_shot = false
	_aluminum_glow_timer.timeout.connect(_on_aluminum_glow_tick)
	add_child(_aluminum_glow_timer)

	_mind_timer = Timer.new()
	_mind_timer.wait_time = 0.033
	_mind_timer.one_shot = false
	_mind_timer.timeout.connect(_on_mind_barrage_tick)
	add_child(_mind_timer)
	if info_prev_button != null:
		info_prev_button.pressed.connect(_on_info_prev_pressed)
	if info_next_button != null:
		info_next_button.pressed.connect(_on_info_next_pressed)

	_show_intro_step()


func _input(event: InputEvent) -> void:
	if _mind_active and _handle_mind_key_input(event):
		accept_event()
		return
	if not (event is InputEventKey):
		return
	var key_event = event as InputEventKey
	if key_event == null or key_event.echo:
		return
	if not _is_confirm_key_event(key_event):
		return

	if _aluminum_active and key_event.pressed:
		_on_aluminum_press_hole()
		accept_event()
		return
	if _pull_step_active:
		if key_event.pressed:
			_on_pull_hold_started()
		else:
			_on_pull_hold_released()
		accept_event()
		return
	if _adjust_gauge_active:
		if key_event.pressed:
			_on_adjust_hold_started()
		else:
			_on_adjust_hold_released()
		accept_event()
		return
	if key_event.pressed and _try_press_single_choice():
		accept_event()


func _try_press_single_choice() -> bool:
	var buttons: Array[Button] = []
	for child in choice_container.get_children():
		if child is Button:
			var button := child as Button
			if button.visible and not button.disabled:
				buttons.append(button)
	if buttons.size() != 1:
		return false
	buttons[0].emit_signal("pressed")
	return true


func _handle_mind_key_input(event: InputEvent) -> bool:
	if not (event is InputEventKey):
		return false
	var key_event = event as InputEventKey
	if key_event == null or key_event.echo:
		return false
	var key = key_event.physical_keycode if key_event.physical_keycode != 0 else key_event.keycode
	var pressed = key_event.pressed
	match key:
		KEY_LEFT, KEY_A:
			_set_mind_direction("left", pressed)
			return true
		KEY_RIGHT, KEY_D:
			_set_mind_direction("right", pressed)
			return true
		KEY_UP, KEY_W:
			_set_mind_direction("up", pressed)
			return true
		KEY_DOWN, KEY_S:
			_set_mind_direction("down", pressed)
			return true
		_:
			return false


func _is_confirm_key_event(event: InputEventKey) -> bool:
	var key = event.physical_keycode if event.physical_keycode != 0 else event.keycode
	return key == KEY_SPACE or key == KEY_ENTER or key == KEY_KP_ENTER


func _set_phase(step_num: int, title: String, body: String) -> void:
	_current_step_num = step_num
	header_label.text = title
	phase_label.text = "TUTORIAL STEP %d / %d" % [step_num, TOTAL_STEPS]
	_apply_step_layout(step_num)
	_set_focus_mode(false)
	_set_info_text(body)
	_update_step_stage(step_num, title)


func _apply_step_layout(step_num: int) -> void:
	var compact = _is_compact_layout_step(step_num)
	if main_panel != null:
		main_panel.offset_top = MAIN_PANEL_TOP_COMPACT if compact else MAIN_PANEL_TOP_DEFAULT
		main_panel.offset_bottom = MAIN_PANEL_BOTTOM
	if step_card != null:
		step_card.custom_minimum_size.y = STEP_CARD_HEIGHT_COMPACT if compact else STEP_CARD_HEIGHT_DEFAULT
	if preview_panel != null:
		preview_panel.custom_minimum_size = Vector2(
			PREVIEW_PANEL_WIDTH,
			STEP_CARD_HEIGHT_COMPACT if compact else STEP_CARD_HEIGHT_DEFAULT
		)
	if info_label != null:
		info_label.custom_minimum_size.y = INFO_HEIGHT_COMPACT if compact else INFO_HEIGHT_DEFAULT


func _set_focus_mode(active: bool) -> void:
	_focus_mode_active = active
	var compact = _is_compact_layout_step(_current_step_num)
	if deck_hbox != null:
		deck_hbox.visible = not active
	if main_panel != null:
		main_panel.offset_top = 16.0 if active else (MAIN_PANEL_TOP_COMPACT if compact else MAIN_PANEL_TOP_DEFAULT)
	if info_label != null:
		info_label.visible = not active
		info_label.custom_minimum_size.y = 74.0 if active else (INFO_HEIGHT_COMPACT if compact else INFO_HEIGHT_DEFAULT)
	if info_footer != null:
		info_footer.visible = (not active) and _info_pages.size() > 1
	if choice_container != null:
		choice_container.size_flags_vertical = Control.SIZE_EXPAND_FILL if active else 0


func _is_compact_layout_step(step_num: int) -> bool:
	return step_num == 2 or step_num == 4 or step_num >= 7

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


func _set_info_text(text: String, jump_to_last: bool = false) -> void:
	_info_raw_text = _compact_info_text(text)
	_info_pages = _paginate_info_text(_info_raw_text)
	_info_page_index = maxi(_info_pages.size() - 1, 0) if jump_to_last else 0
	_refresh_info_page()


func _compact_info_text(text: String) -> String:
	if text.strip_edges() == "":
		return ""
	var lines = text.split("\n", false)
	var compacted: Array[String] = []
	var blank_streak := 0
	for raw_line in lines:
		var line = str(raw_line).strip_edges()
		if line == "":
			if blank_streak == 0 and not compacted.is_empty():
				compacted.append("")
			blank_streak += 1
			continue
		blank_streak = 0
		compacted.append(line)
	return "\n".join(compacted).strip_edges()


func _paginate_info_text(text: String) -> Array[String]:
	var pages: Array[String] = []
	if text == "":
		pages.append("")
		return pages
	var wrapped = GameManager.format_story_text(text, INFO_WRAP_CHARS)
	var lines = wrapped.split("\n", false)
	var current_lines: Array[String] = []
	for raw_line in lines:
		var line = str(raw_line)
		if line == "" and current_lines.is_empty():
			continue
		current_lines.append(line)
		if current_lines.size() >= INFO_PAGE_MAX_LINES:
			pages.append("\n".join(current_lines).strip_edges())
			current_lines.clear()
	if not current_lines.is_empty():
		pages.append("\n".join(current_lines).strip_edges())
	if pages.is_empty():
		pages.append("")
	return pages


func _refresh_info_page() -> void:
	if info_label == null:
		return
	if _info_pages.is_empty():
		_info_pages = [""]
	_info_page_index = clampi(_info_page_index, 0, _info_pages.size() - 1)
	info_label.text = _info_pages[_info_page_index]
	info_label.visible = not _focus_mode_active
	if info_footer == null:
		return
	var multi_page = _info_pages.size() > 1
	info_footer.visible = multi_page and not _focus_mode_active
	if info_page_label != null:
		info_page_label.text = "説明 %d / %d" % [_info_page_index + 1, _info_pages.size()]
	if info_prev_button != null:
		info_prev_button.disabled = not multi_page or _info_page_index <= 0
	if info_next_button != null:
		info_next_button.disabled = not multi_page or _info_page_index >= _info_pages.size() - 1


func _on_info_prev_pressed() -> void:
	if _info_page_index <= 0:
		return
	_info_page_index -= 1
	_refresh_info_page()


func _on_info_next_pressed() -> void:
	if _info_page_index >= _info_pages.size() - 1:
		return
	_info_page_index += 1
	_refresh_info_page()


func _update_step_stage(step_num: int, title: String) -> void:
	var meta: Dictionary = STEP_STAGE_META.get(step_num, {})
	if step_tag_label != null:
		step_tag_label.text = str(meta.get("tag", "STEP"))
	if step_summary_label != null:
		step_summary_label.text = str(meta.get("summary", title))
	if step_hint_label != null:
		step_hint_label.text = str(meta.get("hint", "後から画像や小アニメを差し込める。"))
	if preview_label != null:
		preview_label.text = title
	if preview_subtitle_label != null:
		preview_subtitle_label.text = str(meta.get("preview", "演出プレビュー待ち"))
	if preview_accent != null:
		preview_accent.color = meta.get("color", Color("feae34"))
		preview_accent.scale = Vector2(1.05, 1.05)
		preview_accent.modulate.a = 0.88
		var tween = create_tween()
		tween.set_parallel(true)
		tween.tween_property(preview_accent, "scale", Vector2.ONE, 0.22)
		tween.tween_property(preview_accent, "modulate:a", 0.42, 0.28)



func _clear_choices() -> void:
	for child in choice_container.get_children():
		child.queue_free()
	_focus_status_panel = null
	_focus_status_label = null
	if _pull_timer != null:
		_pull_timer.stop()
	_pull_is_holding = false
	_pull_step_active = false
	if _adjust_timer != null:
		_adjust_timer.stop()
	_adjust_is_holding = false
	_adjust_gauge_active = false
	if _aluminum_glow_timer != null:
		_aluminum_glow_timer.stop()
	_aluminum_glow_active = false


func _set_runtime_status(text: String) -> void:
	if not _focus_mode_active:
		_set_info_text(text)
		return
	_ensure_focus_status_panel()
	if _focus_status_label != null and is_instance_valid(_focus_status_label):
		_focus_status_label.text = text


func _ensure_focus_status_panel() -> void:
	if choice_container == null:
		return
	if _focus_status_panel != null and is_instance_valid(_focus_status_panel):
		choice_container.move_child(_focus_status_panel, 0)
		return
	var panel = PanelContainer.new()
	panel.name = "FocusStatusPanel"
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.custom_minimum_size = Vector2(0, 68)

	var margin = MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 14)
	margin.add_theme_constant_override("margin_top", 10)
	margin.add_theme_constant_override("margin_right", 14)
	margin.add_theme_constant_override("margin_bottom", 10)
	panel.add_child(margin)

	var label = RichTextLabel.new()
	label.bbcode_enabled = false
	label.fit_content = true
	label.scroll_active = false
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	label.custom_minimum_size = Vector2(0, 48)
	label.add_theme_font_size_override("normal_font_size", 18)
	margin.add_child(label)

	choice_container.add_child(panel)
	choice_container.move_child(panel, 0)
	_focus_status_panel = panel
	_focus_status_label = label


func _add_choice_button(text: String, callback: Callable) -> Button:
	var button = Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(0, 34)
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.pressed.connect(func() -> void:
		GameManager.play_ui_se("cursor")
		callback.call()
	)
	choice_container.add_child(button)
	return button


func _ensure_tutorial_flavors() -> void:
	for flavor_id in TUTORIAL_FLAVORS:
		var current = PlayerData.get_flavor_amount(flavor_id)
		if current < TUTORIAL_FLAVOR_STOCK:
			PlayerData.add_flavor(flavor_id, TUTORIAL_FLAVOR_STOCK - current)


func _show_center_countdown(final_text: String = "START") -> void:
	var layer = CanvasLayer.new()
	layer.layer = 100
	add_child(layer)

	var center = CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(center)

	var panel = PanelContainer.new()
	panel.custom_minimum_size = Vector2(220, 120)
	center.add_child(panel)

	var label = Label.new()
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.custom_minimum_size = Vector2(180, 84)
	label.add_theme_font_size_override("font_size", 54)
	panel.add_child(label)

	for step_text in ["3", "2", "1", final_text]:
		label.text = step_text
		label.scale = Vector2(1.16, 1.16)
		label.modulate = Color(1, 1, 1, 0)
		var tween = create_tween()
		tween.set_parallel(true)
		tween.tween_property(label, "modulate:a", 1.0, 0.1)
		tween.tween_property(label, "scale", Vector2.ONE, 0.16)
		await tween.finished
		await get_tree().create_timer(0.34 if step_text == final_text else 0.42).timeout

	layer.queue_free()


func _show_intro_step() -> void:
	_ensure_tutorial_flavors()
	_set_phase(
		1,
		"スミさんの特訓",
		_join_lines([
			"スミ「さっき渡したダブルアップルとミント、練習に使え」",
			"スミ「大会は基礎で勝つ。まずは王道のミックスだ」",
			"",
			"大会導線を短縮して一通りなぞる。",
			"1. 配分  2. 詰め方  3. 穴あけ",
			"4. 炭準備  5. 炭配置  6. 蒸らし",
			"7. 思考整理  8. 吸い出し  9. 温度維持"
		])
	)
	_clear_choices()
	_add_choice_button("特訓を始める", _show_mix_step)

func _show_mix_step() -> void:
	_ensure_tutorial_flavors()
	_set_phase(2, "フレーバーの配分", "ダブルアップルとミントの配合を決める。\n合計12gになるようスライダーで調整する。")
	_clear_choices()
	_tutorial_sliders.clear()
	_tutorial_value_labels.clear()

	var title = Label.new()
	title.text = "12g / 1g刻み"
	title.add_theme_font_size_override("font_size", 16)
	title.add_theme_color_override("font_color", GameManager.THEME_DIM_TEXT)
	choice_container.add_child(title)

	for flavor_id in TUTORIAL_FLAVORS:
		choice_container.add_child(_build_tutorial_slider_row(flavor_id))

	_tutorial_remaining_label = Label.new()
	_tutorial_remaining_label.add_theme_font_size_override("font_size", 16)
	choice_container.add_child(_tutorial_remaining_label)

	_tutorial_confirm_button = _add_choice_button("この配合で確定", _on_tutorial_mix_confirmed)
	_tutorial_confirm_button.custom_minimum_size = Vector2(0, 34)
	_refresh_tutorial_packing()


func _build_tutorial_slider_row(flavor_id: String) -> Control:
	var wrapper = VBoxContainer.new()
	wrapper.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	wrapper.add_theme_constant_override("separation", 2)

	var label = Label.new()
	var holding_amount = PlayerData.get_flavor_amount(flavor_id)
	label.text = "%s %dg / 在庫%d" % [_tutorial_flavor_name(flavor_id), int(_tutorial_packing_grams.get(flavor_id, 0)), holding_amount]
	label.add_theme_font_size_override("font_size", 16)
	wrapper.add_child(label)
	_tutorial_value_labels[flavor_id] = label

	var slider = HSlider.new()
	slider.min_value = 0
	slider.max_value = TUTORIAL_TOTAL_GRAMS
	slider.step = 1
	slider.value = int(_tutorial_packing_grams.get(flavor_id, 0))
	slider.custom_minimum_size = Vector2(0, 20)
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
				label.text = "%s %dg / 在庫%d" % [_tutorial_flavor_name(fid), grams, holding_amount]
		if _tutorial_sliders.has(fid):
			var slider = _tutorial_sliders[fid] as HSlider
			if slider != null and int(round(slider.value)) != grams:
				slider.value = grams

	var remaining = TUTORIAL_TOTAL_GRAMS - total
	if _tutorial_remaining_label != null:
		if remaining == 0:
			_tutorial_remaining_label.text = "残り0g / OK"
		elif remaining > 0:
			_tutorial_remaining_label.text = "残り%dg" % remaining
		else:
			_tutorial_remaining_label.text = "超過%dg / 12gへ戻す" % abs(remaining)
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
		"配合: ダブルアップル %dg / ミント %dg\n%s\n\nスミ「ミックスは自由だが、芯がないとただ味が濁るだけだ。次は詰め方を決める」" % [apple_g, mint_g, feedback]
	)
	_clear_choices()
	_add_choice_button("次へ（パッキングスタイル）", _show_packing_style_step)


func _show_packing_style_step() -> void:
	_set_phase(3, "パッキングスタイル", "大会と同じ基準で、葉の詰め方を選ぶ。吸い心地と火力に影響する。")
	_clear_choices()
	var lines: Array[String] = []
	lines.append("ふわふわ: 軽い立ち上がり。吸いやすいが熱量はやや弱い。")
	lines.append("ふつう: バランス重視。大会でも基準にしやすい。")
	lines.append("しっかり: 厚い煙が出るが、火力管理を外すと暴れやすい。")
	_set_runtime_status(_join_lines(lines))
	_add_choice_button("ふわふわ（軽い立ち上がり）", _on_packing_style_selected.bind("fluffy"))
	_add_choice_button("ふつう（大会基準 / 安定）", _on_packing_style_selected.bind("normal"))
	_add_choice_button("しっかり（厚い煙 / 高火力寄り）", _on_packing_style_selected.bind("firm"))


func _on_packing_style_selected(style: String) -> void:
	_selected_pack_style = style
	var message = ""
	match style:
		"fluffy":
			message = "ふわっと詰める。温度は入りやすいが、煙の厚みは控えめ。"
		"firm":
			message = "しっかり詰める。煙は重くなるが、火力管理を丁寧にやる必要がある。"
		_:
			message = "標準的な密度で詰める。大会でも基準にしやすい安定型。"
	GameManager.play_ui_se("confirm")
	_set_phase(3, "パッキングスタイル: 決定", "%s\n\nスミ「詰め方は後の温度管理まで響く。次はアルミ張りだ」" % message)
	_clear_choices()
	_add_choice_button("次へ（アルミ張り）", _show_aluminum_step)

func _show_aluminum_step() -> void:
	_set_phase(4, "アルミ穴あけ", "説明を読んだら開始。プレイ中は光っている穴だけ押す。金色のうちに押すほど高評価。")
	_clear_choices()
	var lines: Array[String] = []
	lines.append("1. 銀パネルの穴が1つずつ光る")
	lines.append("2. 今 光っている穴だけ押す")
	lines.append("3. 金のうち=PERFECT / 少し遅い=GOOD / 遅い=NEAR")
	lines.append("4. 消えた後や別タイミングで押すとMISS")
	_set_runtime_status(_join_lines(lines))
	_add_choice_button("穴あけ開始", _start_aluminum_step)


func _start_aluminum_step() -> void:
	_set_phase(4, "アルミ穴あけ", "光っている穴を順番に押す。")
	_set_focus_mode(true)
	_clear_choices()
	_aluminum_notes.clear()
	_aluminum_notes_spawned = 0
	_aluminum_spawn_cooldown = 0
	_aluminum_hit_slot = 0
	_aluminum_hit_perfect = 0
	_aluminum_hit_good = 0
	_aluminum_hit_near = 0
	_aluminum_hit_miss = 0
	_aluminum_bad_press = 0
	_aluminum_total_notes = 18
	_aluminum_required_hits = 12
	_aluminum_current_hole = 0
	_aluminum_glow_active = false
	_aluminum_glow_elapsed = 0.0
	_aluminum_glow_window = 1.25
	_aluminum_grid_holes.clear()

	var cols := 6
	var rows := 3
	for i in range(_aluminum_total_notes):
		var row = i / cols
		var col = i % cols
		_aluminum_grid_holes.append({
			"row": row,
			"col": col,
			"result": "",
		})
	_aluminum_grid_holes.shuffle()

	var guide = Label.new()
	guide.text = "金のうちに押す。Space / Enter でもOK"
	guide.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	guide.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	guide.add_theme_font_size_override("font_size", 16)
	choice_container.add_child(guide)

	var grid_visual = _AluminumGridVisual.new()
	grid_visual.name = "AluminumGrid"
	grid_visual.custom_minimum_size = Vector2(0, 220)
	grid_visual.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid_visual.holes = _aluminum_grid_holes
	grid_visual.current_hole = _aluminum_current_hole
	grid_visual.cols = cols
	grid_visual.total_rows = rows
	choice_container.add_child(grid_visual)

	var press_button = Button.new()
	press_button.text = "今 光っている穴を押す"
	press_button.custom_minimum_size = Vector2(0, 52)
	press_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	press_button.pressed.connect(_on_aluminum_press_hole)
	choice_container.add_child(press_button)

	_update_aluminum_rhythm_text()
	await _show_center_countdown("START")
	_aluminum_active = true
	_start_next_aluminum_glow()
	_update_aluminum_rhythm_text()

func _on_aluminum_tick() -> void:
	pass


func _start_next_aluminum_glow() -> void:
	if _aluminum_current_hole >= _aluminum_grid_holes.size():
		_finish_aluminum_rhythm()
		return
	_aluminum_glow_active = true
	_aluminum_glow_elapsed = 0.0
	_aluminum_glow_timer.start()
	_update_aluminum_grid_visual()


func _on_aluminum_glow_tick() -> void:
	if not _aluminum_glow_active:
		_aluminum_glow_timer.stop()
		return
	_aluminum_glow_elapsed += _aluminum_glow_timer.wait_time
	if _aluminum_glow_elapsed >= _aluminum_glow_window:
		_aluminum_glow_active = false
		_aluminum_glow_timer.stop()
		_aluminum_hit_miss += 1
		_aluminum_grid_holes[_aluminum_current_hole]["result"] = "miss"
		_aluminum_show_hit_feedback("MISS", Color("e43b44"))
		_aluminum_current_hole += 1
		_update_aluminum_rhythm_text()
		get_tree().create_timer(0.24).timeout.connect(_start_next_aluminum_glow)
	else:
		_update_aluminum_grid_visual()

func _on_aluminum_press_hole() -> void:
	if not _aluminum_active or not _aluminum_glow_active:
		if _aluminum_active:
			_aluminum_bad_press += 1
			GameManager.play_ui_se("cancel")
			_aluminum_show_hit_feedback("MISS", Color("e43b44"))
			_update_aluminum_rhythm_text()
		return

	_aluminum_glow_active = false
	_aluminum_glow_timer.stop()
	var ratio = _aluminum_glow_elapsed / maxf(_aluminum_glow_window, 0.01)
	if ratio <= 0.35:
		_aluminum_hit_perfect += 1
		GameManager.play_ui_se("confirm")
		_aluminum_grid_holes[_aluminum_current_hole]["result"] = "perfect"
		_aluminum_show_hit_feedback("PERFECT!", Color("feae34"))
	elif ratio <= 0.68:
		_aluminum_hit_good += 1
		GameManager.play_ui_se("confirm")
		_aluminum_grid_holes[_aluminum_current_hole]["result"] = "good"
		_aluminum_show_hit_feedback("GOOD", Color("3e8948"))
	else:
		_aluminum_hit_near += 1
		GameManager.play_ui_se("cursor")
		_aluminum_grid_holes[_aluminum_current_hole]["result"] = "near"
		_aluminum_show_hit_feedback("NEAR", Color("8b9bb4"))

	_aluminum_current_hole += 1
	_update_aluminum_rhythm_text()
	get_tree().create_timer(0.18).timeout.connect(_start_next_aluminum_glow)

func _finish_aluminum_rhythm() -> void:
	if not _aluminum_active:
		return
	_aluminum_active = false
	_aluminum_timer.stop()
	_aluminum_glow_timer.stop()

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
	_add_choice_button("次へ（炭の準備）", _show_charcoal_prep_step)

func _update_aluminum_rhythm_text() -> void:
	var hit_count = _count_aluminum_hits()
	var remain = maxi(0, _aluminum_required_hits - hit_count)
	var lines: Array[String] = []
	lines.append("今 光っている穴だけ押す。消えたらMISS。")
	lines.append("進捗 %d / %d　必要成功 %d（残り %d）" % [_aluminum_current_hole, _aluminum_total_notes, _aluminum_required_hits, remain])
	lines.append("判定 P%d / G%d / N%d / M%d / 空振り%d" % [
		_aluminum_hit_perfect,
		_aluminum_hit_good,
		_aluminum_hit_near,
		_aluminum_hit_miss,
		_aluminum_bad_press,
	])
	lines.append("金=PERFECT / 緑=GOOD / 灰=NEAR / 赤=MISS")
	_set_runtime_status(_join_lines(lines))


func _update_aluminum_grid_visual() -> void:
	var grid_node = choice_container.find_child("AluminumGrid", true, false) as _AluminumGridVisual
	if grid_node != null:
		grid_node.holes = _aluminum_grid_holes
		grid_node.current_hole = _aluminum_current_hole
		grid_node.glow_ratio = _aluminum_glow_elapsed / maxf(_aluminum_glow_window, 0.01)
		grid_node.queue_redraw()


func _aluminum_show_hit_feedback(text: String, color: Color) -> void:
	var grid_node = choice_container.find_child("AluminumGrid", true, false)
	if grid_node == null:
		return
	var label = Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", 24)
	label.add_theme_color_override("font_color", color)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.position = Vector2(grid_node.size.x * 0.5 - 64, grid_node.size.y * 0.5 - 14)
	label.modulate.a = 1.0
	grid_node.add_child(label)
	var tween = create_tween()
	tween.set_parallel(true)
	tween.tween_property(label, "position:y", label.position.y - 34, 0.4).set_trans(Tween.TRANS_CUBIC)
	tween.tween_property(label, "modulate:a", 0.0, 0.26).set_delay(0.22)
	tween.chain().tween_callback(label.queue_free)

func _count_aluminum_hits() -> int:
	return _aluminum_hit_perfect + _aluminum_hit_good + _aluminum_hit_near

func _show_charcoal_prep_step() -> void:
	_set_phase(5, "炭の準備", "大会と同じように、炭を返すタイミングを決める。")
	_clear_choices()
	_set_info_text(_join_lines([
		"早め: 立ち上がりを抑えやすい。",
		"ちょうど: 一番安定しやすい。",
		"遅め: 火力は強いが暴れやすい。",
	]))
	_add_choice_button("早めに炭を返す", _on_charcoal_prep_choice.bind("early"))
	_add_choice_button("ちょうどで炭を返す", _on_charcoal_prep_choice.bind("perfect"))
	_add_choice_button("遅めに炭を返す", _on_charcoal_prep_choice.bind("late"))


func _on_charcoal_prep_choice(choice: String) -> void:
	var delta_spec = 0
	match choice:
		"early":
			delta_spec = 1
			_heat_state -= 1
		"late":
			delta_spec = -1
			_heat_state += 1
		_:
			delta_spec = 2
	_heat_state = clampi(_heat_state, -3, 3)
	_set_phase(5, "炭の準備: 決定", "炭の初速を整えた。専門 %+d\n\nスミ「次は炭をどこまで乗せるかだ」" % delta_spec)
	_clear_choices()
	_add_choice_button("次へ（炭の配置）", _show_charcoal_place_step)


func _show_charcoal_place_step() -> void:
	_set_phase(6, "炭の配置", "3個か4個を選んで配置する。機材と好みに合わせる。")
	_clear_choices()
	var hint = "通常は3個が基本。"
	_set_info_text("【ヒント】\n" + hint)
	_add_choice_button("3個（基本／安定）", _on_charcoal_place_selected.bind(3))
	_add_choice_button("4個（攻め／狙いがある時）", _on_charcoal_place_selected.bind(4))

func _on_charcoal_place_selected(count: int) -> void:
	_selected_charcoal_count = count
	_set_phase(6, "炭の配置: 決定", "選んだ炭の個数: %d個\n\nスミ「よし。次は蒸らし時間だ」" % count)
	_clear_choices()
	_add_choice_button("次へ（蒸らし時間）", _show_steam_step)

var _tutorial_steam_minutes_setting: int = 6
var _tutorial_timer_label: Label

func _show_steam_step() -> void:
	_set_phase(7, "蒸らしタイマー", "5〜10分から蒸らし時間を設定。\nスミ「じっくり温めるか、高温で一足飛びに行くか。意図を持て」")
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
	_set_phase(8, "吸い出し前: 思考の暴走", "説明を読んだら開始。プレイ中は中央の自機で雑念を避けて耐える。")
	_clear_choices()
	var lines: Array[String] = []
	lines.append("中央スタート。時間まで弾を避ける。")
	lines.append("操作: 矢印キー / WASD　集中: Shift / Z")
	lines.append("被弾が多いほど、この後の吸い出し速度が悪化。")
	lines.append("耐久 %.1f秒 / 残機 %d" % [duration_sec, lives])
	_set_runtime_status(_join_lines(lines))
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
	_set_phase(8, "思考弾幕", "中央スタート。時間まで耐える。")
	_set_focus_mode(true)
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
	guide.text = "操作: 矢印キー / WASD　集中: Shift / Z"
	guide.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	guide.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	guide.add_theme_font_size_override("font_size", 15)
	choice_container.add_child(guide)

	var arena_frame = PanelContainer.new()
	arena_frame.custom_minimum_size = Vector2(0, 232)
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

	await get_tree().process_frame
	await get_tree().process_frame
	if _mind_arena_layer != null and is_instance_valid(_mind_arena_layer):
		var arena_size = _mind_arena_layer.size
		if arena_size.x > 40.0 and arena_size.y > 40.0:
			_mind_player_pos = arena_size * 0.5
			_sync_mind_player_node()

	_update_mind_barrage_info_text()
	await _show_center_countdown("START")
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
	lines.append("残り %.1f秒  %s" % [remain, _build_mind_barrage_progress_bar(ratio)])
	lines.append("残機 %s  被弾 %d" % [_build_mind_life_text(), _mind_hits])
	lines.append("集中度 %d%%" % focus)
	lines.append("操作: 矢印 / WASD　集中: Shift / Z")
	_set_runtime_status(_join_lines(lines))

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
		8,
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
		9,
		"吸い出し練習",
		"ゲージを止めて適温帯へ入れる。長押しして、狙った位置で離す。"
	)
	_set_focus_mode(true)
	_clear_choices()
	_pull_step_finished = false
	_pull_is_holding = false
	_pull_step_active = true
	_configure_pull_by_setup()

	var hold_button = Button.new()
	hold_button.text = "押して吸う（離して止める / Space / Enter）"
	hold_button.custom_minimum_size = Vector2(0, 48)
	hold_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hold_button.button_down.connect(_on_pull_hold_started)
	hold_button.button_up.connect(_on_pull_hold_released)
	hold_button.mouse_exited.connect(_on_pull_hold_released)
	choice_container.add_child(hold_button)

	_update_pull_text("開始前: 速度補正 %s" % _mind_pull_adjust_text())


func _compute_pull_start_temp_level() -> float:
	var level = TEMP_PASS_LINE - 0.22
	if _selected_pack_style == "fluffy":
		level += 0.03
	elif _selected_pack_style == "firm":
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
	if _selected_pack_style == "fluffy":
		speed -= 0.08
		width += 0.02
		center -= 0.01
	elif _selected_pack_style == "firm":
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
	_pull_gauge_value += _pull_gauge_speed * delta
	if _pull_gauge_value >= 1.0:
		_pull_gauge_value = fposmod(_pull_gauge_value, 1.0)
	_update_pull_text("吸い出し中...離すと判定")


func _resolve_pull_quality() -> void:
	_pull_step_finished = true
	_pull_step_active = false
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
			feedback = "適温の芯に入った。"
		"good":
			feedback = "実戦でも通る温度帯。"
		"near":
			feedback = "ギリギリで残した。"
		_:
			feedback = "温度帯を外した。"

	GameManager.play_ui_se("confirm" if quality != "miss" else "cancel")
	_update_pull_text("判定 %s / %s" % [quality.to_upper(), feedback])
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
	lines.append("左=低温　中央=適温　右=高温")
	lines.append("目標帯 ■ / 今 ◆")
	lines.append(bar)
	lines.append("現在: %s / %d℃" % [_temperature_zone_label(preview_temp), _temperature_to_celsius(preview_temp)])
	lines.append("未達なら右、過熱なら左へ寄せる。")
	_set_runtime_status(_join_lines(lines))


func _start_adjustment_tutorial() -> void:
	_adjust_round = 0
	_adjust_success_count = 0
	_adjustment_action_count = 0
	_adjust_round_drift = 0.0
	_show_adjustment_menu()


func _show_adjustment_menu() -> void:
	var cue = "スミ「どう調整する？」"
	_set_phase(
		10,
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
		10,
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

func _show_step_result_and_next(msg: String, next_func: Callable) -> void:
	_set_phase(10, "調整結果", msg)
	_clear_choices()
	_add_choice_button("次へ", next_func)


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
		10,
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

	if _selected_pack_style == "firm":
		if drift > 0.0:
			drift += 0.02
		else:
			drift -= 0.02
	elif _selected_pack_style == "fluffy":
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
		10,
		"調整ゲージ %d / %d" % [round_num, ADJUST_TOTAL_ROUNDS],
		"選択した方向: %s\n押している間だけ調整、離した瞬間で判定。\nボタンでも Space / Enter でも操作できる。" % _adjust_action_label(_adjust_selected_action)
	)
	_clear_choices()
	_adjust_step_finished = false
	_adjust_is_holding = false
	_adjust_gauge_active = true
	_configure_adjust_gauge()

	var hold_button = Button.new()
	hold_button.text = "押して調整（離して決定 / Space / Enter）"
	hold_button.custom_minimum_size = Vector2(0, 48)
	hold_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hold_button.button_down.connect(_on_adjust_hold_started)
	hold_button.button_up.connect(_on_adjust_hold_released)
	hold_button.mouse_exited.connect(_on_adjust_hold_released)
	choice_container.add_child(hold_button)

	_update_adjust_text("調整待機中")


func _configure_adjust_gauge() -> void:
	var speed = 1.02 + float(_adjust_round) * 0.16
	var width = 0.18 - float(_adjust_round) * 0.015
	if _selected_pack_style == "firm":
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
	_adjust_gauge_value += _adjust_gauge_speed * delta
	if _adjust_gauge_value >= 1.0:
		_adjust_gauge_value = fposmod(_adjust_gauge_value, 1.0)
	_update_adjust_text("調整中...離すと判定")


func _resolve_adjustment_round() -> void:
	_adjust_step_finished = true
	_adjust_gauge_active = false
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
	if _selected_pack_style == "firm":
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
		10,
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
	lines.append("操作: 長押しして離す。ゲージは左→右へ流れて端で左に戻る。")
	lines.append("左ほど弱く、右ほど強い。成功: 方向正解 + GOOD以上。")
	lines.append_array(_build_temperature_band_lines(_temp_level))
	lines.append("調整タイミング目標帯 ■ / ポインタ ◆")
	lines.append(bar)
	_set_runtime_status(_join_lines(lines))


func _build_temperature_band_lines(value: float, drift: float = 0.0) -> Array[String]:
	var lines: Array[String] = []
	lines.append("現在: %s / %d℃" % [_temperature_zone_label(value), _temperature_to_celsius(value)])
	lines.append("目標: 合格帯〜最高帯を維持")
	lines.append("低温=上げる / 過熱=下げる")
	lines.append(_build_temperature_zone_cells(value))
	if abs(drift) >= 0.03:
		lines.append("傾向: %s" % _temperature_trend_text(drift))
	return lines


func _build_temperature_zone_cells(value: float) -> String:
	var low = "●" if value < TEMP_PASS_LINE else " "
	var p = "●" if value >= TEMP_PASS_LINE and value < _temperature_center() else " "
	var top = "●" if value >= _temperature_center() and value <= TEMP_TOP_LINE else " "
	var high = "●" if value > TEMP_TOP_LINE else " "
	return "[低温 %s|上げる] [合格 %s] [最高 %s] [過熱 %s|下げる]" % [low, p, top, high]


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
	if next_scene == "":
		next_scene = DEFAULT_NEXT_SCENE

	# wait a frame then defer call to change scene to ensure clean UI state
	await get_tree().process_frame
	get_tree().change_scene_to_file.call_deferred(next_scene)


class _AluminumGridVisual extends Control:
	var holes: Array = []
	var current_hole: int = 0
	var cols: int = 6
	var total_rows: int = 3
	var glow_ratio: float = 0.0

	func _draw() -> void:
		var w = size.x
		var h = size.y
		var margin = 16.0
		var cell_w = (w - margin * 2.0) / float(maxi(cols, 1))
		var cell_h = (h - margin * 2.0) / float(maxi(total_rows, 1))
		var radius = minf(cell_w, cell_h) * 0.28

		draw_rect(Rect2(margin - 4.0, margin - 4.0, w - margin * 2.0 + 8.0, h - margin * 2.0 + 8.0), Color("8b9bb4", 0.14), true)
		draw_rect(Rect2(margin - 4.0, margin - 4.0, w - margin * 2.0 + 8.0, h - margin * 2.0 + 8.0), Color("8b9bb4", 0.32), false, 1.0)

		for i in range(holes.size()):
			var hole = holes[i]
			var row = int(hole.get("row", 0))
			var col = int(hole.get("col", 0))
			var result = str(hole.get("result", ""))
			var pos = Vector2(
				margin + cell_w * (float(col) + 0.5),
				margin + cell_h * (float(row) + 0.5)
			)

			if i < current_hole:
				var color = Color("5a6988", 0.52)
				match result:
					"perfect":
						color = Color("feae34", 0.92)
					"good":
						color = Color("3e8948", 0.86)
					"near":
						color = Color("8b9bb4", 0.76)
					"miss":
						color = Color("e43b44", 0.54)
				draw_circle(pos, radius, color)
			elif i == current_hole:
				var glow_alpha = clampf((1.0 - glow_ratio) * 0.75 + 0.25, 0.28, 1.0)
				var glow_size = radius + lerpf(6.0, 2.0, glow_ratio)
				draw_circle(pos, glow_size, Color("feae34", glow_alpha * 0.3))
				draw_circle(pos, radius, Color("feae34", glow_alpha))
				draw_arc(pos, glow_size, 0.0, TAU, 24, Color("feae34", glow_alpha * 0.55), 2.0)
			else:
				draw_circle(pos, radius * 0.58, Color("3a4466", 0.24))
