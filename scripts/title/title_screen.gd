extends Control

const SETTINGS_PATH := "user://settings.cfg"

@onready var title_card: PanelContainer = $TitleCard
@onready var hero_frame: PanelContainer = $HeroFrame
@onready var menu_panel: PanelContainer = $MenuPanel
@onready var title_label: Label = $TitleLabel
@onready var subtitle_label: Label = $SubtitleLabel
@onready var copyright_label: Label = $CopyrightLabel
@onready var logo_rect: TextureRect = $LogoRect
@onready var packii_rect: TextureRect = $HeroFrame/PackiiRect
@onready var settings_panel: PanelContainer = %SettingsPanel
@onready var info_label: Label = %InfoLabel
@onready var bgm_slider: HSlider = %BGMSlider
@onready var se_slider: HSlider = %SESlider
@onready var text_speed_slider: HSlider = %TextSpeedSlider


func _ready() -> void:
	settings_panel.visible = false
	bgm_slider.value_changed.connect(_on_audio_slider_changed)
	se_slider.value_changed.connect(_on_audio_slider_changed)
	_load_settings()
	GameManager.apply_audio_settings()
	info_label.text = "第1章 一吸目\nSMOKE CROWN CUP 地方大会\nスミの店で基礎を仕上げ、7日後の本番へ。"
	_apply_visual_theme()
	_build_title_card_content()
	_build_title_context()
	GameManager.play_bgm(GameManager.BGM_TITLE_PATH, -8.0, true)
	_play_intro_animation()
	_apply_font()


func _apply_font() -> void:
	# GameManager が root theme にフォントを設定済みのため、
	# ここでは追加の override は不要（override すると fallback が失われる）
	pass


func _apply_visual_theme() -> void:
	title_card.add_theme_stylebox_override("panel", _make_panel_style(Color(0.04, 0.06, 0.11, 0.84), Color("feae34", 0.72), 4))
	hero_frame.add_theme_stylebox_override("panel", _make_panel_style(Color(0.05, 0.06, 0.10, 0.8), Color("8b9bb4", 0.28), 3))
	menu_panel.add_theme_stylebox_override("panel", _make_panel_style(Color(0.04, 0.06, 0.12, 0.88), Color("feae34", 0.62), 6))
	settings_panel.add_theme_stylebox_override("panel", _make_panel_style(Color(0.05, 0.06, 0.10, 0.95), Color("feae34", 0.48), 4))

	title_label.add_theme_color_override("font_color", Color("fff0cf"))
	title_label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.92))
	title_label.add_theme_constant_override("outline_size", 10)
	subtitle_label.add_theme_color_override("font_color", Color("f4c87b"))
	subtitle_label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.92))
	subtitle_label.add_theme_constant_override("outline_size", 5)
	info_label.add_theme_color_override("font_color", Color("ead4aa"))
	info_label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.92))
	info_label.add_theme_constant_override("outline_size", 5)
	copyright_label.add_theme_color_override("font_color", Color("c0cbdc"))
	copyright_label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.82))
	copyright_label.add_theme_constant_override("outline_size", 3)

	logo_rect.visible = false
	logo_rect.texture = null
	packii_rect.visible = false
	packii_rect.texture = null
	title_label.visible = false
	subtitle_label.visible = false
	info_label.visible = false

	for button in _get_menu_buttons():
		_style_menu_button(button)
	var close_button := $SettingsPanel/SettingsContent/CloseSettingsButton as Button
	if close_button != null:
		_style_menu_button(close_button)


func _build_title_context() -> void:
	var existing = hero_frame.get_node_or_null("HeroContext")
	if existing != null:
		return
	var margin = MarginContainer.new()
	margin.name = "HeroContext"
	margin.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	margin.size_flags_vertical = Control.SIZE_EXPAND_FILL
	margin.add_theme_constant_override("margin_left", 24)
	margin.add_theme_constant_override("margin_top", 22)
	margin.add_theme_constant_override("margin_right", 24)
	margin.add_theme_constant_override("margin_bottom", 22)
	hero_frame.add_child(margin)

	var vbox = VBoxContainer.new()
	vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	vbox.size_flags_vertical = Control.SIZE_EXPAND_FILL
	vbox.add_theme_constant_override("separation", 12)
	margin.add_child(vbox)

	var badge = Label.new()
	badge.text = "CHAPTER 1"
	badge.add_theme_font_size_override("font_size", 18)
	badge.add_theme_color_override("font_color", Color("f4c87b"))
	vbox.add_child(badge)

	var hook = Label.new()
	hook.text = "地方大会まであと7日"
	hook.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	hook.add_theme_font_size_override("font_size", 30)
	hook.add_theme_color_override("font_color", Color("fff0cf"))
	hook.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.82))
	hook.add_theme_constant_override("outline_size", 4)
	vbox.add_child(hook)

	var body = Label.new()
	body.text = "配合、詰め方、穴あけ、炭、蒸らし、吸い出し。\n王道を一つずつ詰めて、地方大会を勝ち切る。"
	body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body.add_theme_font_size_override("font_size", 20)
	body.add_theme_color_override("font_color", Color("ead4aa"))
	vbox.add_child(body)


func _build_title_card_content() -> void:
	var existing = title_card.get_node_or_null("TitleContent")
	if existing != null:
		return
	var margin = MarginContainer.new()
	margin.name = "TitleContent"
	margin.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	margin.size_flags_vertical = Control.SIZE_EXPAND_FILL
	margin.add_theme_constant_override("margin_left", 28)
	margin.add_theme_constant_override("margin_top", 24)
	margin.add_theme_constant_override("margin_right", 28)
	margin.add_theme_constant_override("margin_bottom", 22)
	title_card.add_child(margin)

	var vbox = VBoxContainer.new()
	vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	vbox.size_flags_vertical = Control.SIZE_EXPAND_FILL
	vbox.add_theme_constant_override("separation", 8)
	margin.add_child(vbox)

	var eyebrow = Label.new()
	eyebrow.text = "SHISHA STORY RPG"
	eyebrow.add_theme_font_size_override("font_size", 18)
	eyebrow.add_theme_color_override("font_color", Color("f4c87b"))
	vbox.add_child(eyebrow)

	var title = Label.new()
	title.text = "煙の向こう側"
	title.add_theme_font_size_override("font_size", 54)
	title.add_theme_color_override("font_color", Color("fff0cf"))
	title.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.92))
	title.add_theme_constant_override("outline_size", 8)
	vbox.add_child(title)

	var subtitle = Label.new()
	subtitle.text = "Beyond the Smoke"
	subtitle.add_theme_font_size_override("font_size", 22)
	subtitle.add_theme_color_override("font_color", Color("f4c87b"))
	vbox.add_child(subtitle)

	var chapter = Label.new()
	chapter.text = "第1章 一吸目"
	chapter.add_theme_font_size_override("font_size", 26)
	chapter.add_theme_color_override("font_color", Color("ead4aa"))
	vbox.add_child(chapter)

	var summary = Label.new()
	summary.text = "SMOKE CROWN CUP 地方大会\nスミの店で基礎を仕上げ、7日後の本番へ。"
	summary.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	summary.size_flags_vertical = Control.SIZE_EXPAND_FILL
	summary.add_theme_font_size_override("font_size", 20)
	summary.add_theme_color_override("font_color", Color("ead4aa"))
	vbox.add_child(summary)


func _make_panel_style(bg: Color, border: Color, accent_left_width: int) -> StyleBoxFlat:
	var style = StyleBoxFlat.new()
	style.bg_color = bg
	style.border_color = border
	style.border_width_left = accent_left_width
	style.border_width_top = 2
	style.border_width_right = 2
	style.border_width_bottom = 2
	style.corner_radius_top_left = 14
	style.corner_radius_top_right = 14
	style.corner_radius_bottom_left = 14
	style.corner_radius_bottom_right = 14
	style.shadow_color = Color(0, 0, 0, 0.34)
	style.shadow_size = 8
	style.content_margin_left = 18
	style.content_margin_right = 18
	style.content_margin_top = 16
	style.content_margin_bottom = 16
	return style


func _style_menu_button(button: Button) -> void:
	button.add_theme_font_size_override("font_size", 24)
	button.add_theme_color_override("font_color", Color("f7ead0"))
	button.add_theme_color_override("font_hover_color", Color("fff6e6"))
	button.add_theme_color_override("font_pressed_color", Color("fff6e6"))
	button.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.9))
	button.add_theme_constant_override("outline_size", 4)

	var normal_style = StyleBoxFlat.new()
	normal_style.bg_color = Color("25314b", 0.92)
	normal_style.border_color = Color("feae34", 0.42)
	normal_style.border_width_left = 4
	normal_style.border_width_top = 1
	normal_style.border_width_right = 1
	normal_style.border_width_bottom = 1
	normal_style.corner_radius_top_left = 6
	normal_style.corner_radius_top_right = 14
	normal_style.corner_radius_bottom_left = 14
	normal_style.corner_radius_bottom_right = 6
	normal_style.content_margin_left = 18
	normal_style.content_margin_right = 14
	normal_style.content_margin_top = 12
	normal_style.content_margin_bottom = 12
	button.add_theme_stylebox_override("normal", normal_style)

	var hover_style = normal_style.duplicate()
	hover_style.bg_color = Color("34486c", 0.96)
	hover_style.border_color = Color("feae34", 0.88)
	hover_style.border_width_left = 6
	button.add_theme_stylebox_override("hover", hover_style)

	var pressed_style = normal_style.duplicate()
	pressed_style.bg_color = Color("8a5d1a", 0.94)
	pressed_style.border_color = Color("ffd878")
	pressed_style.border_width_left = 6
	button.add_theme_stylebox_override("pressed", pressed_style)

	var disabled_style = normal_style.duplicate()
	disabled_style.bg_color = Color(0.16, 0.18, 0.24, 0.74)
	disabled_style.border_color = Color("8b9bb4", 0.25)
	button.add_theme_stylebox_override("disabled", disabled_style)

	var focus_style = hover_style.duplicate()
	focus_style.border_color = Color("fff0cf")
	button.add_theme_stylebox_override("focus", focus_style)


func _get_menu_buttons() -> Array[Button]:
	return [
		$MenuPanel/Menu/NewGameButton,
		$MenuPanel/Menu/ContinueButton,
		$MenuPanel/Menu/GalleryButton,
		$MenuPanel/Menu/SettingsButton,
		$MenuPanel/Menu/QuitButton,
	]


func _play_intro_animation() -> void:
	var title_card_target = title_card.position
	var hero_frame_target = hero_frame.position
	var menu_panel_target = menu_panel.position

	title_card.position = title_card_target + Vector2(-26, 0)
	hero_frame.position = hero_frame_target + Vector2(28, 0)
	menu_panel.position = menu_panel_target + Vector2(0, 22)

	title_card.modulate = Color(1, 1, 1, 0)
	hero_frame.modulate = Color(1, 1, 1, 0)
	menu_panel.modulate = Color(1, 1, 1, 0)
	logo_rect.modulate = Color(1, 1, 1, 0)
	title_label.modulate = Color(1, 1, 1, 0)
	subtitle_label.modulate = Color(1, 1, 1, 0)
	info_label.modulate = Color(1, 1, 1, 0)

	var tween = create_tween()
	tween.set_parallel(true)
	tween.tween_property(title_card, "modulate:a", 1.0, 0.46).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tween.tween_property(title_card, "position", title_card_target, 0.46).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tween.tween_property(hero_frame, "modulate:a", 1.0, 0.62).set_delay(0.08).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tween.tween_property(hero_frame, "position", hero_frame_target, 0.62).set_delay(0.08).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tween.tween_property(menu_panel, "modulate:a", 1.0, 0.5).set_delay(0.12).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tween.tween_property(menu_panel, "position", menu_panel_target, 0.5).set_delay(0.12).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)


func _collect_text_nodes(root: Node) -> Array:
	var result: Array = []
	for child in root.get_children():
		if child is Label or child is Button or child is RichTextLabel:
			result.append(child)
		result.append_array(_collect_text_nodes(child))
	return result


func _on_new_game_pressed() -> void:
	GameManager.play_ui_se("confirm")
	GameManager.start_new_game()
	GameManager.queue_dialogue(
		"res://data/dialogue/ch1_main.json",
		"ch1_opening",
		"res://scenes/daily/morning_phone.tscn",
		{
			"set_flag": "ch1_sumi_first_talk",
			"morning_notice": "大会まであと7日",
			"bg": "res://assets/backgrounds/tonari_day.png",
			"add_affinity": {"sumi": 1}
		}
	)
	get_tree().change_scene_to_file("res://scenes/dialogue/dialogue_box.tscn")


func _on_continue_pressed() -> void:
	GameManager.play_ui_se("confirm")
	GameManager.set_transient("save_load_mode", "load")
	GameManager.set_transient("return_scene", "res://scenes/title/title_screen.tscn")
	get_tree().change_scene_to_file("res://scenes/ui/save_load.tscn")


func _on_gallery_pressed() -> void:
	GameManager.play_ui_se("confirm")
	get_tree().change_scene_to_file("res://scenes/ui/cg_gallery.tscn")


func _on_settings_pressed() -> void:
	GameManager.play_ui_se("cursor")
	settings_panel.visible = true


func _on_close_settings_pressed() -> void:
	GameManager.play_ui_se("confirm")
	_save_settings()
	GameManager.apply_audio_settings()
	settings_panel.visible = false


func _load_settings() -> void:
	var cfg = ConfigFile.new()
	var err = cfg.load(SETTINGS_PATH)
	if err != OK:
		bgm_slider.value = 0.8
		se_slider.value = 0.8
		text_speed_slider.value = 30
		return

	bgm_slider.value = float(cfg.get_value("audio", "bgm", 0.8))
	se_slider.value = float(cfg.get_value("audio", "se", 0.8))
	text_speed_slider.value = float(cfg.get_value("text", "speed", 30.0))


func _save_settings() -> void:
	var cfg = ConfigFile.new()
	cfg.set_value("audio", "bgm", bgm_slider.value)
	cfg.set_value("audio", "se", se_slider.value)
	cfg.set_value("text", "speed", text_speed_slider.value)
	cfg.save(SETTINGS_PATH)


func _on_audio_slider_changed(_value: float) -> void:
	_save_settings()
	GameManager.apply_audio_settings()


func _on_quit_pressed() -> void:
	GameManager.play_ui_se("cancel")
	get_tree().quit()
