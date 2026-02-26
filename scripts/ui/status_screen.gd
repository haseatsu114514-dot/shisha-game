extends Control

@onready var stats_label: RichTextLabel = %StatsLabel


func _ready() -> void:
	_refresh()


func _refresh() -> void:
	var lines: Array[String] = []
	var stat_entries = [
		{"key": "technique", "name": "技術"},
		{"key": "sense", "name": "センス"},
		{"key": "guts", "name": "根性"},
		{"key": "charm", "name": "魅力"},
		{"key": "insight", "name": "洞察"},
	]
	for entry in stat_entries:
		var stars = PlayerData.get_stat_stars(entry["key"])
		var star_str = "★".repeat(stars) + "☆".repeat(5 - stars)
		lines.append("%s  %s" % [entry["name"], star_str])
	lines.append("")
	lines.append("得意フレーバー")
	var flavor_specialty_lines = PlayerData.get_flavor_specialty_summary_lines()
	for specialty_line in flavor_specialty_lines:
		lines.append("・%s" % specialty_line)
	lines.append("")
	lines.append("所持金: %d円" % PlayerData.money)
	lines.append("")
	lines.append("装備")
	lines.append("ボウル: %s" % PlayerData.get_equipped_item_name("bowl"))
	lines.append("ヒートマネジメント: %s" % PlayerData.get_equipped_item_name("hms"))
	lines.append("炭: %s" % PlayerData.get_equipped_item_name("charcoal"))
	lines.append("セット: %s" % PlayerData.get_equipment_set_name())
	lines.append("火力特性: %s" % PlayerData.get_heat_strategy_hint())
	lines.append("練習ボーナス")
	var preview_lines: Array[String] = PlayerData.get_practice_bonus_preview_lines()
	if preview_lines.is_empty():
		lines.append("・なし")
	else:
		for preview in preview_lines:
			lines.append("・%s" % preview)
	stats_label.text = "\n".join(lines)


func _on_back_button_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/daily/map.tscn")
