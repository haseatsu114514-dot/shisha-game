extends CanvasLayer
## Floating notification that shows when affinity increases.
## Call AffinityNotification.show_increase(character_name, amount) to display.

var _tween: Tween

@onready var _label: Label = Label.new()
@onready var _particles: GPUParticles2D = GPUParticles2D.new()


func _ready() -> void:
	layer = 100
	_setup_label()
	_setup_sparkle_particles()


func _setup_label() -> void:
	_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_label.position = Vector2(440, 300)
	_label.size = Vector2(400, 60)
	_label.add_theme_font_size_override("font_size", 28)
	_label.modulate = Color(1, 1, 1, 0)
	add_child(_label)


func _setup_sparkle_particles() -> void:
	var mat = ParticleProcessMaterial.new()
	mat.direction = Vector3(0, -1, 0)
	mat.spread = 180.0
	mat.initial_velocity_min = 20.0
	mat.initial_velocity_max = 60.0
	mat.gravity = Vector3(0, 20, 0)
	mat.lifetime_randomness = 0.3

	# Scale
	var scale_curve = CurveTexture.new()
	var curve = Curve.new()
	curve.add_point(Vector2(0.0, 0.8))
	curve.add_point(Vector2(0.5, 1.0))
	curve.add_point(Vector2(1.0, 0.0))
	scale_curve.curve = curve
	mat.scale_curve = scale_curve

	# Alpha
	var alpha_curve = CurveTexture.new()
	var acurve = Curve.new()
	acurve.add_point(Vector2(0.0, 0.0))
	acurve.add_point(Vector2(0.15, 1.0))
	acurve.add_point(Vector2(0.6, 0.8))
	acurve.add_point(Vector2(1.0, 0.0))
	alpha_curve.curve = acurve
	mat.alpha_curve = alpha_curve

	# Warm golden color
	mat.color = Color(1.0, 0.85, 0.3, 0.9)

	_particles.process_material = mat
	_particles.amount = 12
	_particles.lifetime = 1.2
	_particles.one_shot = true
	_particles.emitting = false
	_particles.position = Vector2(640, 320)

	# Generate small star/circle texture
	var img = Image.create(8, 8, false, Image.FORMAT_RGBA8)
	var center = Vector2(4, 4)
	for x in range(8):
		for y in range(8):
			var dist = Vector2(x, y).distance_to(center)
			if dist < 4.0:
				var alpha = clampf(1.0 - (dist / 4.0), 0.0, 1.0)
				img.set_pixel(x, y, Color(1, 1, 1, alpha))
			else:
				img.set_pixel(x, y, Color(0, 0, 0, 0))
	_particles.texture = ImageTexture.create_from_image(img)
	add_child(_particles)


func show_increase(character_name: String, _amount: int = 1) -> void:
	if _tween and _tween.is_running():
		_tween.kill()

	_label.text = "♡ %sとの絆が深まった" % character_name
	_label.modulate = Color(1.0, 0.92, 0.75, 0)

	# Sparkle burst
	_particles.emitting = true

	# Animate label
	_tween = create_tween()
	_tween.tween_property(_label, "modulate:a", 1.0, 0.3).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	_tween.tween_property(_label, "position:y", 280, 0.4).from(320.0).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	_tween.tween_interval(1.5)
	_tween.tween_property(_label, "modulate:a", 0.0, 0.5).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
