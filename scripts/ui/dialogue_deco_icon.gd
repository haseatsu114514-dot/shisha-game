extends Control

@export_enum("hookah", "flame") var icon_kind: String = "hookah"
@export var icon_color: Color = Color("f1c96d")
@export var glow_color: Color = Color("fff2d1")


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _draw() -> void:
	match icon_kind:
		"flame":
			_draw_flame()
		_:
			_draw_hookah()


func _draw_hookah() -> void:
	var w = size.x
	var h = size.y
	if w <= 0.0 or h <= 0.0:
		return
	var cx = w * 0.42
	var top = h * 0.12
	var bowl_y = h * 0.27
	var stem_bottom = h * 0.64
	var base_center = Vector2(cx, h * 0.76)
	var stroke = maxf(2.0, minf(w, h) * 0.035)

	draw_line(Vector2(cx, top), Vector2(cx, stem_bottom), icon_color, stroke, true)
	draw_line(Vector2(cx - w * 0.10, bowl_y), Vector2(cx + w * 0.10, bowl_y), icon_color, stroke, true)
	draw_line(Vector2(cx - w * 0.05, top), Vector2(cx + w * 0.05, top), glow_color, stroke * 0.7, true)
	draw_line(Vector2(cx - w * 0.04, stem_bottom), Vector2(cx + w * 0.04, stem_bottom), icon_color, stroke, true)

	draw_arc(base_center, w * 0.14, PI * 0.05, PI * 0.95, 24, icon_color, stroke, true)
	draw_arc(base_center + Vector2(0, h * 0.06), w * 0.22, PI * 1.03, PI * 1.97, 28, icon_color, stroke, true)
	draw_line(Vector2(cx - w * 0.20, h * 0.88), Vector2(cx + w * 0.22, h * 0.88), icon_color, stroke, true)

	var hose_start = Vector2(cx + w * 0.08, h * 0.46)
	var hose_mid = Vector2(w * 0.78, h * 0.42)
	var hose_end = Vector2(w * 0.70, h * 0.86)
	draw_arc(hose_mid, w * 0.20, PI * 0.92, PI * 1.72, 24, icon_color, stroke, true)
	draw_line(Vector2(w * 0.66, h * 0.78), hose_end, icon_color, stroke, true)
	draw_line(hose_start, Vector2(w * 0.62, h * 0.38), icon_color, stroke, true)
	draw_line(hose_end, Vector2(w * 0.82, h * 0.88), glow_color, stroke * 0.7, true)


func _draw_flame() -> void:
	var w = size.x
	var h = size.y
	if w <= 0.0 or h <= 0.0:
		return
	var outer := PackedVector2Array([
		Vector2(w * 0.50, h * 0.08),
		Vector2(w * 0.72, h * 0.40),
		Vector2(w * 0.64, h * 0.74),
		Vector2(w * 0.50, h * 0.92),
		Vector2(w * 0.34, h * 0.76),
		Vector2(w * 0.26, h * 0.48),
	])
	draw_colored_polygon(outer, icon_color)
	var inner := PackedVector2Array([
		Vector2(w * 0.54, h * 0.34),
		Vector2(w * 0.62, h * 0.56),
		Vector2(w * 0.50, h * 0.78),
		Vector2(w * 0.40, h * 0.58),
	])
	draw_colored_polygon(inner, glow_color)
