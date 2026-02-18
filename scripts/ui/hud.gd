extends CanvasLayer

@onready var date_time_label: Label = %DateTimeLabel
@onready var remaining_days_label: Label = %RemainingDaysLabel


func _ready() -> void:
	if not CalendarManager.time_changed.is_connected(_update_labels):
		CalendarManager.time_changed.connect(_update_labels)
	if not CalendarManager.day_changed.is_connected(_update_labels):
		CalendarManager.day_changed.connect(_update_labels)
	_update_labels()


func _process(_delta: float) -> void:
	_update_labels()


func _update_labels(_value: Variant = null) -> void:
	date_time_label.text = CalendarManager.get_display_date()

	var remaining_days = CalendarManager.get_remaining_days()
	if remaining_days <= 0:
		remaining_days_label.text = "大会当日"
	else:
		remaining_days_label.text = "大会まであと %d 日" % remaining_days
