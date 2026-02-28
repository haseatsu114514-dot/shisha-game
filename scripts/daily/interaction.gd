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
	"minto": "眠都",
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
	if _target in ["naru", "adam", "minto", "ageha", "tsumugi", "kumicho", "volk"]:
		if AffinityManager.is_in_romance(_target):
			_show_romance_date(_target)
			return
		_launch_rival_dialogue(_target)
		return

	if _target != "":
		_set_portrait("")
		header_label.text = "交流"
		body_label.text = "誰もいない。"


func _show_romance_date(char_id: String) -> void:
	_set_portrait(char_id)
	header_label.text = "デート"
	
	var affection = AffinityManager.get_affection(char_id)
	var next_affection = AffinityManager.add_affection(char_id, 1)
	
	var lines: Array[String] = []
	if char_id == "minto":
		if affection == 0:
			lines.append("みんちゃんをお茶に誘った。")
			lines.append("「あ、えと……はじめくん。今日は、その……よろしくね」")
			lines.append("お店のキャピキャピした態度とは打って変わって、私服のみんちゃんはとても内気でもじもじしている。\n「あ、ええっと、私、普通にしてるとこんな感じで……がっかり、した……？」\n「いや、新鮮で可愛いなって」\n「か、かかかわいいって……！ もー、からかわないでよぉ……」")
		elif affection <= 2:
			lines.append("みんちゃんとショッピングに出かけた。")
			lines.append("「はじめくん、あの、これ……どうかな？ この服……変じゃ、ない？」")
			lines.append("自信なさげに聞いてくる彼女に「すごく綺麗なお姉さんみたいだよ」とわざと年齢を意識させるようにいじってみる。\n「お、お姉さん……っ！？ 違うもん、みんちゃんは永遠のハタチなんだもん……！ はじめくんのいじわる……でも、似合ってるなら、これにする……」\n耳を真っ赤にして俯く姿が愛らしい。")
		elif affection <= 4:
			lines.append("みんちゃんと夜の公園を歩いた。")
			lines.append("「……はじめくんの手、あったかい。お店を守るためにずっと気を張ってたけど……私、ほんとはすごく臆病だから……」")
			lines.append("「こうしてはじめくんと一緒にいると、やっと息ができる気がするの。……ねえ、もうちょっとだけ、手……繋いでて、いい……？」\nもじもじと上目遣いで聞いてくる彼女の手を、しっかりと握り返した。")
		else:
			lines.append("みんちゃんの休日。二人きりでゆっくり過ごしている。")
			lines.append("「……はじめくん、えへへ……。私、あなたといる時が、一番素の私でいられるよ。もう強がらなくていいんだって……思えるの」")
			lines.append("「外では完璧な『みんちゃん』を演じてるけど……はじめくんの前では、ただの『しおり』でいさせて。……だめ、かな？」\n不安そうに、でも期待を込めてもじもじと擦り寄ってくる彼女を、優しく抱きしめた。")
	elif char_id == "ageha":
		if affection == 0:
			lines.append("アゲハをカフェに誘った。")
			lines.append("「おっ、ハジメっちから誘ってくるなんてワンチャン雪降るんじゃない？ ウソウソｗ」")
			lines.append("「せっかくウチら彼氏彼女になったんだし、もっと特等席の彼氏くんのこと、タピるレベルで甘やかしてあげるから覚悟しなっ♡」")
		elif affection <= 2:
			lines.append("アゲハとショッピングデートをしている。")
			lines.append("「ねーハジメっち、手繋いで歩こ？ ……って、ガチで照れてるしウケるー！」")
			lines.append("「でもそういう初心（うぶ）なところもマジ推せるわ〜。ほら、手出して？ これからウチがエスコートしてあげるから♡」")
		else:
			lines.append("アゲハと二人きりで夜景を見ている。")
			lines.append("「……なんかさ、マジでウチどうしちゃったんだろう。ハジメっちの顔見てるだけで、気持ち上がりすぎて胸の奥がぎゅってなる……」")
			lines.append("「……ねえ、もう帰んないでよ。ウチの特等席、一生キミだけのものにしてあげるからさ……責任、取ってよね？」\n普段のギャルっぽい飄々とした態度はどこへやら、彼女の甘えたような声が夜風に溶けた。")
	else:
		lines.append("二人で楽しい時間を過ごした。愛情が少し深まった気がする。")

	body_label.text = "\n".join(lines)
	if next_affection > affection:
		body_label.text += "\n\n愛情度上昇！ (Lv. %d)" % next_affection
	else:
		body_label.text += "\n\n愛情度 (MAX_Lv. 5)"

	_add_option("ゆっくり過ごす", "none")


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
	var prefix = "ch1_"
	var dialogue_file = "res://data/dialogue/ch1_%s.json" % rival_id
	if rival_id == "ageha":
		prefix = "ch2_"
		dialogue_file = "res://data/dialogue/ch2_ageha.json"
	elif rival_id == "kumicho":
		prefix = "ch2_"
		dialogue_file = "res://data/dialogue/ch2_kumicho.json"
	elif rival_id == "volk":
		prefix = "ch2_"
		dialogue_file = "res://data/dialogue/ch2_volk.json"
		
	var dialogue_id = ""
	var metadata: Dictionary = {}
	
	match rival_id:
		"naru":
			metadata["bg"] = "res://assets/backgrounds/kemurikusa.png"
		"adam":
			metadata["bg"] = "res://assets/backgrounds/eden.png"
		"minto":
			metadata["bg"] = "res://assets/backgrounds/pepermint.png"
		"ageha":
			metadata["bg"] = "res://assets/backgrounds/pepermint.png" # アゲハの居場所に合わせて背景を設定
		"kumicho":
			metadata["bg"] = "res://assets/backgrounds/kanzaki_tobacco.png"
		"volk":
			metadata["bg"] = "res://assets/backgrounds/zheleznyi_dym.png"

	# === 大会後・初訪問ルーティング（共通）===
	# 大会で顔は合わせているので驚かない。ch1訪問済みかどうかで関係深度を分岐する。

	# みんと: ch2以降・大会後初訪問（visited=ch1週に1回以上訪問）
	if rival_id == "minto" and GameManager.current_chapter >= 2 and not EventFlags.get_flag("ch1_minto_after_ch1_done"):
		var visited_before = count > 0
		dialogue_id = "ch1_minto_after_ch1" if visited_before else "ch1_minto_after_ch1_firstshop"
		metadata["add_affinity"] = {"minto": 1}
		GameManager.queue_dialogue(dialogue_file, dialogue_id, "res://scenes/daily/map.tscn", metadata)
		GameManager.set_transient("advance_time_after_scene", true)
		get_tree().change_scene_to_file("res://scenes/dialogue/dialogue_box.tscn")
		return

	# アダム: ch2以降・大会後初訪問
	if rival_id == "adam" and GameManager.current_chapter >= 2 and not EventFlags.get_flag("ch1_adam_after_ch1_done"):
		var visited_before = count > 0
		dialogue_id = "ch1_adam_after_ch1" if visited_before else "ch1_adam_after_ch1_firstshop"
		metadata["add_affinity"] = {"adam": 1}
		GameManager.queue_dialogue(dialogue_file, dialogue_id, "res://scenes/daily/map.tscn", metadata)
		GameManager.set_transient("advance_time_after_scene", true)
		get_tree().change_scene_to_file("res://scenes/dialogue/dialogue_box.tscn")
		return

	# なる: ch4以降（ch2-3は武者修行中で不在）・帰還後初訪問
	if rival_id == "naru" and GameManager.current_chapter >= 4 and not EventFlags.get_flag("ch1_naru_after_return_done"):
		var visited_before = count > 0
		dialogue_id = "ch1_naru_after_return" if visited_before else "ch1_naru_after_return_firstshop"
		metadata["add_affinity"] = {"naru": 1}
		GameManager.queue_dialogue(dialogue_file, dialogue_id, "res://scenes/daily/map.tscn", metadata)
		GameManager.set_transient("advance_time_after_scene", true)
		get_tree().change_scene_to_file("res://scenes/dialogue/dialogue_box.tscn")
		return

	# アゲハ: ch3以降（ch2大会後）・大会後初訪問
	if rival_id == "ageha" and GameManager.current_chapter >= 3 and not EventFlags.get_flag("ch2_ageha_after_ch2_done"):
		var visited_before = count > 0
		dialogue_id = "ch2_ageha_after_ch2" if visited_before else "ch2_ageha_after_ch2_firstshop"
		metadata["add_affinity"] = {"ageha": 1}
		GameManager.queue_dialogue(dialogue_file, dialogue_id, "res://scenes/daily/map.tscn", metadata)
		GameManager.set_transient("advance_time_after_scene", true)
		get_tree().change_scene_to_file("res://scenes/dialogue/dialogue_box.tscn")
		return

	# 組長: ch3以降（ch2大会後）・大会後初訪問
	if rival_id == "kumicho" and GameManager.current_chapter >= 3 and not EventFlags.get_flag("ch2_kumicho_after_ch2_done"):
		var visited_before = count > 0
		dialogue_id = "ch2_kumicho_after_ch2" if visited_before else "ch2_kumicho_after_ch2_firstshop"
		metadata["add_affinity"] = {"kumicho": 1}
		GameManager.queue_dialogue(dialogue_file, dialogue_id, "res://scenes/daily/map.tscn", metadata)
		GameManager.set_transient("advance_time_after_scene", true)
		get_tree().change_scene_to_file("res://scenes/dialogue/dialogue_box.tscn")
		return

	# ヴォルク: ch3以降（ch2大会後）・大会後初訪問
	if rival_id == "volk" and GameManager.current_chapter >= 3 and not EventFlags.get_flag("ch2_volk_after_ch2_done"):
		var visited_before = count > 0
		dialogue_id = "ch2_volk_after_ch2" if visited_before else "ch2_volk_after_ch2_firstshop"
		metadata["add_affinity"] = {"volk": 1}
		GameManager.queue_dialogue(dialogue_file, dialogue_id, "res://scenes/daily/map.tscn", metadata)
		GameManager.set_transient("advance_time_after_scene", true)
		get_tree().change_scene_to_file("res://scenes/dialogue/dialogue_box.tscn")
		return

	if count == 0:
		dialogue_id = "%s%s_first" % [prefix, rival_id]
		# みんとは初回訪問でLIME交換（フレンドリーなので即交換）
		if rival_id == "minto":
			metadata["exchange_lime"] = rival_id
		metadata["add_affinity"] = {rival_id: 1}
	elif count == 1:
		dialogue_id = "%s%s_second" % [prefix, rival_id]
		# なる・アゲハは2回目の訪問でLIME交換（2回目で「まあ仕方ない」感じで教える）
		# ヴォルクは2回目でLIME交換（体温データの続きで連絡先を教える）
		if rival_id in ["naru", "ageha", "volk"]:
			metadata["exchange_lime"] = rival_id
		metadata["add_affinity"] = {rival_id: 1}
		# Add intel on second visit
		match rival_id:
			"naru":
				metadata["add_intel"] = [{"id": "naru", "key": "flavor_detail", "value": "チョコレート＋バニラ"}]
			"minto":
				metadata["add_intel"] = [{"id": "minto", "key": "presentation", "value": "一般投票特化"}]
	elif count == 2:
		dialogue_id = "%s%s_third" % [prefix, rival_id]
		# アダムは3回目でようやくLIME交換（ガードが固いので時間がかかる）
		# 組長は3回目でLIME交換（縁ができたと判断してから）
		if rival_id in ["adam", "kumicho"]:
			metadata["exchange_lime"] = rival_id
		metadata["add_affinity"] = {rival_id: 1}
	elif count == 3:
		dialogue_id = "%s%s_fourth" % [prefix, rival_id]
		metadata["add_affinity"] = {rival_id: 1}
	else:
		dialogue_id = "%s%s_fifth" % [prefix, rival_id]
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
			_add_option("戻る", "none")
		"interaction_minto_noon_01":
			var return_scene = "res://scenes/daily/map.tscn"
			if _advance_on_exit and CalendarManager.current_time == "midnight":
				return_scene = "res://scenes/daily/night_end.tscn"
			var metadata = {"add_affinity": {"minto": 1}, "bg": "res://assets/backgrounds/cafe.png"}
			GameManager.queue_dialogue("res://data/dialogue/ch1_minto.json", "ch1_minto_private_1", return_scene, metadata)
			GameManager.set_transient("advance_time_after_scene", _advance_on_exit)
			get_tree().change_scene_to_file("res://scenes/dialogue/dialogue_box.tscn")
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
	var star_text = AffinityManager.get_star_text(character_id)
	body_label.text += "\n好感度  %s" % star_text

	# Check if affinity reached max level and not in romance yet
	if after >= AffinityManager.MAX_LEVEL and before < AffinityManager.MAX_LEVEL and not AffinityManager.is_in_romance(character_id):
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
			body_label.text += "\n少し話してその場を後にした。"
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
