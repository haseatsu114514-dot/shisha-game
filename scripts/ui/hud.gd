extends CanvasLayer

@onready var date_time_label: Label = %DateTimeLabel
@onready var weather_label: Label = %WeatherLabel
@onready var remaining_days_label: Label = %RemainingDaysLabel
@onready var menu_button: Button = %MenuButton

const SYSTEM_MENU_SCENE = preload("res://scenes/ui/system_menu.tscn")


func _ready() -> void:
	if not CalendarManager.time_changed.is_connected(_update_labels):
		CalendarManager.time_changed.connect(_update_labels)
	if not CalendarManager.day_changed.is_connected(_update_labels):
		CalendarManager.day_changed.connect(_update_labels)
		
	if menu_button and not menu_button.pressed.is_connected(_on_menu_pressed):
		menu_button.pressed.connect(_on_menu_pressed)
		
	_update_labels()


func _process(_delta: float) -> void:
	_update_labels()


func _update_labels(_value: Variant = null) -> void:
	date_time_label.text = CalendarManager.get_display_date()
	weather_label.text = "天気: %s" % CalendarManager.get_weather_label()

	var remaining_days = CalendarManager.get_remaining_days()
	if remaining_days <= 0:
		remaining_days_label.text = "大会当日"
	else:
		remaining_days_label.text = "大会まであと %d 日" % remaining_days


func _on_menu_pressed() -> void:
	GameManager.play_ui_se("confirm")
	
	# Prevent opening multiple menus
	if get_tree().root.has_node("SystemMenu"):
		return
		
	var menu = SYSTEM_MENU_SCENE.instantiate()
	get_tree().root.add_child(menu)
