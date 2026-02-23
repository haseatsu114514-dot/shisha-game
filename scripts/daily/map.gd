extends Control

# Map Screen Controller
# Manages movement between locations and triggers interactions.

onready var markers_container = $Markers

var locations = {
	"tonari": {"name": "tonari", "pos": Vector2(100, 200)},
	"kemurikusa": {"name": "ケムリクサ", "pos": Vector2(400, 150)},
	"peppermint": {"name": "ぺぱーみんと", "pos": Vector2(300, 450)}
}

func _ready():
	refresh_map()

func refresh_map():
	for child in markers_container.get_children():
		child.queue_free()
	
	for loc_id in locations:
		var loc = locations[loc_id]
		var btn = Button.new()
		btn.text = loc.name
		btn.rect_position = loc.pos
		btn.connect("pressed", self, "_on_location_selected", [loc_id])
		markers_container.add_child(btn)
		
		# Check if characters are at this location
		var chars_here = CharacterManager.get_characters_at(loc_id)
		for char_id in chars_here:
			var icon = Sprite.new()
			# icon.texture = load("res://assets/ui/marker_icon.png")
			icon.position = Vector2(0, -30) # Above button
			btn.add_child(icon)

func _on_location_selected(loc_id):
	# Progress time
	TimeManager.advance_time(1)
	
	# Check for primary interaction
	var event_id = EventManager.get_available_event(loc_id)
	if event_id != "":
		start_event(event_id)
	else:
		# Just travel there
		travel_to(loc_id)

func start_event(event_id):
	SceneManager.goto_scene("res://scenes/daily/interaction.tscn", {"event_id": event_id})

func travel_to(loc_id):
	# Generic travel logic
	pass
