extends GPUParticles2D


func _ready() -> void:
	_setup_smoke_particles()
	emitting = true


func _setup_smoke_particles() -> void:
	var mat = ParticleProcessMaterial.new()

	# Movement
	mat.direction = Vector3(0, -1, 0)
	mat.spread = 25.0
	mat.initial_velocity_min = 10.0
	mat.initial_velocity_max = 25.0
	mat.gravity = Vector3(0, -8, 0)

	# Lifetime & size
	mat.lifetime_randomness = 0.4

	# Scale curve: start small, grow, then shrink
	var scale_curve = CurveTexture.new()
	var curve = Curve.new()
	curve.add_point(Vector2(0.0, 0.2))
	curve.add_point(Vector2(0.3, 0.7))
	curve.add_point(Vector2(0.7, 1.0))
	curve.add_point(Vector2(1.0, 0.3))
	scale_curve.curve = curve
	mat.scale_curve = scale_curve

	# Alpha fade: appear then fade out
	var alpha_curve = CurveTexture.new()
	var acurve = Curve.new()
	acurve.add_point(Vector2(0.0, 0.0))
	acurve.add_point(Vector2(0.1, 0.25))
	acurve.add_point(Vector2(0.5, 0.18))
	acurve.add_point(Vector2(1.0, 0.0))
	alpha_curve.curve = acurve
	mat.alpha_curve = alpha_curve

	# Color
	mat.color = Color(0.85, 0.88, 0.95, 0.2)

	# Turbulence for organic movement
	mat.turbulence_enabled = true
	mat.turbulence_noise_strength = 2.0
	mat.turbulence_noise_speed_random = 0.5
	mat.turbulence_noise_scale = 4.0
	mat.turbulence_influence_min = 0.1
	mat.turbulence_influence_max = 0.4

	process_material = mat

	# Particle settings
	amount = 20
	lifetime = 4.0
	speed_scale = 0.6
	randomness = 0.3
	fixed_fps = 30

	# Use a simple white circle as the texture (will be tinted by color)
	var img = Image.create(32, 32, false, Image.FORMAT_RGBA8)
	var center = Vector2(16, 16)
	for x in range(32):
		for y in range(32):
			var dist = Vector2(x, y).distance_to(center)
			if dist < 16.0:
				var alpha = clampf(1.0 - (dist / 16.0), 0.0, 1.0)
				alpha = alpha * alpha  # softer falloff
				img.set_pixel(x, y, Color(1, 1, 1, alpha))
			else:
				img.set_pixel(x, y, Color(0, 0, 0, 0))
	texture = ImageTexture.create_from_image(img)
