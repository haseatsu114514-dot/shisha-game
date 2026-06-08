extends Control

signal dialogue_finished(dialogue_id: String)

@export var dialogue_file: String = "res://data/dialogue/ch1_main.json"
@export var dialogue_id: String = ""
@export var next_scene_path: String = ""

@onready var speaker_label: Label = %SpeakerLabel
@onready var text_label: RichTextLabel = %TextLabel
@onready var choice_container: VBoxContainer = %ChoiceContainer
@onready var advance_button: Button = %AdvanceButton
@onready var auto_button: Button = %AutoButton
@onready var typing_timer: Timer = %TypingTimer
@onready var auto_timer: Timer = %AutoTimer
@onready var portrait_layer: Control = %PortraitLayer
@onready var portrait_left_rect: TextureRect = %PortraitLeft
@onready var portrait_center_rect: TextureRect = %PortraitCenter
@onready var portrait_right_rect: TextureRect = %PortraitRight
@onready var background_image: TextureRect = %BackgroundImage
@onready var cg_rect: TextureRect = %CGRect
@onready var smoke_particles: GPUParticles2D = $SmokeParticles
@onready var log_button: Button = %LogButton
@onready var history_panel: Control = %HistoryPanel
@onready var history_vbox: VBoxContainer = %HistoryVBox
@onready var close_history_button: Button = %CloseHistoryButton
@onready var dialogue_panel: PanelContainer = $DialoguePanel

var _line_queue: Array[Dictionary] = []
var _history: Array[Dictionary] = []
var _branches: Dictionary = {}
var _metadata: Dictionary = {}
var _pending_confession := ""

var _is_typing = false
var _full_text = ""
var _full_text_bbcode = ""
var _current_char = 0
var _current_speaker = ""
var _auto_enabled = false
var _dialogue_ending := false
var _advance_hold_timer: Timer
var _advance_repeat_timer: Timer
var _advance_hold_active := false
var _ignore_advance_press_once := false
var _portrait_texture_cache: Dictionary = {}
var _portrait_union_rect_cache: Dictionary = {}
var _portrait_rects: Array[TextureRect] = []
var _portrait_cast: Array[Dictionary] = []
var _v2_bottom_bar: HBoxContainer
var _v2_menu_button: Button
var _v2_location_label: Label
var _v2_time_label: Label
var _v2_level_label: Label
var _v2_level_fill: ColorRect
var _v2_name_plate: PanelContainer

const SYSTEM_MENU_SCENE = preload("res://scenes/ui/system_menu.tscn")
const DECO_ICON_SCRIPT = preload("res://scripts/ui/dialogue_deco_icon.gd")

const DIALOGUE_WRAP_CHARS := 34
const DIALOGUE_MAX_LINES := 2
const ADVANCE_HOLD_DELAY := 0.34
const ADVANCE_REPEAT_INTERVAL := 0.09
const MAX_VISIBLE_PORTRAITS := 3
const PORTRAIT_FACE_CANDIDATES := [
	"normal",
	"smile",
	"serious",
	"sad",
	"surprise",
	"shy",
	"focus",
	"smug",
	"wink",
	"evil",
	"excited",
	"thinking",
	"fired_up",
	"intense",
	"silent",
	"angry",
	"smoke",
	"cry",
	"grin",
	"shout",
	"ura_normal",
	"ura_smile",
	"ura_serious",
	"ura_sad",
	"ura_surprise",
]
const PORTRAIT_PROFILE_DEFAULT := {
	"side_padding": 10,
	"top_padding": 10,
	"bottom_padding": 8,
	"bottom_trim_ratio": 0.38,
	"bottom_trim_max": 260,
	"min_visible_ratio": 0.48,
	"focus_scale": 1.08,
	"support_scale": 0.98,
	"y_shift_ratio": 0.00,
	"x_shift_ratio": 0.00,
}
const PORTRAIT_PROFILE_BY_CLASS := {
	"standard":
	{
		"bottom_trim_ratio": 0.40,
		"bottom_trim_max": 320,
		"min_visible_ratio": 0.46,
		"focus_scale": 1.12,
		"support_scale": 1.00,
	},
	"tall":
	{
		"bottom_trim_ratio": 0.42,
		"bottom_trim_max": 340,
		"min_visible_ratio": 0.44,
		"focus_scale": 1.18,
		"support_scale": 1.04,
		"y_shift_ratio": -0.02,
	},
	"short":
	{
		"bottom_trim_ratio": 0.24,
		"bottom_trim_max": 220,
		"min_visible_ratio": 0.58,
		"focus_scale": 1.02,
		"support_scale": 0.92,
		"y_shift_ratio": 0.02,
	},
	"mascot":
	{
		"side_padding": 4,
		"top_padding": 4,
		"bottom_padding": 4,
		"bottom_trim_ratio": 0.08,
		"bottom_trim_max": 60,
		"min_visible_ratio": 0.78,
		"focus_scale": 0.90,
		"support_scale": 0.82,
		"y_shift_ratio": 0.05,
	},
}
const PORTRAIT_SLOT_LAYOUTS := {
	1:
	[
		{
			"anchor_x": 0.50,
			"width_ratio": 0.56,
			"height_ratio": 1.12,
			"bottom_overscan_ratio": 0.14,
			"brightness": 1.0,
			"alpha": 1.0,
			"z": 3
		},
	],
	2:
	[
		{
			"anchor_x": 0.24,
			"width_ratio": 0.38,
			"height_ratio": 0.86,
			"bottom_overscan_ratio": 0.06,
			"brightness": 0.72,
			"alpha": 0.88,
			"z": 1
		},
		{
			"anchor_x": 0.61,
			"width_ratio": 0.50,
			"height_ratio": 1.05,
			"bottom_overscan_ratio": 0.12,
			"brightness": 1.0,
			"alpha": 1.0,
			"z": 3
		},
	],
	3:
	[
		{
			"anchor_x": 0.17,
			"width_ratio": 0.34,
			"height_ratio": 0.82,
			"bottom_overscan_ratio": 0.05,
			"brightness": 0.68,
			"alpha": 0.86,
			"z": 1
		},
		{
			"anchor_x": 0.50,
			"width_ratio": 0.46,
			"height_ratio": 1.00,
			"bottom_overscan_ratio": 0.10,
			"brightness": 1.0,
			"alpha": 1.0,
			"z": 3
		},
		{
			"anchor_x": 0.83,
			"width_ratio": 0.34,
			"height_ratio": 0.82,
			"bottom_overscan_ratio": 0.05,
			"brightness": 0.76,
			"alpha": 0.90,
			"z": 2
		},
	],
}
const PORTRAIT_CLASS_BY_SPEAKER := {
	"hajime": "standard",
	"sumi": "tall",
	"naru": "tall",
	"adam": "tall",
	"ryuji": "tall",
	"kumicho": "tall",
	"nagumo": "tall",
	"maezono": "tall",
	"minto": "standard",
	"ageha": "standard",
	"kirishima": "standard",
	"mashiro": "short",
	"tsumugi": "short",
	"tumugi": "short",
	"pakki": "mascot",
}
const PORTRAIT_HIDE_BY_DEFAULT := {
	"hajime": true,
}
const NOTIFICATION_CARD_SIZE := Vector2(860, 108)
const NOTIFICATION_BASE_POSITION := Vector2(210, 304)

const SPEAKER_NAMES := {
	"hajime": "はじめ",
	"sumi": "スミさん",
	"naru": "なる",
	"adam": "アダム",
	"minto": "緑川 栞（みんと）",
	"mashiro": "ましろ",
	"tsumugi": "つむぎ",
	"tumugi": "つむぎ",
	"hazime": "はじめ",
	"pakki": "パッキー",
	"salaryman": "サラリーマン",
	"nagumo": "南雲修二(なぐもしゅうじ)",
	"maezono": "前園壮一郎(まえぞのそういちろう)",
	"kirishima": "霧島レン(きりしまれん)",
	"staff_choizap": "チョイザップスタッフ"
}
const SPEAKER_ID_ALIASES := {
	"tumugi": "tsumugi",
	"hazime": "hajime",
	"takiguchi": "pakki",
}
const HIGHLIGHT_TAGS := [
	"[imp]",
	"[/imp]",
	"[warn]",
	"[/warn]",
	"[hint]",
	"[/hint]",
	"[red]",
	"[/red]",
	"[blue]",
	"[/blue]",
	"[sub]",
	"[/sub]"
]
const HIGHLIGHT_OPEN_REPLACEMENTS := {
	"[imp]": "[b][color=#ffd878]",
	"[red]": "[color=#ff5252]",
	"[blue]": "[color=#52a2ff]",
	"[sub]": "[font_size=18][color=#999999]",
	"[warn]": "[color=#ff8b8b]",
	"[hint]": "[color=#8bdcff]",
}
const HIGHLIGHT_CLOSE_REPLACEMENTS := {
	"[/imp]": "[/color][/b]",
	"[/red]": "[/color]",
	"[/blue]": "[/color]",
	"[/sub]": "[/color][/font_size]",
	"[/warn]": "[/color]",
	"[/hint]": "[/color]",
}

const UI_GOLD := Color("d8a538")
const UI_GOLD_LIGHT := Color("fff0c6")
const UI_BLACK := Color("050505")
const UI_PANEL_BLACK := Color(0.01, 0.011, 0.012, 0.90)
const UI_PURPLE := Color("27132f")
const UI_TEXT := Color("fff6df")
const UI_MUTED := Color("c8b995")


func _ready() -> void:
	if not GameManager:
		pass

	_portrait_rects = [
		portrait_left_rect,
		portrait_center_rect,
		portrait_right_rect,
	]
	portrait_layer.z_index = 5  # キャラが背景より前、CGより後ろ
	cg_rect.z_index = 10  # CG はキャラより前
	dialogue_panel.z_index = 20

	# Setup font and transparency
	# GameManager が root theme にフォントを設定済みのため override 不要
	# （override すると SystemFont fallback が失われてデバッグ実行で文字が消える）

	var panel_style = StyleBoxFlat.new()
	panel_style.bg_color = Color(0, 0, 0, 0.70)
	panel_style.corner_radius_top_left = 8
	panel_style.corner_radius_top_right = 8
	panel_style.corner_radius_bottom_right = 8
	panel_style.corner_radius_bottom_left = 8
	dialogue_panel.add_theme_stylebox_override("panel", panel_style)
	_apply_v2_dialogue_skin()

	if advance_button:
		advance_button.pressed.connect(_on_advance_button_pressed)
		advance_button.button_down.connect(_on_advance_button_down)
		advance_button.button_up.connect(_on_advance_button_up)
	if auto_button:
		auto_button.pressed.connect(_on_auto_button_pressed)
	if typing_timer:
		typing_timer.timeout.connect(_on_typing_timer_timeout)
	if auto_timer:
		auto_timer.timeout.connect(_on_auto_timer_timeout)
	if log_button:
		log_button.pressed.connect(_on_log_button_pressed)
	if close_history_button:
		close_history_button.pressed.connect(_on_close_history_pressed)
	_set_auto_enabled(false)

	_advance_hold_timer = Timer.new()
	_advance_hold_timer.one_shot = true
	_advance_hold_timer.wait_time = ADVANCE_HOLD_DELAY
	_advance_hold_timer.timeout.connect(_on_advance_hold_timeout)
	add_child(_advance_hold_timer)

	_advance_repeat_timer = Timer.new()
	_advance_repeat_timer.one_shot = false
	_advance_repeat_timer.wait_time = ADVANCE_REPEAT_INTERVAL
	_advance_repeat_timer.timeout.connect(_on_advance_repeat_timeout)
	add_child(_advance_repeat_timer)

	if cg_rect:
		cg_rect.visible = false
		cg_rect.modulate = Color(1, 1, 1, 0)

	# Default smoke off
	if smoke_particles:
		smoke_particles.emitting = false

	_sync_portrait_layer_bounds()
	_clear_portrait_rects()

	_load_dialogue_request_if_exists()
	if not _load_dialogue_data():
		text_label.text = "会話データを読み込めませんでした。"
		advance_button.text = "戻る"
		advance_button.disabled = false
		return
	_apply_background_from_metadata()
	_apply_effects_from_metadata()
	_update_v2_scene_info()
	_show_next_line()


func _apply_v2_dialogue_skin() -> void:
	# Runtime skin for the supplied black/gold dialogue mockup.  The nodes are
	# generated here so the existing dialogue scene stays data-compatible.
	var old_top_left = get_node_or_null("TopLeftUI")
	if old_top_left != null:
		old_top_left.visible = false
	var old_top_right = get_node_or_null("TopRightUI")
	if old_top_right != null:
		old_top_right.visible = false

	dialogue_panel.anchor_left = 0.07
	dialogue_panel.anchor_top = 0.665
	dialogue_panel.anchor_right = 0.935
	dialogue_panel.anchor_bottom = 0.965
	dialogue_panel.offset_left = 0.0
	dialogue_panel.offset_top = 0.0
	dialogue_panel.offset_right = 0.0
	dialogue_panel.offset_bottom = 0.0
	dialogue_panel.modulate = Color(1, 1, 1, 1)
	dialogue_panel.add_theme_stylebox_override(
		"panel", _make_v2_panel_style(UI_PANEL_BLACK, UI_GOLD, 2, 18, true)
	)
	dialogue_panel.z_index = 24
	dialogue_panel.mouse_filter = Control.MOUSE_FILTER_PASS
	if not dialogue_panel.gui_input.is_connected(_on_dialogue_panel_gui_input):
		dialogue_panel.gui_input.connect(_on_dialogue_panel_gui_input)

	var dialogue_margin = dialogue_panel.get_node_or_null("Margin")
	if dialogue_margin != null:
		dialogue_margin.add_theme_constant_override("margin_left", 62)
		dialogue_margin.add_theme_constant_override("margin_top", 54)
		dialogue_margin.add_theme_constant_override("margin_right", 330)
		dialogue_margin.add_theme_constant_override("margin_bottom", 24)

	var control_buttons = dialogue_panel.get_node_or_null("Margin/VBox/ControlButtons")
	if control_buttons != null:
		control_buttons.visible = false

	speaker_label.add_theme_font_size_override("font_size", 31)
	speaker_label.add_theme_color_override("font_color", UI_TEXT)
	speaker_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	text_label.add_theme_font_size_override("normal_font_size", 30)
	text_label.add_theme_color_override("default_color", UI_TEXT)
	text_label.add_theme_stylebox_override("normal", StyleBoxEmpty.new())
	text_label.custom_minimum_size = Vector2(0, 94)
	text_label.scroll_active = false

	_create_v2_top_location_panel()
	_create_v2_level_panel()
	_create_v2_name_plate()
	_create_v2_bottom_buttons()
	_style_v2_choice_container()


func _make_v2_panel_style(
	bg: Color, border: Color, border_width: int, radius: int, has_shadow: bool = false
) -> StyleBoxFlat:
	var style = StyleBoxFlat.new()
	style.bg_color = bg
	style.border_color = border
	style.border_width_left = border_width
	style.border_width_top = border_width
	style.border_width_right = border_width
	style.border_width_bottom = border_width
	style.corner_radius_top_left = radius
	style.corner_radius_top_right = radius
	style.corner_radius_bottom_left = radius
	style.corner_radius_bottom_right = radius
	style.content_margin_left = 18
	style.content_margin_right = 18
	style.content_margin_top = 12
	style.content_margin_bottom = 12
	if has_shadow:
		style.shadow_color = Color(0, 0, 0, 0.58)
		style.shadow_size = 10
		style.shadow_offset = Vector2(0, 6)
	return style


func _make_v2_button_style(bg: Color, border: Color, border_width: int = 2) -> StyleBoxFlat:
	var style = _make_v2_panel_style(bg, border, border_width, 12, true)
	style.content_margin_left = 10
	style.content_margin_right = 10
	style.content_margin_top = 8
	style.content_margin_bottom = 8
	return style


func _create_v2_top_location_panel() -> void:
	if get_node_or_null("V2LocationPanel") != null:
		return
	var panel = PanelContainer.new()
	panel.name = "V2LocationPanel"
	panel.anchor_left = 0.0
	panel.anchor_top = 0.02
	panel.anchor_right = 0.34
	panel.anchor_bottom = 0.135
	panel.offset_left = -8
	panel.offset_top = 0
	panel.offset_right = 0
	panel.offset_bottom = 0
	panel.z_index = 32
	panel.add_theme_stylebox_override(
		"panel", _make_v2_panel_style(Color(0, 0, 0, 0.84), UI_GOLD, 2, 18, true)
	)
	add_child(panel)

	var margin = MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 24)
	margin.add_theme_constant_override("margin_top", 10)
	margin.add_theme_constant_override("margin_right", 18)
	margin.add_theme_constant_override("margin_bottom", 10)
	panel.add_child(margin)

	var row = HBoxContainer.new()
	row.add_theme_constant_override("separation", 14)
	margin.add_child(row)

	var icon = Control.new()
	icon.custom_minimum_size = Vector2(56, 64)
	icon.set_script(DECO_ICON_SCRIPT)
	icon.set("icon_kind", "hookah")
	icon.set("icon_color", UI_GOLD)
	icon.set("glow_color", UI_GOLD_LIGHT)
	row.add_child(icon)

	var text_box = VBoxContainer.new()
	text_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	text_box.add_theme_constant_override("separation", 0)
	row.add_child(text_box)

	_v2_location_label = Label.new()
	_v2_location_label.text = "シーシャラウンジ『tonari』"
	_v2_location_label.add_theme_font_size_override("font_size", 21)
	_v2_location_label.add_theme_color_override("font_color", UI_TEXT)
	_v2_location_label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
	_v2_location_label.add_theme_constant_override("outline_size", 4)
	_v2_location_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	text_box.add_child(_v2_location_label)

	_v2_time_label = Label.new()
	_v2_time_label.text = "夜"
	_v2_time_label.add_theme_font_size_override("font_size", 26)
	_v2_time_label.add_theme_color_override("font_color", UI_GOLD_LIGHT)
	_v2_time_label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
	_v2_time_label.add_theme_constant_override("outline_size", 5)
	text_box.add_child(_v2_time_label)


func _create_v2_level_panel() -> void:
	if get_node_or_null("V2LevelPanel") != null:
		return
	var panel = PanelContainer.new()
	panel.name = "V2LevelPanel"
	panel.anchor_left = 0.73
	panel.anchor_top = 0.025
	panel.anchor_right = 1.0
	panel.anchor_bottom = 0.125
	panel.offset_left = 0
	panel.offset_top = 0
	panel.offset_right = 8
	panel.offset_bottom = 0
	panel.z_index = 32
	panel.add_theme_stylebox_override(
		"panel", _make_v2_panel_style(Color(0, 0, 0, 0.84), UI_GOLD, 2, 18, true)
	)
	add_child(panel)

	var margin = MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 22)
	margin.add_theme_constant_override("margin_top", 12)
	margin.add_theme_constant_override("margin_right", 24)
	margin.add_theme_constant_override("margin_bottom", 12)
	panel.add_child(margin)

	var row = HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	margin.add_child(row)

	var flame = Control.new()
	flame.custom_minimum_size = Vector2(44, 50)
	flame.set_script(DECO_ICON_SCRIPT)
	flame.set("icon_kind", "flame")
	flame.set("icon_color", Color("f1c96d"))
	flame.set("glow_color", Color("fff3dc"))
	row.add_child(flame)

	_v2_level_label = Label.new()
	_v2_level_label.text = "Lv.1"
	_v2_level_label.add_theme_font_size_override("font_size", 28)
	_v2_level_label.add_theme_color_override("font_color", UI_GOLD_LIGHT)
	_v2_level_label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
	_v2_level_label.add_theme_constant_override("outline_size", 5)
	row.add_child(_v2_level_label)

	var gauge = PanelContainer.new()
	gauge.custom_minimum_size = Vector2(142, 24)
	gauge.add_theme_stylebox_override(
		"panel", _make_v2_panel_style(Color(0, 0, 0, 0.25), UI_GOLD, 1, 12, false)
	)
	row.add_child(gauge)

	var gauge_host = Control.new()
	gauge_host.clip_contents = true
	gauge.add_child(gauge_host)

	_v2_level_fill = ColorRect.new()
	_v2_level_fill.anchor_left = 0.04
	_v2_level_fill.anchor_top = 0.22
	_v2_level_fill.anchor_right = 0.45
	_v2_level_fill.anchor_bottom = 0.78
	_v2_level_fill.color = Color("f5b45d")
	gauge_host.add_child(_v2_level_fill)


func _create_v2_name_plate() -> void:
	if _v2_name_plate != null:
		return
	_v2_name_plate = PanelContainer.new()
	_v2_name_plate.name = "V2NamePlate"
	_v2_name_plate.anchor_left = 0.135
	_v2_name_plate.anchor_top = 0.585
	_v2_name_plate.anchor_right = 0.455
	_v2_name_plate.anchor_bottom = 0.665
	_v2_name_plate.z_index = 34
	_v2_name_plate.visible = false
	_v2_name_plate.add_theme_stylebox_override(
		"panel", _make_v2_panel_style(Color(UI_PURPLE, 0.92), UI_GOLD, 2, 12, true)
	)
	add_child(_v2_name_plate)

	var name_margin = MarginContainer.new()
	name_margin.add_theme_constant_override("margin_left", 24)
	name_margin.add_theme_constant_override("margin_top", 6)
	name_margin.add_theme_constant_override("margin_right", 24)
	name_margin.add_theme_constant_override("margin_bottom", 6)
	_v2_name_plate.add_child(name_margin)

	if speaker_label.get_parent() != null:
		speaker_label.get_parent().remove_child(speaker_label)
	name_margin.add_child(speaker_label)
	speaker_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	speaker_label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	speaker_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER


func _create_v2_bottom_buttons() -> void:
	if _v2_bottom_bar != null:
		return
	_v2_bottom_bar = HBoxContainer.new()
	_v2_bottom_bar.name = "V2ControlButtons"
	_v2_bottom_bar.anchor_left = 0.705
	_v2_bottom_bar.anchor_top = 0.805
	_v2_bottom_bar.anchor_right = 0.985
	_v2_bottom_bar.anchor_bottom = 0.985
	_v2_bottom_bar.z_index = 40
	_v2_bottom_bar.alignment = BoxContainer.ALIGNMENT_END
	_v2_bottom_bar.add_theme_constant_override("separation", 12)
	add_child(_v2_bottom_bar)

	_prepare_v2_button(auto_button, "AUTO")
	_reparent_to_v2_bottom_bar(auto_button)

	advance_button.set_meta("v2_skip_button", true)
	_prepare_v2_button(advance_button, "SKIP")
	_reparent_to_v2_bottom_bar(advance_button)

	_prepare_v2_button(log_button, "LOG")
	_reparent_to_v2_bottom_bar(log_button)

	_v2_menu_button = Button.new()
	_v2_menu_button.name = "V2MenuButton"
	_v2_menu_button.text = "MENU"
	_prepare_v2_button(_v2_menu_button, "MENU")
	_v2_menu_button.pressed.connect(_on_menu_button_pressed)
	_v2_bottom_bar.add_child(_v2_menu_button)


func _prepare_v2_button(button: Button, label_text: String) -> void:
	if button == null:
		return
	button.custom_minimum_size = Vector2(84, 82)
	button.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	button.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	button.text = label_text
	button.clip_text = true
	button.focus_mode = Control.FOCUS_NONE
	button.add_theme_font_size_override("font_size", 18)
	button.add_theme_color_override("font_color", UI_GOLD_LIGHT)
	button.add_theme_color_override("font_hover_color", Color("ffffff"))
	button.add_theme_color_override("font_pressed_color", UI_GOLD_LIGHT)
	button.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
	button.add_theme_constant_override("outline_size", 4)
	button.add_theme_stylebox_override(
		"normal", _make_v2_button_style(Color(0, 0, 0, 0.86), UI_GOLD, 2)
	)
	button.add_theme_stylebox_override(
		"hover", _make_v2_button_style(Color("17110b", 0.92), UI_GOLD_LIGHT, 2)
	)
	button.add_theme_stylebox_override(
		"pressed", _make_v2_button_style(Color("2a1605", 0.94), UI_GOLD, 3)
	)
	button.add_theme_stylebox_override(
		"disabled", _make_v2_button_style(Color(0, 0, 0, 0.45), Color(UI_GOLD, 0.45), 1)
	)


func _reparent_to_v2_bottom_bar(button: Button) -> void:
	if button == null:
		return
	var parent = button.get_parent()
	if parent == _v2_bottom_bar:
		return
	if parent != null:
		parent.remove_child(button)
	_v2_bottom_bar.add_child(button)


func _style_v2_choice_container() -> void:
	choice_container.anchor_left = 0.28
	choice_container.anchor_top = 0.36
	choice_container.anchor_right = 0.72
	choice_container.anchor_bottom = 0.66
	choice_container.offset_left = 0.0
	choice_container.offset_top = 0.0
	choice_container.offset_right = 0.0
	choice_container.offset_bottom = 0.0
	choice_container.z_index = 50


func _update_v2_scene_info() -> void:
	if _v2_location_label == null:
		return
	_v2_location_label.text = _get_v2_location_label()
	_v2_time_label.text = _get_v2_time_label()
	var level = _get_v2_player_level()
	_v2_level_label.text = "Lv.%d" % level
	if _v2_level_fill != null:
		_v2_level_fill.anchor_right = clampf(float(level) / 10.0, 0.08, 1.0)


func _get_v2_location_label() -> String:
	var bg_path = str(_metadata.get("bg", ""))
	if bg_path.find("naru") != -1 or bg_path.find("kemurikusa") != -1:
		return "シーシャバー『煙草』"
	if bg_path.find("adam") != -1 or bg_path.find("eden") != -1:
		return "シーシャバー『Eden』"
	if bg_path.find("minto") != -1 or bg_path.find("pepermint") != -1:
		return "コンカフェ『ぺぱーみんと』"
	if bg_path.find("shop") != -1 or bg_path.find("hookah") != -1:
		return "Dr.Hookah"
	if dialogue_file.find("tournament") != -1:
		return "C.STATION 特設会場"
	return "シーシャラウンジ『tonari』"


func _get_v2_time_label() -> String:
	match CalendarManager.current_time:
		"morning":
			return "朝"
		"noon":
			return "昼"
		"night":
			return "夜"
		"midnight":
			return "深夜"
		_:
			return "夜"


func _get_v2_player_level() -> int:
	var total = 0
	for stat_name in ["technique", "sense", "guts", "charm", "insight"]:
		total += PlayerData.get_stat_value(stat_name)
	var average = float(total) / 5.0
	return clampi(int(floor(average / 10.0)), 1, 10)


func _update_v2_name_plate() -> void:
	if _v2_name_plate == null:
		return
	var has_name = speaker_label.text.strip_edges() != ""
	_v2_name_plate.visible = has_name
	speaker_label.visible = has_name


func _on_dialogue_panel_gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var mouse_event := event as InputEventMouseButton
		if mouse_event.button_index == MOUSE_BUTTON_LEFT and mouse_event.pressed:
			_on_advance_button_pressed()
			get_viewport().set_input_as_handled()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_accept"):
		_on_advance_button_pressed()
		get_viewport().set_input_as_handled()


func _on_menu_button_pressed() -> void:
	GameManager.play_ui_se("confirm")
	if get_tree().root.has_node("SystemMenu"):
		return
	var menu = SYSTEM_MENU_SCENE.instantiate()
	get_tree().root.add_child(menu)


func _notification(what: int) -> void:
	if what == NOTIFICATION_RESIZED:
		_sync_portrait_layer_bounds()
		_refresh_portrait_display("")


func _sync_portrait_layer_bounds() -> void:
	if portrait_layer == null or dialogue_panel == null:
		return
	portrait_layer.anchor_left = 0.0
	portrait_layer.anchor_top = 0.0
	portrait_layer.anchor_right = 1.0
	portrait_layer.anchor_bottom = dialogue_panel.anchor_top
	portrait_layer.offset_left = 0.0
	portrait_layer.offset_top = 0.0
	portrait_layer.offset_right = 0.0
	portrait_layer.offset_bottom = dialogue_panel.offset_top - 2.0


func _load_dialogue_request_if_exists() -> void:
	var queued = GameManager.pop_queued_dialogue()
	if queued.is_empty():
		return
	dialogue_file = str(queued.get("file", dialogue_file))
	dialogue_id = str(queued.get("id", dialogue_id))
	next_scene_path = str(queued.get("next_scene", next_scene_path))
	_metadata = queued.get("metadata", {})


func _apply_effects_from_metadata() -> void:
	if not smoke_particles:
		return
	if _metadata.get("effect", "") == "smoke":
		smoke_particles.emitting = true
	else:
		smoke_particles.emitting = false


func _apply_background_from_metadata() -> void:
	background_image.texture = null
	var path = str(_metadata.get("bg", ""))
	if path == "":
		path = _resolve_default_dialogue_background()
	if path == "":
		return
	if not ResourceLoader.exists(path):
		return
	var tex = load(path)
	if tex == null:
		return
	background_image.texture = tex
	background_image.modulate = Color(1.35, 1.35, 1.35, 1.0)
	background_image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	background_image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE


func _resolve_default_dialogue_background() -> String:
	if dialogue_file.find("ch1_tournament") != -1:
		return "res://assets/backgrounds/bg_tournament_stage.png"
	if dialogue_file.find("ch1_") != -1 or dialogue_file.find("dialogue") != -1:
		return "res://assets/backgrounds/bg_tonari_inside.png"
	return ""


func _load_dialogue_data() -> bool:
	if dialogue_id == "":
		return false
	if not FileAccess.file_exists(dialogue_file):
		return false

	var file = FileAccess.open(dialogue_file, FileAccess.READ)
	if file == null:
		return false

	var parsed = JSON.parse_string(file.get_as_text())
	file.close()
	if typeof(parsed) != TYPE_DICTIONARY:
		return false

	_loaded_dialogue_root = parsed
	var target_dialogue = _find_dialogue(parsed, dialogue_id)
	if target_dialogue.is_empty():
		return false

	var request_metadata = _metadata.duplicate(true)
	_metadata = {}
	_activate_dialogue(target_dialogue, false)
	_merge_dialogue_metadata(request_metadata)
	return true


var _loaded_dialogue_root: Variant = null


func _activate_dialogue(target_dialogue: Dictionary, refresh_visuals: bool = true) -> void:
	_line_queue.clear()
	_line_queue.assign(target_dialogue.get("lines", []).duplicate(true))
	_branches = target_dialogue.get("branches", {}).duplicate(true)

	var metadata = target_dialogue.get("metadata", {})
	_merge_dialogue_metadata(metadata)
	if typeof(metadata) == TYPE_DICTIONARY and metadata.has("bgm"):
		GameManager.play_bgm(str(metadata["bgm"]), -8.0, true)

	if refresh_visuals:
		_apply_background_from_metadata()
		_apply_effects_from_metadata()
		_update_v2_scene_info()


func _merge_dialogue_metadata(metadata: Variant) -> void:
	if typeof(metadata) != TYPE_DICTIONARY:
		return
	for key in metadata.keys():
		if key == "add_affinity" and typeof(metadata[key]) == TYPE_DICTIONARY:
			var merged = _metadata.get("add_affinity", {}).duplicate(true)
			for char_id in metadata[key].keys():
				merged[char_id] = int(merged.get(char_id, 0)) + int(metadata[key][char_id])
			_metadata[key] = merged
		elif key == "set_flags" and typeof(metadata[key]) == TYPE_ARRAY:
			var merged_flags: Array = _metadata.get("set_flags", []).duplicate(true)
			for flag in metadata[key]:
				merged_flags.append(flag)
			_metadata[key] = merged_flags
		else:
			_metadata[key] = metadata[key]


func _find_dialogue(root: Dictionary, target_id: String) -> Dictionary:
	if root.has("dialogues"):
		for item in root["dialogues"]:
			if str(item.get("dialogue_id", "")) == target_id:
				return item
	if str(root.get("dialogue_id", "")) == target_id:
		return root
	return {}


func _on_advance_button_down() -> void:
	_ignore_advance_press_once = false
	if _advance_hold_timer != null:
		_advance_hold_timer.start()


func _on_advance_button_up() -> void:
	if _advance_hold_timer != null and not _advance_hold_timer.is_stopped():
		_advance_hold_timer.stop()
	if _advance_hold_active:
		_ignore_advance_press_once = true
	_stop_fast_advance()


func _on_advance_hold_timeout() -> void:
	if advance_button == null or advance_button.disabled:
		return
	_advance_hold_active = true
	_refresh_advance_button_label()
	_fast_advance_step()
	if _advance_repeat_timer != null and _advance_repeat_timer.is_stopped():
		_advance_repeat_timer.start()


func _on_advance_repeat_timeout() -> void:
	if not _advance_hold_active:
		return
	_fast_advance_step()


func _fast_advance_step() -> void:
	if _dialogue_ending or choice_container.get_child_count() > 0:
		_stop_fast_advance()
		return
	if _is_typing:
		_show_full_text_immediately()
		return
	_cancel_auto_advance()
	if _line_queue.is_empty():
		_stop_fast_advance()
		return
	_show_next_line()


func _stop_fast_advance() -> void:
	_advance_hold_active = false
	if _advance_hold_timer != null and not _advance_hold_timer.is_stopped():
		_advance_hold_timer.stop()
	if _advance_repeat_timer != null and not _advance_repeat_timer.is_stopped():
		_advance_repeat_timer.stop()
	_refresh_advance_button_label()


func _refresh_advance_button_label() -> void:
	if advance_button == null:
		return
	if bool(advance_button.get_meta("v2_skip_button", false)):
		advance_button.text = "SKIP"
		return
	if _dialogue_ending:
		advance_button.text = "終了"
		return
	if _advance_hold_active:
		advance_button.text = "早送り中"
		return
	if choice_container != null and choice_container.get_child_count() > 0:
		advance_button.text = "選択"
		return
	if _is_typing:
		advance_button.text = "早送り"
		return
	advance_button.text = "次へ"


func _on_advance_button_pressed() -> void:
	if _dialogue_ending:
		return
	if _ignore_advance_press_once:
		_ignore_advance_press_once = false
		return
	GameManager.play_ui_se("cursor")
	if _is_typing:
		_show_full_text_immediately()
		return
	if choice_container.get_child_count() > 0:
		return
	_cancel_auto_advance()
	_show_next_line()


func _show_next_line() -> void:
	_cancel_auto_advance()
	if _line_queue.is_empty():
		_finish_dialogue()
		return

	var line: Dictionary = _line_queue.pop_front()

	# Condition check
	if str(line.get("type", "")) == "condition":
		var cond_type = str(line.get("condition_type", "stat"))
		var threshold = int(line.get("threshold", 0))
		var val = 0
		if cond_type == "stat":
			var stat = str(line.get("stat", ""))
			if stat != "":
				val = PlayerData.get_stat_value(stat)
		elif cond_type == "romance_count":
			val = AffinityManager.get_romance_count()
		elif cond_type == "has_romance":
			var char_id = str(line.get("char_id", ""))
			val = 1 if AffinityManager.is_in_romance(char_id) else 0
			threshold = 1
		elif cond_type == "has_romance_and_max_affection":
			var char_id = str(line.get("char_id", ""))
			val = (
				1
				if (
					AffinityManager.is_in_romance(char_id)
					and AffinityManager.is_max_affection(char_id)
				)
				else 0
			)
			threshold = 1

		var branch_key = ""
		if val >= threshold:
			branch_key = str(line.get("next_true", ""))
		else:
			branch_key = str(line.get("next_false", ""))

		if branch_key != "" and _branches.has(branch_key):
			var branch_lines: Array = _branches[branch_key]
			for i in range(branch_lines.size() - 1, -1, -1):
				_line_queue.push_front(branch_lines[i])

		# Immediately show next line after branching
		_show_next_line()
		return
	elif str(line.get("type", "")) == "jump":
		var next_id = str(line.get("next_id", ""))
		if typeof(_loaded_dialogue_root) == TYPE_DICTIONARY:
			var target_dialogue = _find_dialogue(_loaded_dialogue_root, next_id)
			if not target_dialogue.is_empty():
				_activate_dialogue(target_dialogue)
				_show_next_line()
				return

	elif str(line.get("type", "")) == "set_flag":
		var flag = str(line.get("flag", ""))
		if flag != "":
			EventFlags.set_flag(flag)

		# Immediately show next line after setting flag
		_show_next_line()
		return

	if str(line.get("type", "")) == "choice":
		_show_choices(line.get("choices", []))
		return

	_clear_choices()

	await _handle_cg_command(line)

	_current_speaker = str(line.get("speaker", ""))
	if (
		_current_speaker in ["naru", "adam", "minto", "tsumugi", "ageha", "pakki"]
		and not EventFlags.get_flag("known_name_" + _current_speaker)
	):
		speaker_label.text = "？？？"
	else:
		speaker_label.text = SPEAKER_NAMES.get(_current_speaker, _current_speaker)

	# キャラ別テーマカラーを名前ラベルに反映
	var resolved_id = str(SPEAKER_ID_ALIASES.get(_current_speaker, _current_speaker))
	var speaker_color = (
		UI_TEXT
		if _current_speaker == ""
		else GameManager.get_speaker_accent_color(resolved_id).lightened(0.35)
	)
	speaker_label.add_theme_color_override("font_color", speaker_color)
	_update_v2_name_plate()

	_update_portrait(line)

	var raw_text = str(line.get("text", ""))
	var processed_text = _process_text(raw_text)
	var pages = _paginate_dialogue_text(processed_text)
	var display_text = pages[0] if not pages.is_empty() else ""
	if pages.size() > 1:
		var continuation_base = line.duplicate(true)
		continuation_base["skip_history"] = true
		for i in range(pages.size() - 1, 0, -1):
			var continuation_line = continuation_base.duplicate(true)
			continuation_line["text"] = pages[i]
			_line_queue.push_front(continuation_line)

	if raw_text != "" and not bool(line.get("skip_history", false)):
		var history_text = display_text if pages.size() <= 1 else "\n".join(pages)
		_history.append({"speaker": _current_speaker, "text": _strip_highlight_tags(history_text)})

	_start_typing(display_text)


func _process_text(text: String) -> String:
	if "{attendees}" in text:
		var attendees = []
		for char_id in ["naru", "adam", "minto", "tsumugi", "ageha"]:
			if AffinityManager.is_max_level(char_id):
				attendees.append(SPEAKER_NAMES.get(char_id, char_id))

		var attendees_str = ""
		if attendees.size() > 0:
			attendees_str = "、".join(attendees) + "……。\n今まで戦ってきた仲間たちと一緒に"
		else:
			attendees_str = "今まで戦ってきた日々を思い出しながら"

		text = text.replace("{attendees}", attendees_str)
	return text


func _paginate_dialogue_text(text: String) -> Array[String]:
	if text == "":
		return [""]
	var wrapped_text = _wrap_dialogue_text(text)
	var lines = wrapped_text.split("\n", true)
	if lines.size() <= DIALOGUE_MAX_LINES:
		return [wrapped_text]
	var pages: Array[String] = []
	var current_lines: Array[String] = []
	for line in lines:
		current_lines.append(line)
		if current_lines.size() == DIALOGUE_MAX_LINES:
			pages.append("\n".join(current_lines))
			current_lines.clear()
	if not current_lines.is_empty():
		pages.append("\n".join(current_lines))
	return pages


func _wrap_dialogue_text(text: String) -> String:
	var plain_text = _strip_highlight_tags(text)
	var wrapped_plain_text = GameManager.format_story_text(plain_text, DIALOGUE_WRAP_CHARS)
	if wrapped_plain_text == plain_text:
		return text
	return _apply_wrap_to_tagged_text(text, wrapped_plain_text)


func _apply_wrap_to_tagged_text(source_text: String, wrapped_plain_text: String) -> String:
	var line_lengths: Array[int] = []
	for line in wrapped_plain_text.split("\n", true):
		line_lengths.append(line.length())
	if line_lengths.size() <= 1:
		return source_text

	var output = ""
	var source_index = 0
	var visible_count = 0
	var line_index = 0
	while source_index < source_text.length():
		while line_index < line_lengths.size() - 1 and visible_count >= line_lengths[line_index]:
			output += "\n"
			line_index += 1
			visible_count = 0
		if source_text.substr(source_index, 1) == "[":
			var close_index = source_text.find("]", source_index)
			if close_index != -1:
				output += source_text.substr(source_index, close_index - source_index + 1)
				source_index = close_index + 1
				continue
		var current_char = source_text.substr(source_index, 1)
		output += current_char
		source_index += 1
		if current_char == "\n":
			line_index += 1
			visible_count = 0
		else:
			visible_count += 1
	return output


func _start_typing(text: String) -> void:
	_full_text = _strip_highlight_tags(text)
	_full_text_bbcode = _build_highlighted_text(text)
	_current_char = 0
	text_label.text = _full_text_bbcode
	text_label.visible_characters = 0
	_is_typing = true
	advance_button.disabled = false
	_refresh_advance_button_label()
	if _full_text.is_empty():
		_show_full_text_immediately()
		return

	var cps = float(30.0)
	if FileAccess.file_exists("user://settings.cfg"):
		var cfg = ConfigFile.new()
		if cfg.load("user://settings.cfg") == OK:
			cps = float(cfg.get_value("text", "speed", 30.0))
	cps = clampf(cps, 10.0, 120.0)
	typing_timer.wait_time = 1.0 / cps
	typing_timer.start()


func _on_typing_timer_timeout() -> void:
	if not _is_typing:
		return
	_current_char += 1
	if _current_char >= _full_text.length():
		_show_full_text_immediately()
		return
	text_label.visible_characters = _current_char


func _show_full_text_immediately() -> void:
	_is_typing = false
	typing_timer.stop()
	text_label.text = _full_text_bbcode
	text_label.visible_characters = -1
	_refresh_advance_button_label()
	_queue_auto_advance()


func _show_choices(choices: Array) -> void:
	_stop_fast_advance()
	_clear_choices()
	_cancel_auto_advance()
	advance_button.disabled = true
	_refresh_advance_button_label()

	for choice in choices:
		var c_type = str(choice.get("condition_type", ""))
		if c_type == "has_romance":
			if not AffinityManager.is_in_romance(str(choice.get("char_id", ""))):
				continue

		var button = Button.new()
		button.text = str(choice.get("text", "選択肢"))
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.custom_minimum_size = Vector2(0, 52)
		button.add_theme_font_size_override("font_size", 24)
		button.add_theme_color_override("font_color", UI_TEXT)
		button.add_theme_color_override("font_hover_color", UI_GOLD_LIGHT)
		button.add_theme_stylebox_override(
			"normal", _make_v2_panel_style(Color(0, 0, 0, 0.90), UI_GOLD, 2, 14, true)
		)
		button.add_theme_stylebox_override(
			"hover", _make_v2_panel_style(Color("150f08", 0.94), UI_GOLD_LIGHT, 2, 14, true)
		)
		button.add_theme_stylebox_override(
			"pressed", _make_v2_panel_style(Color("281505", 0.96), UI_GOLD, 3, 14, true)
		)
		button.pressed.connect(
			_on_choice_selected.bind(str(choice.get("next", "")), str(choice.get("next_id", "")))
		)
		choice_container.add_child(button)


func _on_choice_selected(branch_key: String, next_id: String = "") -> void:
	GameManager.play_ui_se("confirm")
	_clear_choices()
	advance_button.disabled = false
	_refresh_advance_button_label()
	if _branches.has(branch_key):
		var branch_lines: Array = _branches[branch_key]
		for i in range(branch_lines.size() - 1, -1, -1):
			_line_queue.push_front(branch_lines[i])
	elif next_id != "" and typeof(_loaded_dialogue_root) == TYPE_DICTIONARY:
		var target_dialogue = _find_dialogue(_loaded_dialogue_root, next_id)
		if not target_dialogue.is_empty():
			_activate_dialogue(target_dialogue)
	_show_next_line()


func _clear_choices() -> void:
	for child in choice_container.get_children():
		child.queue_free()


func _on_auto_button_pressed() -> void:
	GameManager.play_ui_se("cursor")
	_set_auto_enabled(not _auto_enabled)
	if _auto_enabled:
		_queue_auto_advance()
	else:
		_cancel_auto_advance()


func _on_auto_timer_timeout() -> void:
	if not _auto_enabled:
		return
	if _is_typing:
		return
	if choice_container.get_child_count() > 0:
		return
	_show_next_line()


func _set_auto_enabled(enabled: bool) -> void:
	_auto_enabled = enabled
	if auto_button == null:
		return
	auto_button.text = "AUTO\nON" if _auto_enabled else "AUTO"


func _on_log_button_pressed() -> void:
	GameManager.play_ui_se("select")
	_stop_fast_advance()
	_cancel_auto_advance()
	for child in history_vbox.get_children():
		child.queue_free()

	for entry in _history:
		var name_label = Label.new()
		var resolved_id = str(SPEAKER_ID_ALIASES.get(entry["speaker"], entry["speaker"]))
		name_label.text = (
			SPEAKER_NAMES.get(entry["speaker"], entry["speaker"])
			if str(entry["speaker"]) != ""
			else ""
		)
		if name_label.text == "":
			name_label.text = "――"
		name_label.add_theme_color_override(
			"font_color", GameManager.get_speaker_color(resolved_id)
		)
		name_label.add_theme_font_size_override("font_size", 20)

		var txt_label = Label.new()
		txt_label.text = entry["text"]
		txt_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		txt_label.add_theme_font_size_override("font_size", 20)

		var entry_box = VBoxContainer.new()
		entry_box.add_theme_constant_override("separation", 2)
		entry_box.add_child(name_label)
		entry_box.add_child(txt_label)
		history_vbox.add_child(entry_box)

	history_panel.visible = true


func _on_close_history_pressed() -> void:
	GameManager.play_ui_se("cancel")
	history_panel.visible = false


func _queue_auto_advance() -> void:
	if not _auto_enabled:
		return
	if _is_typing:
		return
	if choice_container.get_child_count() > 0:
		return
	if _line_queue.is_empty():
		return
	var wait_time = clampf(0.9 + float(_full_text.length()) * 0.035, 1.0, 3.2)
	auto_timer.wait_time = wait_time
	auto_timer.start()


func _cancel_auto_advance() -> void:
	if auto_timer == null:
		return
	if auto_timer.is_stopped():
		return
	auto_timer.stop()


func _strip_highlight_tags(text: String) -> String:
	var output = text
	for tag in HIGHLIGHT_TAGS:
		output = output.replace(tag, "")
	return output


func _build_highlighted_text(text: String) -> String:
	var output = text
	var placeholders: Dictionary = {}
	var token_index = 0
	for open_tag in HIGHLIGHT_OPEN_REPLACEMENTS.keys():
		var open_token = "__HIGHLIGHT_OPEN_%d__" % token_index
		token_index += 1
		placeholders[open_token] = str(HIGHLIGHT_OPEN_REPLACEMENTS[open_tag])
		output = output.replace(open_tag, open_token)
	for close_tag in HIGHLIGHT_CLOSE_REPLACEMENTS.keys():
		var close_token = "__HIGHLIGHT_CLOSE_%d__" % token_index
		token_index += 1
		placeholders[close_token] = str(HIGHLIGHT_CLOSE_REPLACEMENTS[close_tag])
		output = output.replace(close_tag, close_token)
	output = output.replace("[", "[lb]")
	output = output.replace("]", "[rb]")
	for token in placeholders.keys():
		output = output.replace(str(token), str(placeholders[token]))
	return output


func _update_portrait(line: Dictionary) -> void:
	var speaker = _resolve_speaker_id(str(line.get("speaker", "")))
	var active_speaker := ""
	if speaker == "":
		if (
			bool(line.get("clear_portraits", false))
			or _should_clear_portraits_for_text(str(line.get("text", "")))
		):
			_portrait_cast.clear()
	else:
		var face = str(line.get("face", "normal"))
		if _should_show_portrait(speaker, line):
			_upsert_portrait_cast(speaker, face)
			active_speaker = speaker
	_refresh_portrait_display(active_speaker)


func _resolve_speaker_id(speaker: String) -> String:
	return str(SPEAKER_ID_ALIASES.get(speaker, speaker))


func _should_show_portrait(speaker: String, line: Dictionary) -> bool:
	if speaker == "" or speaker == "everyone":
		return false
	if bool(line.get("hide_portrait", false)):
		return false
	if bool(line.get("show_portrait", false)):
		return true
	return not PORTRAIT_HIDE_BY_DEFAULT.has(speaker)


func _should_clear_portraits_for_text(text: String) -> bool:
	var trimmed = text.strip_edges()
	return trimmed.begins_with("────") or trimmed.begins_with("──")


func _upsert_portrait_cast(speaker: String, face: String) -> void:
	var entry := {
		"speaker": speaker,
		"face": face,
	}
	for i in range(_portrait_cast.size() - 1, -1, -1):
		if str(_portrait_cast[i].get("speaker", "")) == speaker:
			_portrait_cast.remove_at(i)
			break
	_portrait_cast.append(entry)
	while _portrait_cast.size() > MAX_VISIBLE_PORTRAITS:
		_portrait_cast.remove_at(0)


func _build_portrait_entries(active_speaker: String) -> Array[Dictionary]:
	if _portrait_cast.is_empty():
		return []

	var entries: Array[Dictionary] = []
	for item in _portrait_cast:
		entries.append(item.duplicate(true))

	if entries.size() == 3 and active_speaker != "":
		var active_index := -1
		for i in range(entries.size()):
			if str(entries[i].get("speaker", "")) == active_speaker:
				active_index = i
				break
		if active_index >= 0:
			var active_entry = entries[active_index]
			entries.remove_at(active_index)
			entries = [entries[0], active_entry, entries[1]]

	return entries


func _refresh_portrait_display(active_speaker: String) -> void:
	if _portrait_rects.is_empty():
		return
	var entries = _build_portrait_entries(active_speaker)
	if entries.is_empty():
		_clear_portrait_rects()
		return

	var slot_layout: Array = PORTRAIT_SLOT_LAYOUTS.get(entries.size(), PORTRAIT_SLOT_LAYOUTS[1])
	for i in range(_portrait_rects.size()):
		var rect = _portrait_rects[i]
		if i >= entries.size():
			rect.visible = false
			rect.texture = null
			continue
		var entry: Dictionary = entries[i]
		var speaker = str(entry.get("speaker", ""))
		var face = str(entry.get("face", "normal"))
		var path = _find_portrait_path(speaker, face)
		if path == "":
			rect.visible = false
			rect.texture = null
			continue
		var texture = _get_portrait_texture(speaker, path)
		if texture == null:
			rect.visible = false
			rect.texture = null
			continue
		rect.texture = texture
		rect.visible = true
		var slot: Dictionary = slot_layout[i]
		var is_active = speaker == active_speaker
		_apply_portrait_slot(rect, speaker, slot, is_active)


func _apply_portrait_slot(
	rect: TextureRect, speaker: String, slot: Dictionary, is_active: bool
) -> void:
	var viewport_size = portrait_layer.size
	if viewport_size.x <= 0.0 or viewport_size.y <= 0.0:
		viewport_size = size
	if viewport_size.x <= 0.0 or viewport_size.y <= 0.0:
		viewport_size = get_viewport_rect().size
	if viewport_size.x <= 0.0 or viewport_size.y <= 0.0:
		return

	var profile = _get_portrait_profile(speaker)
	var scale_key = "focus_scale" if is_active else "support_scale"
	var scale_ratio = float(profile.get(scale_key, PORTRAIT_PROFILE_DEFAULT[scale_key]))
	var width = viewport_size.x * float(slot.get("width_ratio", 0.42)) * scale_ratio
	var height = viewport_size.y * float(slot.get("height_ratio", 0.90)) * scale_ratio
	var center_x = (
		viewport_size.x * float(slot.get("anchor_x", 0.5))
		+ viewport_size.x * float(profile.get("x_shift_ratio", 0.0))
	)
	var bottom = (
		viewport_size.y * (1.0 + float(slot.get("bottom_overscan_ratio", 0.04)))
		+ viewport_size.y * float(profile.get("y_shift_ratio", 0.0))
	)
	rect.offset_left = center_x - (width * 0.5)
	rect.offset_top = bottom - height
	rect.offset_right = center_x + (width * 0.5)
	rect.offset_bottom = bottom
	var brightness = float(slot.get("brightness", 1.0))
	var alpha = float(slot.get("alpha", 1.0))
	rect.modulate = Color(brightness, brightness, brightness, alpha)
	rect.z_index = int(slot.get("z", 0))


func _clear_portrait_rects() -> void:
	for rect in _portrait_rects:
		rect.visible = false
		rect.texture = null


func _find_portrait_path(speaker: String, face: String) -> String:
	var path = "res://assets/sprites/characters/%s/chr_%s_%s.png" % [speaker, speaker, face]
	if not ResourceLoader.exists(path):
		path = "res://assets/sprites/characters/%s/chr_%s_normal.png" % [speaker, speaker]
	if not ResourceLoader.exists(path):
		return ""
	return path


func _get_portrait_profile(speaker: String) -> Dictionary:
	var profile: Dictionary = PORTRAIT_PROFILE_DEFAULT.duplicate(true)
	var speaker_class = str(PORTRAIT_CLASS_BY_SPEAKER.get(speaker, ""))
	if speaker_class != "" and PORTRAIT_PROFILE_BY_CLASS.has(speaker_class):
		var class_profile: Dictionary = PORTRAIT_PROFILE_BY_CLASS[speaker_class]
		for key in class_profile.keys():
			profile[key] = class_profile[key]
	return profile


func _get_portrait_union_rect(speaker: String) -> Rect2i:
	if _portrait_union_rect_cache.has(speaker):
		return _portrait_union_rect_cache[speaker]

	var union := Rect2i()
	var found := false
	for face in PORTRAIT_FACE_CANDIDATES:
		var candidate_path = (
			"res://assets/sprites/characters/%s/chr_%s_%s.png" % [speaker, speaker, face]
		)
		if not ResourceLoader.exists(candidate_path):
			continue
		var candidate = load(candidate_path)
		if candidate == null or not candidate is Texture2D:
			continue
		var candidate_image: Image = candidate.get_image()
		if candidate_image == null or candidate_image.is_empty():
			continue
		var used_rect := candidate_image.get_used_rect()
		if used_rect.size.x <= 0 or used_rect.size.y <= 0:
			continue
		if not found:
			union = used_rect
			found = true
		else:
			union = union.merge(used_rect)

	_portrait_union_rect_cache[speaker] = union
	return union


func _get_portrait_texture(speaker: String, path: String) -> Texture2D:
	var cache_key = "%s::%s" % [speaker, path]
	if _portrait_texture_cache.has(cache_key):
		return _portrait_texture_cache[cache_key]

	var source = load(path)
	if source == null or not source is Texture2D:
		return null

	var texture: Texture2D = source
	var image: Image = texture.get_image()
	if image == null or image.is_empty():
		_portrait_texture_cache[cache_key] = texture
		return texture

	var used_rect := _get_portrait_union_rect(speaker)
	if used_rect.size.x <= 0 or used_rect.size.y <= 0:
		used_rect = image.get_used_rect()
	if used_rect.size.x <= 0 or used_rect.size.y <= 0:
		_portrait_texture_cache[cache_key] = texture
		return texture

	var profile = _get_portrait_profile(speaker)
	var side_padding = int(profile.get("side_padding", PORTRAIT_PROFILE_DEFAULT["side_padding"]))
	var top_padding = int(profile.get("top_padding", PORTRAIT_PROFILE_DEFAULT["top_padding"]))
	var bottom_padding = int(
		profile.get("bottom_padding", PORTRAIT_PROFILE_DEFAULT["bottom_padding"])
	)
	var bottom_trim_ratio = float(
		profile.get("bottom_trim_ratio", PORTRAIT_PROFILE_DEFAULT["bottom_trim_ratio"])
	)
	var bottom_trim_max = int(
		profile.get("bottom_trim_max", PORTRAIT_PROFILE_DEFAULT["bottom_trim_max"])
	)
	var min_visible_ratio = float(
		profile.get("min_visible_ratio", PORTRAIT_PROFILE_DEFAULT["min_visible_ratio"])
	)

	var crop_left: int = maxi(used_rect.position.x - side_padding, 0)
	var crop_top: int = maxi(used_rect.position.y - top_padding, 0)
	var crop_right: int = mini(used_rect.end.x + side_padding, image.get_width())
	var bottom_trim = mini(int(float(used_rect.size.y) * bottom_trim_ratio), bottom_trim_max)
	var min_visible_height = int(float(used_rect.size.y) * min_visible_ratio)
	var trimmed_bottom = used_rect.end.y - bottom_trim
	var visible_bottom = maxi(trimmed_bottom, used_rect.position.y + min_visible_height)
	var crop_bottom: int = mini(visible_bottom + bottom_padding, image.get_height())
	var crop_rect := Rect2i(crop_left, crop_top, crop_right - crop_left, crop_bottom - crop_top)
	if crop_rect.position == Vector2i.ZERO and crop_rect.size == image.get_size():
		_portrait_texture_cache[cache_key] = texture
		return texture

	var cropped_image: Image = image.get_region(crop_rect)
	var cropped_texture := ImageTexture.create_from_image(cropped_image)
	_portrait_texture_cache[cache_key] = cropped_texture
	return cropped_texture


func _handle_cg_command(line: Dictionary) -> void:
	if not cg_rect:
		return
	var type = str(line.get("type", ""))
	if type == "show_cg":
		var cg_id = str(line.get("cg_id", ""))
		if cg_id != "":
			var path = "res://assets/cgs/%s.png" % cg_id
			if ResourceLoader.exists(path):
				var tex = load(path)
				if tex:
					cg_rect.texture = tex
					cg_rect.visible = true
					SystemData.unlock_cg(cg_id)

					var tween = create_tween()
					tween.tween_property(cg_rect, "modulate:a", 1.0, 1.0)

					# Pause dialogue while fading
					typing_timer.stop()
					_cancel_auto_advance()
					advance_button.disabled = true
					await tween.finished
					advance_button.disabled = false
					_start_typing(str(line.get("text", "")))
					return
	elif type == "hide_cg":
		if cg_rect.visible:
			var tween = create_tween()
			tween.tween_property(cg_rect, "modulate:a", 0.0, 1.0)

			typing_timer.stop()
			_cancel_auto_advance()
			advance_button.disabled = true
			await tween.finished
			cg_rect.visible = false
			cg_rect.texture = null
			advance_button.disabled = false
			_start_typing(str(line.get("text", "")))
			return


func _finish_dialogue() -> void:
	if _dialogue_ending:
		return
	_dialogue_ending = true
	advance_button.disabled = true
	_stop_fast_advance()
	_cancel_auto_advance()
	emit_signal("dialogue_finished", dialogue_id)

	if _metadata.has("set_flag"):
		EventFlags.set_flag(str(_metadata["set_flag"]))
	if _metadata.has("set_flags"):
		var flags = _metadata["set_flags"]
		if typeof(flags) == TYPE_ARRAY:
			for flag in flags:
				EventFlags.set_flag(str(flag))
	if _metadata.has("morning_notice"):
		GameManager.set_transient("morning_notice", _metadata["morning_notice"])
	if _metadata.has("exchange_lime"):
		AffinityManager.exchange_lime(str(_metadata["exchange_lime"]))
	if _metadata.has("set_romance"):
		AffinityManager.set_romance(str(_metadata["set_romance"]))

	var stat_changes: Array[Dictionary] = []
	if _metadata.has("add_stat"):
		var stats = _metadata["add_stat"]
		if typeof(stats) == TYPE_DICTIONARY:
			for stat_name in stats:
				var amount = int(stats[stat_name])
				if amount != 0:
					PlayerData.add_stat(str(stat_name), amount)
					GameManager.log_stat_change(str(stat_name), amount)
					var label = PlayerData.STAT_LABEL_MAP.get(str(stat_name), str(stat_name))
					stat_changes.append({"label": label, "amount": amount})

	# Show stat change notification (abstract expression, no numbers)
	if not stat_changes.is_empty():
		await _show_stat_notification(stat_changes)

	# Track affinity changes for notification
	var affinity_char_id := ""
	var affinity_delta := 0
	if _metadata.has("add_affinity"):
		var aff = _metadata["add_affinity"]
		if typeof(aff) == TYPE_DICTIONARY:
			for char_id in aff:
				var id = str(char_id)
				AffinityManager.set_met(id)
				var before = AffinityManager.get_affinity(id)
				var after = AffinityManager.add_affinity(id, int(aff[char_id]))
				if after >= 0:
					affinity_char_id = id
					affinity_delta = maxi(0, after - before)
					_track_pending_confession(id, before, after)
	if _metadata.has("set_romance_progress"):
		var id = str(_metadata["set_romance_progress"])
		AffinityManager.set_met(id)
		var before = AffinityManager.get_affinity(id)
		var after = AffinityManager.add_affinity(id, 1)
		if after >= 0:
			affinity_char_id = id
			affinity_delta = maxi(0, after - before)
			_track_pending_confession(id, before, after)
	if _metadata.has("add_intel"):
		var intels = _metadata["add_intel"]
		if typeof(intels) == TYPE_ARRAY:
			for entry in intels:
				RivalIntel.add_intel(
					str(entry.get("id", "")), str(entry.get("key", "")), str(entry.get("value", ""))
				)

	if dialogue_id == "ch1_opening":
		EventFlags.set_flag("ch1_sumi_tournament_talk", true)
		EventFlags.set_flag("ch1_forced_opening_done", true)

	# Show affinity notification before transitioning
	if affinity_char_id != "":
		await _show_affinity_notification(affinity_char_id, affinity_delta)

	if _pending_confession != "":
		var return_scene = (
			next_scene_path if next_scene_path != "" else "res://scenes/daily/map.tscn"
		)
		GameManager.queue_dialogue(
			"res://data/dialogue/confession.json",
			"confession_%s" % _pending_confession,
			return_scene
		)
		get_tree().change_scene_to_file("res://scenes/dialogue/dialogue_box.tscn")
		return

	if dialogue_id == "ch1_opening" and not EventFlags.get_flag("ch1_opening_tutorial_done"):
		var resume_scene = (
			next_scene_path if next_scene_path != "" else "res://scenes/daily/map.tscn"
		)
		GameManager.set_transient("post_tutorial_next_scene", resume_scene)
		get_tree().change_scene_to_file("res://scenes/daily/practice.tscn")
		return

	if next_scene_path != "":
		get_tree().change_scene_to_file(next_scene_path)
		return

	get_tree().change_scene_to_file("res://scenes/daily/map.tscn")


func _track_pending_confession(char_id: String, before: int, after: int) -> void:
	if after < AffinityManager.MAX_LEVEL:
		return
	if before >= AffinityManager.MAX_LEVEL:
		return
	if AffinityManager.is_in_romance(char_id):
		return
	if not AffinityManager.is_romance_candidate(char_id):
		return
	_pending_confession = char_id


func _create_notification_card(
	layer: CanvasLayer, title: String, message: String, accent_color: Color, message_color: Color
) -> Control:
	var card_root = Control.new()
	card_root.position = NOTIFICATION_BASE_POSITION
	card_root.size = NOTIFICATION_CARD_SIZE
	card_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	card_root.modulate = Color(1, 1, 1, 0)
	layer.add_child(card_root)

	var shadow = Panel.new()
	shadow.position = Vector2(8, 10)
	shadow.size = NOTIFICATION_CARD_SIZE
	shadow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var shadow_style = StyleBoxFlat.new()
	shadow_style.bg_color = Color(0, 0, 0, 0.30)
	shadow_style.corner_radius_top_left = 16
	shadow_style.corner_radius_top_right = 16
	shadow_style.corner_radius_bottom_left = 16
	shadow_style.corner_radius_bottom_right = 16
	shadow.add_theme_stylebox_override("panel", shadow_style)
	card_root.add_child(shadow)

	var panel = PanelContainer.new()
	panel.size = NOTIFICATION_CARD_SIZE
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var panel_style = StyleBoxFlat.new()
	panel_style.bg_color = Color(0.05, 0.06, 0.11, 0.92)
	panel_style.border_color = accent_color.lightened(0.12)
	panel_style.border_width_left = 9
	panel_style.border_width_top = 2
	panel_style.border_width_right = 2
	panel_style.border_width_bottom = 2
	panel_style.corner_radius_top_left = 16
	panel_style.corner_radius_top_right = 16
	panel_style.corner_radius_bottom_left = 16
	panel_style.corner_radius_bottom_right = 16
	panel_style.content_margin_left = 24
	panel_style.content_margin_right = 22
	panel_style.content_margin_top = 14
	panel_style.content_margin_bottom = 14
	panel.add_theme_stylebox_override("panel", panel_style)
	card_root.add_child(panel)

	var content = VBoxContainer.new()
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content.size_flags_vertical = Control.SIZE_EXPAND_FILL
	content.alignment = BoxContainer.ALIGNMENT_CENTER
	content.add_theme_constant_override("separation", 2)
	panel.add_child(content)

	var title_label = Label.new()
	title_label.text = title
	title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	title_label.add_theme_font_size_override("font_size", 18)
	title_label.add_theme_color_override("font_color", accent_color.lightened(0.18))
	title_label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.92))
	title_label.add_theme_constant_override("outline_size", 4)
	content.add_child(title_label)

	var message_label = Label.new()
	message_label.text = message
	message_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	message_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	message_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	message_label.custom_minimum_size = Vector2(0, 54)
	message_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	message_label.add_theme_font_size_override("font_size", 28)
	message_label.add_theme_color_override("font_color", message_color)
	message_label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.95))
	message_label.add_theme_constant_override("outline_size", 8)
	content.add_child(message_label)

	return card_root


func _show_affinity_notification(char_id: String, _delta: int) -> void:
	var layer = CanvasLayer.new()
	layer.layer = 100
	add_child(layer)

	var char_name = SPEAKER_NAMES.get(char_id, char_id)
	var star_text = AffinityManager.get_star_text(char_id)
	var notif_color = GameManager.get_speaker_accent_color(char_id)
	var card = _create_notification_card(
		layer, "絆の変化", "♡ %sとの絆が深まった  %s" % [char_name, star_text], notif_color, Color("fff1db")
	)

	# Sparkle particles
	var particles = GPUParticles2D.new()
	var mat = ParticleProcessMaterial.new()
	mat.direction = Vector3(0, -1, 0)
	mat.spread = 180.0
	mat.initial_velocity_min = 15.0
	mat.initial_velocity_max = 50.0
	mat.gravity = Vector3(0, 15, 0)
	mat.lifetime_randomness = 0.3

	var scale_curve = CurveTexture.new()
	var sc = Curve.new()
	sc.add_point(Vector2(0, 0.6))
	sc.add_point(Vector2(0.4, 1.0))
	sc.add_point(Vector2(1, 0))
	scale_curve.curve = sc
	mat.scale_curve = scale_curve

	var alpha_curve = CurveTexture.new()
	var ac = Curve.new()
	ac.add_point(Vector2(0, 0))
	ac.add_point(Vector2(0.15, 1))
	ac.add_point(Vector2(0.6, 0.7))
	ac.add_point(Vector2(1, 0))
	alpha_curve.curve = ac
	mat.alpha_curve = alpha_curve

	mat.color = Color(1.0, 0.85, 0.3, 0.9)
	particles.process_material = mat
	particles.amount = 14
	particles.lifetime = 1.0
	particles.one_shot = true
	particles.position = NOTIFICATION_BASE_POSITION + Vector2(NOTIFICATION_CARD_SIZE.x * 0.5, 64)

	# Procedural circle texture for sparkles
	var img = Image.create(8, 8, false, Image.FORMAT_RGBA8)
	var center = Vector2(4, 4)
	for x in range(8):
		for y in range(8):
			var dist = Vector2(x, y).distance_to(center)
			if dist < 4.0:
				var alpha = clampf(1.0 - (dist / 4.0), 0, 1)
				img.set_pixel(x, y, Color(1, 1, 1, alpha))
			else:
				img.set_pixel(x, y, Color(0, 0, 0, 0))
	particles.texture = ImageTexture.create_from_image(img)
	layer.add_child(particles)
	particles.emitting = true

	var tween = create_tween()
	tween.set_parallel(true)
	tween.tween_property(card, "modulate:a", 1.0, 0.26).set_trans(Tween.TRANS_CUBIC).set_ease(
		Tween.EASE_OUT
	)
	(
		tween
		. tween_property(card, "position:y", NOTIFICATION_BASE_POSITION.y - 18.0, 0.34)
		. from(NOTIFICATION_BASE_POSITION.y + 12.0)
		. set_trans(Tween.TRANS_CUBIC)
		. set_ease(Tween.EASE_OUT)
	)
	await tween.finished

	await get_tree().create_timer(1.2).timeout

	var fade_tween = create_tween()
	fade_tween.set_parallel(true)
	fade_tween.tween_property(card, "modulate:a", 0.0, 0.38)
	fade_tween.tween_property(card, "position:y", NOTIFICATION_BASE_POSITION.y - 30.0, 0.38)
	await fade_tween.finished

	layer.queue_free()


func _show_stat_notification(stat_changes: Array[Dictionary]) -> void:
	# Build notification text using abstract expressions (no raw numbers)
	var parts: Array[String] = []
	for change in stat_changes:
		var change_label = PlayerData.get_stat_change_label(change["amount"])
		if change_label != "":
			parts.append("【%s】が%s" % [change["label"], change_label])
	if parts.is_empty():
		return
	var text = "……" + "、".join(parts) + "。"

	var layer = CanvasLayer.new()
	layer.layer = 100
	add_child(layer)

	var card = _create_notification_card(layer, "腕前の変化", text, Color("55d4ff"), Color("eaf8ff"))

	var tween = create_tween()
	tween.set_parallel(true)
	tween.tween_property(card, "modulate:a", 1.0, 0.26).set_trans(Tween.TRANS_CUBIC).set_ease(
		Tween.EASE_OUT
	)
	(
		tween
		. tween_property(card, "position:y", NOTIFICATION_BASE_POSITION.y - 18.0, 0.34)
		. from(NOTIFICATION_BASE_POSITION.y + 12.0)
		. set_trans(Tween.TRANS_CUBIC)
		. set_ease(Tween.EASE_OUT)
	)
	await tween.finished

	await get_tree().create_timer(1.5).timeout

	var fade_tween = create_tween()
	fade_tween.set_parallel(true)
	fade_tween.tween_property(card, "modulate:a", 0.0, 0.38)
	fade_tween.tween_property(card, "position:y", NOTIFICATION_BASE_POSITION.y - 30.0, 0.38)
	await fade_tween.finished

	layer.queue_free()
