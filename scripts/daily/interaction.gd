extends Node

# Interaction Controller
# Orchestrates dialogue sequences and scene transitions.

var dialogue_box_scene = preload("res://scenes/ui/dialogue_box.tscn")
var current_dialogue_box = null

func start_interaction(event_id):
	var event_data = EventManager.get_event(event_id)
	if !event_data: return
	
	current_dialogue_box = dialogue_box_scene.instance()
	add_child(current_dialogue_box)
	
	for step in event_data.steps:
		yield(play_step(step), "completed")
	
	current_dialogue_box.queue_free()
	finish_interaction(event_id)

func play_step(step):
	match step.type:
		"dialogue":
			current_dialogue_box.display_dialogue(step.character, step.text, step.get("side", "left"))
			yield(current_dialogue_box, "dialogue_finished")
		"choice":
			current_dialogue_box.show_choices(step.choices)
			var index = yield(current_dialogue_box, "choice_selected")
			# Handle choice consequences
			handle_choice(step.consequences[index])
		"background":
			# Change background scene
			pass

func handle_choice(consequence):
	if consequence.has("affinity"):
		AffinityManager.add_affinity(consequence.character, consequence.affinity)
	if consequence.has("stat"):
		PlayerData.add_stat(consequence.stat, consequence.value)

func finish_interaction(event_id):
	# Transition back to map or next event
	SceneManager.goto_scene("res://scenes/daily/map.tscn")
