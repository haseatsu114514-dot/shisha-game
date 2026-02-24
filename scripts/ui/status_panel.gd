extends PanelContainer

@onready var temp_gauge: ProgressBar = %TempGauge
@onready var temp_zone_label: Label = %TempZoneLabel
@onready var charcoal_label: Label = %CharcoalLabel

func update_status(temp_level: float, zone_text: String, charcoal_count: int, temp_pass: float, temp_top: float) -> void:
	if not is_node_ready():
		return
	temp_gauge.value = temp_level
	temp_zone_label.text = zone_text
	
	if temp_level < temp_pass:
		temp_zone_label.add_theme_color_override("font_color", Color.AQUA)
	elif temp_level > temp_top:
		temp_zone_label.add_theme_color_override("font_color", Color.ORANGE_RED)
	else:
		temp_zone_label.add_theme_color_override("font_color", Color.GREEN_YELLOW)
		
	charcoal_label.text = "炭: %d" % charcoal_count
