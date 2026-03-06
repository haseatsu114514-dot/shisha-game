extends Control

@onready var stats_label: RichTextLabel = %StatsLabel


func _ready() -> void:
	_refresh()


func _refresh() -> void:
	var lines: Array[String] = []
	lines.append("技術  %d (★%d)" % [PlayerData.stat_technique, PlayerData.get_stat_stars("technique")])
	lines.append("感覚  %d (★%d)" % [PlayerData.stat_sense, PlayerData.get_stat_stars("sense")])
	lines.append("度胸  %d (★%d)" % [PlayerData.stat_guts, PlayerData.get_stat_stars("guts")])
	lines.append("魅力  %d (★%d)" % [PlayerData.stat_charm, PlayerData.get_stat_stars("charm")])
	lines.append("洞察  %d (★%d)" % [PlayerData.stat_insight, PlayerData.get_stat_stars("insight")])
	lines.append("")
	lines.append("所持金: %d円" % PlayerData.money)
	lines.append("\nレーダーチャートは後続Stepで描画予定")
	stats_label.text = "\n".join(lines)


func _on_back_button_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/daily/map.tscn")
