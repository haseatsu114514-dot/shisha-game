extends Control

@onready var stats_label: RichTextLabel = %StatsLabel


func _ready() -> void:
	_refresh()


func _refresh() -> void:
	var lines: Array[String] = []
	lines.append("技術  %d (★%d)" % [PlayerData.stat_technique, PlayerData.get_stat_stars("technique")])
	lines.append("味覚  %d (★%d)" % [PlayerData.stat_sense, PlayerData.get_stat_stars("sense")])
	lines.append("度胸  %d (★%d)" % [PlayerData.stat_guts, PlayerData.get_stat_stars("guts")])
	lines.append("魅力  %d (★%d)" % [PlayerData.stat_charm, PlayerData.get_stat_stars("charm")])
	lines.append("洞察  %d (★%d)" % [PlayerData.stat_insight, PlayerData.get_stat_stars("insight")])
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
