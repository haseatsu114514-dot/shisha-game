extends Control

const SETTINGS_PATH := "user://settings.cfg"

@onready var settings_panel: PanelContainer = %SettingsPanel
@onready var info_label: Label = %InfoLabel
@onready var bgm_slider: HSlider = %BGMSlider
@onready var se_slider: HSlider = %SESlider
@onready var text_speed_slider: HSlider = %TextSpeedSlider


func _ready() -> void:
	settings_panel.visible = false
	_load_settings()
	info_label.text = "地方大会編 Day1-7 実装版"
	GameManager.play_bgm(GameManager.BGM_TITLE_PATH, -8.0, true)


func _on_new_game_pressed() -> void:
	GameManager.start_new_game()
	GameManager.queue_dialogue(
		"res://data/dialogue/ch1_main.json",
		"ch1_opening",
		"res://scenes/daily/morning_phone.tscn",
		{
			"set_flag": "ch1_sumi_first_talk",
			"morning_notice": "大会まであと7日",
			"bg": "res://assets/backgrounds/bg_chillhouse_inside.png"
		}
	)
	get_tree().change_scene_to_file("res://scenes/dialogue/dialogue_box.tscn")


func _on_continue_pressed() -> void:
	GameManager.set_transient("save_load_mode", "load")
	GameManager.set_transient("return_scene", "res://scenes/title/title_screen.tscn")
	get_tree().change_scene_to_file("res://scenes/ui/save_load.tscn")


func _on_settings_pressed() -> void:
	settings_panel.visible = true


func _on_close_settings_pressed() -> void:
	_save_settings()
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


func _on_quit_pressed() -> void:
	get_tree().quit()
