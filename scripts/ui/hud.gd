extends CanvasLayer

@onready var date_label: Label = %DateLabel
@onready var action_label: Label = %ActionLabel
@onready var money_label: Label = %MoneyLabel


func _ready() -> void:
	if not CalendarManager.time_changed.is_connected(_update_labels):
		CalendarManager.time_changed.connect(_update_labels)
	if not CalendarManager.day_changed.is_connected(_update_labels):
		CalendarManager.day_changed.connect(_update_labels)
	_update_labels()


func _process(_delta: float) -> void:
	money_label.text = "💰 %d円" % PlayerData.money


func _update_labels(_value: Variant = null) -> void:
	date_label.text = CalendarManager.get_display_date()
	action_label.text = "行動: %d" % CalendarManager.actions_remaining
	money_label.text = "💰 %d円" % PlayerData.money
