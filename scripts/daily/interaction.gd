extends Control

@onready var header_label: Label = %HeaderLabel
@onready var body_label: RichTextLabel = %BodyLabel
@onready var option_container: VBoxContainer = %OptionContainer
@onready var character_portrait: TextureRect = %CharacterPortrait

var _target: String = ""
var _event_id: String = ""
var _advance_on_exit = false


func _ready() -> void:
	_target = str(GameManager.pop_transient("interaction_target", ""))
	_event_id = str(GameManager.pop_transient("interaction_event", ""))
	_advance_on_exit = bool(GameManager.pop_transient("advance_time_after_scene", false))

	if _event_id != "":
		_show_invitation_event(_event_id)
		return

	match _target:
		"nishio":
			_show_nishio_interaction()
		"adam":
			_show_adam_interaction()
		"ryuji":
			_show_ryuji_interaction()
		_:
			_set_portrait("")
			header_label.text = "交流"
			body_label.text = "誰もいない。"


func _show_nishio_interaction() -> void:
	header_label.text = "にしおの店"
	_set_portrait("nishio")
	var count = int(EventFlags.get_value("visit_nishio_count", 0))
	EventFlags.set_value("visit_nishio_count", count + 1)

	if not EventFlags.get_flag("ch1_nishio_met"):
		EventFlags.set_flag("ch1_nishio_met")
		AffinityManager.set_met("nishio")
		RivalIntel.add_intel("nishio", "flavor_genre", "お菓子系")
		body_label.text = "にしお「チルハウスのやつじゃん。偵察かよ笑」"
		_clear_options()
		_add_option("LIME交換する", "exchange_lime", "nishio")
		_add_option("また今度", "none")
		return

	if count == 1:
		body_label.text = "にしお「最近チョコ系ばっか練習してるわ」"
		RivalIntel.add_intel("nishio", "flavor_detail", "チョコレート＋バニラ")
		AffinityManager.add_affinity("nishio", 5)
		return

	body_label.text = "にしお「本番まであと少しだな」"
	AffinityManager.add_affinity("nishio", 1)


func _show_adam_interaction() -> void:
	header_label.text = "アダムの店"
	_set_portrait("adam")
	var count = int(EventFlags.get_value("visit_adam_count", 0))
	EventFlags.set_value("visit_adam_count", count + 1)

	if not EventFlags.get_flag("ch1_adam_met"):
		EventFlags.set_flag("ch1_adam_met")
		AffinityManager.set_met("adam")
		RivalIntel.add_intel("adam", "flavor_genre", "double_apple")
		RivalIntel.add_intel("adam", "flavor_detail", "double_apple_only")
		body_label.text = "棚にダブルアップルしかない。\nアダム「…何か用か」"
		return

	if count == 1 and not AffinityManager.has_lime("adam"):
		body_label.text = "アダム「……LIME、交換するか」"
		_clear_options()
		_add_option("交換する", "exchange_lime", "adam")
		_add_option("遠慮する", "none")
		return

	body_label.text = "アダム「ダブルアップル」"
	AffinityManager.add_affinity("adam", 1)


func _show_ryuji_interaction() -> void:
	header_label.text = "リュウジの店"
	_set_portrait("ryuji")
	var count = int(EventFlags.get_value("visit_ryuji_count", 0))
	EventFlags.set_value("visit_ryuji_count", count + 1)

	if not EventFlags.get_flag("ch1_ryuji_met"):
		EventFlags.set_flag("ch1_ryuji_met")
		AffinityManager.set_met("ryuji")
		AffinityManager.exchange_lime("ryuji")
		AffinityManager.add_affinity("ryuji", 10)
		RivalIntel.add_intel("ryuji", "flavor_genre", "パッキング重視")
		body_label.text = "リュウジ「仲間じゃねえか！！ 連絡先交換しようぜ！！」"
		return

	if count == 1:
		body_label.text = "リュウジ「炭の置き方で味が変わるんだ！！」"
		RivalIntel.add_intel("ryuji", "presentation", "熱量プレゼン")
		AffinityManager.add_affinity("ryuji", 3)
		return

	body_label.text = "リュウジ「大会で会おうぜ！！」"
	AffinityManager.add_affinity("ryuji", 1)


func _show_invitation_event(event_id: String) -> void:
	header_label.text = "交流イベント"
	match event_id:
		"interaction_nishio_night_01":
			_set_portrait("nishio")
			body_label.text = "にしおの新作ミックスを一緒に試した。率直な感想を伝えた。"
			AffinityManager.add_affinity("nishio", 4)
			PlayerData.add_stat("insight", 2)
			GameManager.log_stat_change("insight", 2)
		"interaction_ryuji_noon_01":
			_set_portrait("ryuji")
			body_label.text = "リュウジとパッキング勝負をした。勢いで押し切られた。"
			AffinityManager.add_affinity("ryuji", 4)
			PlayerData.add_stat("technique", 2)
			GameManager.log_stat_change("technique", 2)
		_:
			_set_portrait("")
			body_label.text = "交流イベントを実行した。"


func _add_option(text: String, action: String, arg: String = "") -> void:
	var button = Button.new()
	button.text = text
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.pressed.connect(_on_option_pressed.bind(action, arg))
	option_container.add_child(button)


func _on_option_pressed(action: String, arg: String) -> void:
	match action:
		"exchange_lime":
			AffinityManager.exchange_lime(arg)
			body_label.text += "\nLIMEを交換した。"
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
	if _advance_on_exit:
		CalendarManager.advance_time()
	if CalendarManager.current_time == "midnight":
		get_tree().change_scene_to_file("res://scenes/daily/night_end.tscn")
		return
	get_tree().change_scene_to_file("res://scenes/daily/map.tscn")
