extends Control

@onready var header_label: Label = %HeaderLabel
@onready var body_label: RichTextLabel = %BodyLabel
@onready var option_container: VBoxContainer = %OptionContainer
@onready var character_portrait: TextureRect = %CharacterPortrait

var _target: String = ""
var _event_id: String = ""
var _advance_on_exit = false


func _ready() -> void:
	GameManager.play_daily_bgm()
	_target = str(GameManager.pop_transient("interaction_target", ""))
	_event_id = str(GameManager.pop_transient("interaction_event", ""))
	_advance_on_exit = bool(GameManager.pop_transient("advance_time_after_scene", false))

	if _event_id != "":
		_show_invitation_event(_event_id)
		return

	match _target:
		"naru":
			_show_naru_interaction()
		"adam":
			_show_adam_interaction()
		"kirara":
			_show_kirara_interaction()
		_:
			_set_portrait("")
			header_label.text = "交流"
			body_label.text = "誰もいない。"


func _show_naru_interaction() -> void:
	header_label.text = "なるの店"
	_set_portrait("naru")
	var count = int(EventFlags.get_value("visit_naru_count", 0))
	EventFlags.set_value("visit_naru_count", count + 1)

	if not EventFlags.get_flag("ch1_naru_met"):
		EventFlags.set_flag("ch1_naru_met")
		AffinityManager.set_met("naru")
		RivalIntel.add_intel("naru", "flavor_genre", "お菓子系")
		body_label.text = "なる「お前、チルハウスの人間？ スミさんのとこの？」\nなる「俺、ケムリクサでバイトしてる鳴切。大会で会うなら、今のうちに仲良くしとこうぜ」"
		_clear_options()
		_add_option("LIME交換する", "exchange_lime", "naru")
		_add_option("また今度", "none")
		return

	if count == 1:
		body_label.text = "なる「最近チョコ系ばっか練習してるわ」"
		RivalIntel.add_intel("naru", "flavor_detail", "チョコレート＋バニラ")
		AffinityManager.add_affinity("naru", 5)
		return

	body_label.text = "なる「本番まであと少しだな」"
	AffinityManager.add_affinity("naru", 1)


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
		body_label.text = "棚にはダブルアップルしかない。\nアダム「……何か用か」\nアダム「他は要らない。これだけで十分だ」"
		return

	if count == 1 and not AffinityManager.has_lime("adam"):
		body_label.text = "アダム「……LIME、交換するか」"
		_clear_options()
		_add_option("交換する", "exchange_lime", "adam")
		_add_option("遠慮する", "none")
		return

	body_label.text = "アダム「ダブルアップル」"
	AffinityManager.add_affinity("adam", 1)


func _show_kirara_interaction() -> void:
	header_label.text = "きららのお店"
	_set_portrait("kirara")
	var count = int(EventFlags.get_value("visit_kirara_count", 0))
	EventFlags.set_value("visit_kirara_count", count + 1)

	if not EventFlags.get_flag("ch1_kirara_met"):
		EventFlags.set_flag("ch1_kirara_met")
		AffinityManager.set_met("kirara")
		RivalIntel.add_intel("kirara", "flavor_genre", "映え系フルーツ")
		body_label.text = "きらら「あら、チルハウスの子？ いらっしゃい♪」\nきらら「可愛いだけで勝てるほど大会は甘くないの。だから見せ方も味も、両方本気で作ってる」"
		_clear_options()
		_add_option("LIME交換する", "exchange_lime", "kirara")
		_add_option("また今度", "none")
		return

	if count == 1:
		body_label.text = "きらら「SNSのフォロワー？ 努力で増やしたに決まってるでしょ」"
		RivalIntel.add_intel("kirara", "presentation", "一般投票特化")
		AffinityManager.add_affinity("kirara", 3)
		return

	body_label.text = "きらら「大会、楽しみね」"
	AffinityManager.add_affinity("kirara", 1)


func _show_invitation_event(event_id: String) -> void:
	header_label.text = "交流イベント"
	match event_id:
		"interaction_naru_night_01":
			_set_portrait("naru")
			body_label.text = "なるの新作ミックスを一緒に試した。率直な感想を伝えた。"
			AffinityManager.add_affinity("naru", 4)
			PlayerData.add_stat("insight", 2)
			GameManager.log_stat_change("insight", 2)
		"interaction_kirara_noon_01":
			_set_portrait("kirara")
			body_label.text = "きららのお店でシーシャを作る姿を見た。映えだけじゃない丁寧さに驚いた。"
			AffinityManager.add_affinity("kirara", 4)
			PlayerData.add_stat("charm", 2)
			GameManager.log_stat_change("charm", 2)
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
