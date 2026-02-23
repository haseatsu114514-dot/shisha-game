extends Control

@onready var header_label: Label = %HeaderLabel
@onready var body_label: RichTextLabel = %BodyLabel
@onready var option_container: VBoxContainer = %OptionContainer
@onready var character_portrait: TextureRect = %CharacterPortrait

var _target: String = ""
var _is_working: bool = false
var _advance_on_exit: bool = false
var _pending_confession: String = ""
var _event_id: String = ""

const CHARACTER_NAME_MAP := {
	"naru": "なる",
	"adam": "アダム",
	"minto": "みんと",
	"sumi": "スミさん",
}


func _ready() -> void:
	GameManager.play_daily_bgm()
	_target = str(GameManager.pop_transient("interaction_target", ""))
	_event_id = str(GameManager.pop_transient("interaction_event", ""))
	_advance_on_exit = bool(GameManager.pop_transient("advance_time_after_scene", false))

	if _event_id != "":
		_show_invitation_event(_event_id)
		return

	# Rival shop visits now auto-launch dialogue events
	if _target in ["naru", "adam", "minto"]:
		_launch_rival_dialogue(_target)
		return

	if _target != "":
		_set_portrait("")
		header_label.text = "交流"
		body_label.text = "誰もいない。"


func _launch_rival_dialogue(rival_id: String) -> void:
	var count = int(EventFlags.get_value("visit_%s_count" % rival_id, 0))
	
	# Block naru visits in Chapter 1 after 3 visits (Affinity 3) or in Chapter 2/3 (training journey)
	if rival_id == "naru":
		if (GameManager.current_chapter == 1 and count >= 3) or (GameManager.current_chapter in [2, 3]):
			_set_portrait("")
			header_label.text = "ケムリクサ"
			if GameManager.current_chapter == 1:
				body_label.text = "店員「あー、今日なるさんは出勤してないっすね」\n\n（今日はいないようだ。他を回ろう）"
			else:
				body_label.text = "店員「あー、店長なら『自分のシーシャを見つめ直す』とか言って、いま遠くに修行の旅に出てるっすよ」\n\n（しばらく店には戻らないらしい。他を回ろう）"
			_add_option("戻る", "none")
			# Undo action cost
			CalendarManager.undo_action()
			_advance_on_exit = false
			return

	# Increment visit count
	EventFlags.set_value("visit_%s_count" % rival_id, count + 1)

	# Set met flag and intel on first visit
	if not EventFlags.get_flag("ch1_%s_met" % rival_id):
		EventFlags.set_flag("ch1_%s_met" % rival_id)
		AffinityManager.set_met(rival_id)
		match rival_id:
			"naru":
				RivalIntel.add_intel("naru", "flavor_genre", "お菓子系")
			"adam":
				RivalIntel.add_intel("adam", "flavor_genre", "double_apple")
				RivalIntel.add_intel("adam", "flavor_detail", "double_apple_only")
			"minto":
				RivalIntel.add_intel("minto", "flavor_genre", "映え系フルーツ")

	# Pick dialogue and metadata based on visit count
	var dialogue_file = "res://data/dialogue/ch1_%s.json" % rival_id
	var dialogue_id = ""
	var metadata: Dictionary = {}
	
	match rival_id:
		"naru":
			metadata["bg"] = "res://assets/backgrounds/kemurikusa.png"
		"adam":
			metadata["bg"] = "res://assets/backgrounds/eden.png"
		"minto":
			metadata["bg"] = "res://assets/backgrounds/pepermint.png"

	if count == 0:
		dialogue_id = "ch1_%s_first" % rival_id
		# Naru and Kirara exchange LIME on first visit
		if rival_id in ["naru", "minto"]:
			metadata["exchange_lime"] = rival_id
		metadata["add_affinity"] = {rival_id: 1}
	elif count == 1:
		dialogue_id = "ch1_%s_second" % rival_id
		# Adam exchanges LIME on second visit
		if rival_id == "adam":
			metadata["exchange_lime"] = rival_id
		metadata["add_affinity"] = {rival_id: 1}
		# Add intel on second visit
		match rival_id:
			"naru":
				metadata["add_intel"] = [{"id": "naru", "key": "flavor_detail", "value": "チョコレート＋バニラ"}]
			"minto":
				metadata["add_intel"] = [{"id": "minto", "key": "presentation", "value": "一般投票特化"}]
	elif count == 2:
		dialogue_id = "ch1_%s_third" % rival_id
		metadata["add_affinity"] = {rival_id: 1}
	elif count == 3:
		dialogue_id = "ch1_%s_fourth" % rival_id
		metadata["add_affinity"] = {rival_id: 1}
	else:
		dialogue_id = "ch1_%s_fifth" % rival_id
		metadata["add_affinity"] = {rival_id: 1}
		match rival_id:
			"minto":
				metadata["add_equipment"] = [{"slot_type": "bowl", "value": "suyaki_minto"}]
			"adam":
				metadata["add_equipment"] = [{"slot_type": "bowl", "value": "suyaki_adam"}]
			"naru":
				metadata["add_equipment"] = [{"slot_type": "bowl", "value": "suyaki_naru"}]

	# Queue dialogue and go to dialogue scene
	var return_scene = "res://scenes/daily/map.tscn"
	GameManager.queue_dialogue(dialogue_file, dialogue_id, return_scene, metadata)
	GameManager.set_transient("advance_time_after_scene", true)
	get_tree().change_scene_to_file("res://scenes/dialogue/dialogue_box.tscn")


func _show_invitation_event(event_id: String) -> void:
	header_label.text = "交流イベント"
	match event_id:
		"interaction_naru_night_01":
			_set_portrait("naru")
			body_label.text = "なるのテストランに付き合った。新しいミックスを吸わせてもらった。"
			_apply_affinity_gain("naru")
			PlayerData.add_stat("insight", 2)
			GameManager.log_stat_change("insight", 2)
			_apply_flavor_specialty_gain({"sweet": 2, "special": 1})
		"interaction_kirara_noon_01":
			_set_portrait("minto")
			body_label.text = "みんと(みんと)のお店でシーシャを吸った。可愛いだけじゃない丁寧さに驚いた。"
			_apply_affinity_gain("minto")
			PlayerData.add_stat("charm", 2)
			GameManager.log_stat_change("charm", 2)
			_apply_flavor_specialty_gain({"floral": 2, "fruit": 1})
		_:
			_set_portrait("")
			body_label.text = "交流イベントを実行した。"


func _apply_flavor_specialty_gain(gains: Dictionary) -> void:
	if gains.is_empty():
		return
	var parts: Array[String] = []
	for category_id in PlayerData.FLAVOR_SPECIALTY_KEYS:
		if not gains.has(category_id):
			continue
		var amount = int(gains.get(category_id, 0))
		if amount == 0:
			continue
		PlayerData.add_flavor_specialty(category_id, amount)
		parts.append("%s %+d" % [PlayerData.get_flavor_specialty_label(category_id), amount])
	if parts.is_empty():
		return
	body_label.text += "\n得意フレーバー: " + ", ".join(parts)


func _apply_affinity_gain(character_id: String, amount: int = 1) -> void:
	var before = AffinityManager.get_affinity(character_id)
	var after = AffinityManager.add_affinity(character_id, amount)
	if after < 0:
		return
	var delta = maxi(0, after - before)
	var max_level = AffinityManager.get_max_level()
	var star_text = AffinityManager.get_star_text(character_id)
	if delta > 0:
		body_label.text += "\n好感度 +%d / %d  %s" % [delta, max_level, star_text]
	else:
		body_label.text += "\n好感度 %d / %d  %s" % [after, max_level, star_text]

	# Check if affinity reached max level and not in romance yet
	if after >= max_level and before < max_level and not AffinityManager.is_in_romance(character_id):
		# Only certain characters have confession events (minto, tsumugi, ageha)
		if character_id in ["minto", "tsumugi", "ageha"]:
			_pending_confession = character_id


func _append_character_flavor_hint(character_id: String) -> void:
	var labels: Array[String] = PlayerData.get_character_flavor_top_labels(character_id, 2)
	if labels.is_empty():
		return
	body_label.text += "\n%sの得意: %s" % [str(CHARACTER_NAME_MAP.get(character_id, character_id)), " / ".join(labels)]


func _add_option(text: String, action: String, arg: String = "") -> void:
	var button = Button.new()
	button.text = text
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.pressed.connect(_on_option_pressed.bind(action, arg))
	option_container.add_child(button)


func _on_option_pressed(action: String, _arg: String) -> void:
	match action:
		"none":
			body_label.text += "\n少し話して店を出た。"
	_clear_options()


func _clear_options() -> void:
	for child in option_container.get_children():
		child.queue_free()


func _set_portrait(character_id: String) -> void:
	if character_id == "":
		character_portrait.texture = null
		return
	var path = "res://assets/sprites/characters/chr_%s_normal.png" % character_id
	if not ResourceLoader.exists(path):
		character_portrait.texture = null
		return
	var tex = load(path)
	character_portrait.texture = tex


func _on_back_button_pressed() -> void:
	if _pending_confession != "":
		# Queue the confession dialogue and go there instead of returning
		var event_file = "res://data/dialogue/confession.json"
		var event_id = "confession_%s" % _pending_confession
		# Set return scene based on what time it will be after advancing time
		var return_scene = "res://scenes/daily/map.tscn"
		if _advance_on_exit and CalendarManager.current_time == "midnight":
			return_scene = "res://scenes/daily/night_end.tscn"
		elif not _advance_on_exit and CalendarManager.current_time == "midnight":
			return_scene = "res://scenes/daily/night_end.tscn"
		
		# Important: We advance time before leaving interaction if needed
		if _advance_on_exit:
			CalendarManager.advance_time()
			
		GameManager.queue_dialogue(event_file, event_id, return_scene)
		get_tree().change_scene_to_file("res://scenes/dialogue/dialogue_box.tscn")
		return

	if _advance_on_exit:
		CalendarManager.advance_time()
	if CalendarManager.current_time == "midnight":
		get_tree().change_scene_to_file("res://scenes/daily/night_end.tscn")
		return
	get_tree().change_scene_to_file("res://scenes/daily/map.tscn")
