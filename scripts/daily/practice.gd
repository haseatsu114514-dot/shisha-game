extends Control

func _ready() -> void:
	%Label.text = "将来実装: ミニゲーム練習"


func _on_back_button_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/daily/baito.tscn")
