extends Control

@onready var grid_container: GridContainer = %GridContainer
@onready var fullscreen_rect: TextureRect = %FullscreenRect
@onready var close_fullscreen_button: Button = %CloseFullscreenButton
@onready var back_button: Button = %BackButton
@onready var empty_label: Label = %EmptyLabel

# List of known CGs in order
const CG_LIST = [
	"cg_ch1_sumi_secret",
	"cg_ch1_tournament_tension",
	"cg_ch1_toki_smile"
]

func _ready() -> void:
	fullscreen_rect.visible = false
	close_fullscreen_button.visible = false
	empty_label.visible = false
	
	back_button.pressed.connect(_on_back_pressed)
	close_fullscreen_button.pressed.connect(_on_close_fullscreen_pressed)
	
	_populate_grid()


func _populate_grid() -> void:
	for child in grid_container.get_children():
		child.queue_free()
		
	var has_unlocked = false
	for cg_id in CG_LIST:
		var btn = TextureButton.new()
		btn.custom_minimum_size = Vector2(320, 180)
		btn.ignore_texture_size = true
		btn.stretch_mode = TextureButton.STRETCH_KEEP_ASPECT_CENTERED
		
		var is_unlocked = SystemData.is_cg_unlocked(cg_id)
		if is_unlocked:
			has_unlocked = true
			var path = "res://assets/cgs/%s.png" % cg_id
			if ResourceLoader.exists(path):
				var tex = load(path)
				btn.texture_normal = tex
				btn.pressed.connect(_on_thumbnail_pressed.bind(tex))
		else:
			# Locked state: show a dark placeholder or locked icon
			var img = Image.create(320, 180, false, Image.FORMAT_RGBA8)
			img.fill(Color(0.1, 0.1, 0.1, 0.8))
			var tex = ImageTexture.create_from_image(img)
			btn.texture_normal = tex
			btn.disabled = true
			
		grid_container.add_child(btn)

	empty_label.visible = not has_unlocked


func _on_thumbnail_pressed(tex: Texture2D) -> void:
	GameManager.play_ui_se("confirm")
	fullscreen_rect.texture = tex
	fullscreen_rect.visible = true
	close_fullscreen_button.visible = true


func _on_close_fullscreen_pressed() -> void:
	GameManager.play_ui_se("cancel")
	fullscreen_rect.visible = false
	close_fullscreen_button.visible = false


func _on_back_pressed() -> void:
	GameManager.play_ui_se("cancel")
	get_tree().change_scene_to_file("res://scenes/title/title_screen.tscn")
