extends Control

const TOTAL_STEPS := 15
const TOURNAMENT_SCENE_PATH := "res://scenes/tournament/ch1_tournament.tscn"
const MORNING_PHONE_SCENE_PATH := "res://scenes/daily/morning_phone.tscn"
const TITLE_SCENE_PATH := "res://scenes/title/title_screen.tscn"

const FLAVOR_NAME_MAP := {
	"double_apple": "アルファーヘブン ダブルアップル",
	"mint": "アルファーヘブン ミント",
	"blueberry": "アルファーヘブン ブルーベリー",
	"vanilla": "アルファーヘブン バニラ",
	"pineapple": "アルファーヘブン パイナップル",
	"coconut": "アルファーヘブン ココナッツ",
}

const ALPHA_HEAVEN_FLAVORS := ["double_apple", "mint", "blueberry", "vanilla", "pineapple", "coconut"]

const THEMES := [
	{"id": "relax", "name": "リラックス", "flavors": ["vanilla", "coconut", "pineapple"]},
	{"id": "high_heat", "name": "高火力", "flavors": ["mint", "double_apple"]},
	{"id": "fruity", "name": "フルーツ", "flavors": ["pineapple", "blueberry", "double_apple"]},
	{"id": "aftertaste", "name": "余韻", "flavors": ["vanilla", "blueberry", "coconut"]},
]

const RANDOM_JUDGES := [
	{"id": "shiramine", "name": "白峰 恒一郎", "flavors": ["vanilla", "coconut", "pineapple"]},
	{"id": "maezono", "name": "前園 壮一郎", "flavors": ["mint", "double_apple"]},
	{"id": "kirishima", "name": "霧島 レン", "flavors": ["blueberry", "pineapple"]},
]

const STANCE_PREFERENCE := {
	"toki_kotetsu": "tech",
	"shiramine": "honest",
	"maezono": "aggressive",
	"kirishima": "heart",
}

const REBUTTAL_PROMPTS := [
	{
		"question": "土岐: 火力が強すぎるんじゃないか？",
		"best": "reframe",
	},
	{
		"question": "審査員: その配合で狙いは伝わるのか？",
		"best": "front",
	},
	{
		"question": "審査員: リスクを取りすぎてないか？",
		"best": "admit",
	},
]

const REWARD_BY_RANK := {1: 30000, 2: 15000, 3: 5000, 4: 0}
const PULL_DIFFICULTY := [0.86, 1.0, 1.22, 1.06]
const TOTAL_PACKING_GRAMS := 12
const PULL_MIN_ROUNDS := 2
const PULL_MAX_ROUNDS := 6
const MIND_BARRAGE_BASE_LIVES := 3
const MIND_BARRAGE_WORST_PULL_SPEED := 2.35
const MIND_BARRAGE_MIN_SECONDS := 8.0
const MIND_BARRAGE_MAX_SECONDS := 16.0
const MIND_BARRAGE_WORDS := [
	"もっと甘くすべきだった？",
	"あいつの方が評価高そう",
	"審査員、これ嫌いじゃないか？",
	"前のラウンド、負けてるぞ",
	"「無難」に逃げた方がよかったか？",
	"前に失敗した時と同じ流れだ",
	"この配合、攻めすぎじゃないか？",
	"安全策に寄せた方がよくないか？",
	"その個性、ただの自己満足では？",
]

## 弾幕ワード: 主人公の内なる不安
const MIND_WORDS_ANXIETY := [
	"失敗したらどうしよう",
	"手が震えてる…",
	"この配合で本当に良かったのか？",
	"もっと練習すべきだった",
	"自分なんかがここにいていいのか",
	"スミさんに合わせる顔がない",
	"才能がないのかもしれない",
	"ここまで来たの、なんとなくじゃないか？",
	"もっと甘くすべきだった？",
	"安全策に寄せた方がよくないか？",
	"この配合、攻めすぎじゃないか？",
	"前に失敗した時と同じ流れだ",
	"「無難」に逃げた方がよかったか？",
	"全部中途半端なんじゃないか",
	"本気でやってるつもりなだけ？",
	"結局バイトの延長でしょ",
	"うまくいくわけがない",
	"なんで出場なんてしたんだろう",
]
## 弾幕ワード: 観客の声（主人公を不安にさせるもの）
const MIND_WORDS_AUDIENCE := [
	"この大会はアダムの優勝で決まりだな",
	"リュウジのシーシャ、すげー煙だったな",
	"にしおさんの配合、さすがだった",
	"あの新人、大丈夫かな…",
	"初出場でこの面子は厳しいでしょ",
	"アダムって海外で修行してたんだって",
	"リュウジの人気投票、断トツらしいよ",
	"にしおさん、去年も上位だったよね",
	"やっぱ経験の差が出るよな",
	"あの子の配合、ちょっと地味じゃない？",
	"土岐さんの好みとは違うタイプだよな",
	"前園審査員、甘い評価はしないぞ",
]
## 弾幕ワード: 対戦相手への畏怖
const MIND_WORDS_RIVAL := [
	"あいつの方が評価高そう",
	"審査員、これ嫌いじゃないか？",
	"前のラウンド、負けてるぞ",
	"その個性、ただの自己満足では？",
	"アダムの技術には敵わない",
	"リュウジのセンスが羨ましい",
	"にしおさんの安定感、真似できない",
	"ライバルたちは本気だ",
	"みんな自分より上手い",
]

## MCパッキーの実況コメント（ステップ番号をキーにランダム選択）
const MC_COMMENTS := {
	1: [
		"MCパッキー「さあ、まずはセッティングから！ ハガルとHMSの組み合わせ、ここが大事ですよ❤」",
		"MCパッキー「選手たちが機材を確認中。1種類で勝負する派、組み合わせで攻める派…」",
	],
	2: [
		"MCパッキー「フレーバー選択！ テーマに合わせるか、自分の得意で勝負するか」",
		"土岐「テーマの解釈に個性が出る。配合にはその人の哲学が見える」",
	],
	3: [
		"MCパッキー「パッキングの時間です！ 12gをどう配分するか」",
		"土岐「パッキングの密度、配置…全てが結果に出る」",
	],
	4: [
		"MCパッキー「アルミ穴あけ！ 等間隔で穴を開けられるかが勝負の分かれ目！」",
		"土岐「穴の開け方一つで吸い心地が変わる。丁寧に、だがリズムよく」",
	],
	5: [
		"MCパッキー「炭の準備！ フリップのタイミングが鍵です」",
	],
	6: [
		"MCパッキー「炭配置！ 何個置くかも戦略のうち」",
		"土岐「火力のコントロール…これがシーシャの脇だ」",
	],
	7: [
		"MCパッキー「蒸らしの時間です… ここは我慢比べ！」",
		"土岐「蒸らしの分数で勝負は大きく変わる」",
	],
	8: [
		"MCパッキー「吸い出し前の精神戦…！ 選手たちの心の中はどうなってるかな」",
	],
	9: [
		"MCパッキー「吸い出し！ ここで煙の質が決まります！」",
		"土岐「一口目の吸い出しがすべてを物語る」",
	],
	10: [
		"MCパッキー「提供の時間！ 審査員が吸います！」",
	],
	11: [
		"MCパッキー「調整タイム！ 吸いながら微調整できるか」",
	],
	12: [
		"MCパッキー「プレゼンテーション！ 自分のシーシャをどうアピールするか」",
		"土岐「味だけではない。見せ方にも志が要る」",
	],
	13: [
		"MCパッキー「反論タイム！ 審査員の疑問にどう答えるか！」",
	],
	14: [
		"MCパッキー「中間結果発表…！ ここまでの順位は？」",
	],
	15: [
		"MCパッキー「さあ、運命の最終発表です！」",
		"土岐「どの選手もよく戦った。だが順位はつく」",
	],
}
const TEMP_MIN := 140.0
const TEMP_MAX := 260.0
const PRESENTATION_FOCUS_OPTIONS := [
	{"id": "taste", "name": "味"},
	{"id": "smoke", "name": "煙"},
	{"id": "ease", "name": "吸いやすさ"},
	{"id": "unique", "name": "個性"},
]
const JUDGE_FOCUS_PREFERENCES := {
	"toki_kotetsu": ["taste", "smoke"],
	"shiramine": ["ease", "taste"],
	"maezono": ["smoke", "unique"],
	"kirishima": ["unique", "ease"],
}
const PRESENTATION_FOCUS_LABEL := {
	"taste": "味",
	"smoke": "煙",
	"ease": "吸いやすさ",
	"unique": "個性",
}


@onready var header_label: Label = %HeaderLabel
@onready var phase_label: Label = %PhaseLabel
@onready var info_label: RichTextLabel = %InfoLabel
@onready var choice_container: VBoxContainer = %ChoiceContainer
@onready var judge_label: Label = %JudgeLabel
@onready var score_label: RichTextLabel = %ScoreLabel
@onready var memo_label: RichTextLabel = %MemoLabel

@onready var mini_dialogue_panel: PanelContainer = %MiniDialoguePanel
@onready var mini_speaker_label: Label = %MiniSpeakerLabel
@onready var mini_text_label: RichTextLabel = %MiniTextLabel
@onready var mini_portrait: TextureRect = %MiniPortrait

@onready var status_panel = $SidePanel/SideMargin/SideVBox/StatusPanel

var _theme: Dictionary = {}
var _random_judge: Dictionary = {}
var _selected_bowl: String = ""
var _selected_hms: String = ""
var _selected_flavors: Array[String] = []
var _flavor_checks: Array[CheckBox] = []
var _packing_choice: Dictionary = {}
var _manual_packing_grams: Dictionary = {}
var _special_mix_name: String = ""
var _selected_charcoal_count: int = 3
var _steam_minutes: int = 6
var _heat_state: int = 0
var _zone_bonus: float = 0.0
var _adjustment_hits: int = 0
var _pull_round: int = 0
var _technical_points: float = 0.0
var _audience_points: float = 0.0
var _memo_bonus: float = 0.0
var _used_memo_count: int = 0
var _easy_mode: bool = false
var _pending_reward: int = 0
var _player_rank: int = 4
var _rebuttal_prompt: Dictionary = {}
var _pull_hit_count: int = 0
var _pull_quality_total: float = 0.0
var _pull_gauge_value: float = 0.5
var _pull_gauge_direction: float = 1.0
var _pull_gauge_speed: float = 1.0
var _pull_target_center: float = 0.5
var _pull_target_width: float = 0.16
var _pull_timer: Timer
var _pull_is_holding: bool = false
var _pull_step_resolved: bool = false
var _pull_hold_button: Button
var _pull_setting_hint: String = ""

var _adjust_target_action: String = ""
var _adjust_selected_action: String = ""
var _adjustment_action_count: int = 0
var _adjust_gauge_value: float = 0.5
var _adjust_gauge_direction: float = 1.0
var _adjust_gauge_speed: float = 1.0
var _adjust_target_center: float = 0.5
var _adjust_target_width: float = 0.18
var _adjust_timer: Timer
var _adjust_is_holding: bool = false
var _adjust_step_finished: bool = false
var _adjust_success_count: int = 0

var _mind_timer: Timer
var _mind_active: bool = false
var _mind_arena_layer: ColorRect
var _mind_player_node: ColorRect
var _mind_bullets: Array[Dictionary] = []
var _mind_player_pos: Vector2 = Vector2.ZERO
var _mind_player_size: Vector2 = Vector2(14, 14)
var _mind_duration_total: float = 0.0
var _mind_elapsed: float = 0.0
var _mind_spawn_cooldown: float = 0.0
var _mind_spawn_interval: float = 0.45
var _mind_hits: int = 0
var _mind_spawned: int = 0
var _mind_hit_se_cooldown: float = 0.0
var _mind_barrage_done: bool = false
var _mind_lives_max: int = MIND_BARRAGE_BASE_LIVES
var _mind_lives_remaining: int = MIND_BARRAGE_BASE_LIVES
var _mind_pull_speed_adjust: float = 0.0
var _mind_force_worst_pull_speed: bool = false
var _mind_move_left: bool = false
var _mind_move_right: bool = false
var _mind_move_up: bool = false
var _mind_move_down: bool = false
var _mind_invincible_timer: float = 0.0
var _aluminum_timer: Timer
var _aluminum_active: bool = false
var _aluminum_slot_count: int = 12
var _aluminum_required_hits: int = 6
var _aluminum_total_notes: int = 8
var _aluminum_notes: Array[Dictionary] = []
var _aluminum_notes_spawned: int = 0
var _aluminum_spawn_interval_ticks: int = 2
var _aluminum_spawn_cooldown: int = 0
var _aluminum_hit_slot: int = 0
var _aluminum_hit_perfect: int = 0
var _aluminum_hit_good: int = 0
var _aluminum_hit_near: int = 0
var _aluminum_hit_miss: int = 0
var _aluminum_bad_press: int = 0
var _packing_sliders: Dictionary = {}
var _packing_value_labels: Dictionary = {}
var _packing_remaining_label: Label
var _packing_confirm_button: Button
var _rival_mid_scores: Array = []
var _rival_final_scores: Array = []
var _mid_player_total: float = 0.0
var _mid_rival_totals: Dictionary = {}
var _presentation_primary_focus: String = ""
var _presentation_secondary_focus: String = ""

var _mini_dialogue_queue: Array[Dictionary] = []
var _mini_dialogue_on_finish: Callable
var _mini_dialogue_is_typing: bool = false
var _mini_dialogue_full_text: String = ""
var _mini_dialogue_char_index: int = 0
var _mini_dialogue_timer: Timer

const SPEAKER_NAMES := {
	"hajime": "はじめ",
	"sumi": "スミさん",
	"naru": "なる",
	"adam": "アダム",
	"minto": "眠都(みんと)",
	"takiguchi": "MC 焚口",
	"toki_kotetsu": "土岐鋼鉄",
	"maezono": "前園壮一郎"
}

func _process(_delta: float) -> void:
	if status_panel and status_panel.has_method("update_status"):
		var mapped_temp = clampf(0.5 + float(_heat_state) * 0.1, 0.0, 1.0)
		var pass_line = 0.5 - 0.1
		var top_line = 0.5 + 0.1
		var zone_text = "適温"
		if _heat_state >= 2:
			zone_text = "熱い"
		elif _heat_state <= -2:
			zone_text = "弱い"
		status_panel.update_status(mapped_temp, zone_text, _selected_charcoal_count, pass_line, top_line)

func _ready() -> void:
	randomize()
	GameManager.play_bgm(GameManager.BGM_TONARI_PATH, -8.0, true)
	_pull_timer = Timer.new()
	_pull_timer.wait_time = 0.03
	_pull_timer.one_shot = false
	_pull_timer.timeout.connect(_on_pull_gauge_tick)
	add_child(_pull_timer)
	
	_adjust_timer = Timer.new()
	_adjust_timer.wait_time = 0.03
	_adjust_timer.one_shot = false
	_adjust_timer.timeout.connect(_on_adjust_timer_tick)
	add_child(_adjust_timer)

	_aluminum_timer = Timer.new()
	_aluminum_timer.wait_time = 0.16
	_aluminum_timer.one_shot = false
	_aluminum_timer.timeout.connect(_on_aluminum_tick)
	add_child(_aluminum_timer)
	_mind_timer = Timer.new()
	_mind_timer.wait_time = 0.016
	_mind_timer.one_shot = false
	_mind_timer.timeout.connect(_on_mind_barrage_tick)
	add_child(_mind_timer)
	
	_mini_dialogue_timer = Timer.new()
	_mini_dialogue_timer.wait_time = 0.03
	_mini_dialogue_timer.one_shot = false
	_mini_dialogue_timer.timeout.connect(_on_mini_dialogue_tick)
	add_child(_mini_dialogue_timer)
	
	if GameManager.game_state != "tournament":
		GameManager.transition_to_tournament()
	_prepare_run()
	_init_cyber_effects()


func _prepare_run() -> void:
	_theme = THEMES[randi() % THEMES.size()]
	_random_judge = RANDOM_JUDGES[randi() % RANDOM_JUDGES.size()]
	_selected_bowl = PlayerData.equipment_bowl
	_selected_hms = PlayerData.equipment_hms
	_selected_flavors.clear()
	_flavor_checks.clear()
	_packing_choice.clear()
	_manual_packing_grams.clear()
	_special_mix_name = ""
	_selected_charcoal_count = 3
	_steam_minutes = 6
	_heat_state = 0
	_zone_bonus = 0.0
	_adjustment_hits = 0
	_pull_round = 0
	_pending_reward = 0
	_player_rank = 4
	_used_memo_count = 0
	_memo_bonus = 0.0
	_rebuttal_prompt = {}
	_pull_hit_count = 0
	_pull_quality_total = 0.0
	_pull_timer.stop()
	_pull_is_holding = false
	_pull_step_resolved = false
	_pull_hold_button = null
	_pull_setting_hint = ""
	_stop_mind_barrage()
	_mind_duration_total = 0.0
	_mind_elapsed = 0.0
	_mind_spawn_cooldown = 0.0
	_mind_spawn_interval = 0.45
	_mind_hits = 0
	_mind_spawned = 0
	_mind_hit_se_cooldown = 0.0
	_mind_barrage_done = false
	_mind_lives_max = MIND_BARRAGE_BASE_LIVES
	_mind_lives_remaining = MIND_BARRAGE_BASE_LIVES
	_mind_pull_speed_adjust = 0.0
	_mind_force_worst_pull_speed = false
	_aluminum_active = false
	_aluminum_notes.clear()
	_aluminum_notes_spawned = 0
	_aluminum_spawn_interval_ticks = 2
	_aluminum_spawn_cooldown = 0
	_aluminum_hit_perfect = 0
	_aluminum_hit_good = 0
	_aluminum_hit_near = 0
	_aluminum_hit_miss = 0
	_aluminum_bad_press = 0
	_aluminum_timer.stop()
	_packing_sliders.clear()
	_packing_value_labels.clear()
	_packing_remaining_label = null
	_packing_confirm_button = null
	_rival_mid_scores.clear()
	_rival_final_scores.clear()
	_mid_player_total = 0.0
	_mid_rival_totals.clear()
	_presentation_primary_focus = ""
	_presentation_secondary_focus = ""
	_easy_mode = bool(EventFlags.get_value("ch1_tournament_easy_mode", false))
	_prepare_rival_score_tables()

	_technical_points = PlayerData.stat_technique * 0.9 + PlayerData.stat_sense * 0.7 + PlayerData.stat_guts * 0.5
	_audience_points = PlayerData.stat_charm * 0.9 + PlayerData.stat_insight * 0.25
	if _easy_mode:
		_technical_points += 4.0
		_audience_points += 2.0

	PlayerData.mark_all_tournament_memos_read()
	_show_setting_step()
	_refresh_side_panel()


func _set_phase(step_num: int, title: String, body: String) -> void:
	header_label.text = title
	header_label.add_theme_color_override("font_color", GameManager.THEME_VERMILION)
	phase_label.text = "STEP %d / %d" % [step_num, TOTAL_STEPS]
	phase_label.add_theme_color_override("font_color", GameManager.THEME_AMBER_GOLD)
	info_label.text = body
	_show_round_announce(step_num, title)
	_show_mc_comment(step_num)


func _append_info(text: String) -> void:
	if text.strip_edges() == "":
		return
	if info_label.text.strip_edges() == "":
		info_label.text = text
	else:
		info_label.text += "\n\n" + text


func _clear_choices() -> void:
	_stop_mind_barrage()
	for child in choice_container.get_children():
		child.queue_free()
	_pull_timer.stop()
	_pull_is_holding = false
	_pull_hold_button = null
	_aluminum_active = false
	_aluminum_timer.stop()
	_packing_sliders.clear()
	_packing_value_labels.clear()
	_packing_remaining_label = null
	_packing_confirm_button = null


func _add_choice_button(text: String, callback: Callable) -> Button:
	var button = Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(0, 44)
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	# ダンガンロンパ風: バーミリオン×黒の大会専用スタイル
	var normal_style = StyleBoxFlat.new()
	normal_style.bg_color = Color("181425", 0.95)
	normal_style.border_color = Color("e43b44", 0.5)
	normal_style.border_width_bottom = 2
	normal_style.border_width_left = 1
	normal_style.border_width_right = 1
	normal_style.border_width_top = 1
	normal_style.corner_radius_bottom_left = 2
	normal_style.corner_radius_bottom_right = 2
	normal_style.corner_radius_top_left = 2
	normal_style.corner_radius_top_right = 2
	normal_style.content_margin_left = 16
	normal_style.content_margin_right = 16
	normal_style.content_margin_top = 8
	normal_style.content_margin_bottom = 8
	button.add_theme_stylebox_override("normal", normal_style)
	var hover_style = normal_style.duplicate()
	hover_style.bg_color = Color("e43b44", 0.25)
	hover_style.border_color = Color("e43b44", 0.9)
	hover_style.border_width_bottom = 3
	button.add_theme_stylebox_override("hover", hover_style)
	button.add_theme_color_override("font_color", GameManager.THEME_CREAM_TEXT)
	button.add_theme_color_override("font_hover_color", Color("ffffff"))
	var pressed_style = normal_style.duplicate()
	pressed_style.bg_color = Color("e43b44", 0.4)
	pressed_style.border_color = Color("e43b44")
	button.add_theme_stylebox_override("pressed", pressed_style)
	button.pressed.connect(func() -> void:
		GameManager.play_ui_se("cursor")
		callback.call()
	)
	choice_container.add_child(button)
	return button


func _show_setting_step() -> void:
	_set_phase(1, "大会セッティング", "会場入り。先にハガルとHMSを決める。\nテーマ: %s" % str(_theme.get("name", "-")))
	_clear_choices()

	_add_selector_group("ハガル", PlayerData.owned_bowls, _selected_bowl, _on_bowl_selected)
	_add_selector_group("ヒートマネジメント", PlayerData.owned_hms, _selected_hms, _on_hms_selected)

	var pairing_ok = PlayerData.is_equipment_pair_compatible(_selected_bowl, _selected_hms)
	if pairing_ok:
		_append_info("現在の組み合わせ: %s + %s" % [
			PlayerData.get_equipment_name_by_value(_selected_bowl),
			PlayerData.get_equipment_name_by_value(_selected_hms),
		])
	else:
		_append_info("現在の組み合わせは非対応。選び直して。")

	if _easy_mode:
		_append_info("難易度緩和モード: 吸い出し判定が少し広い。")

	_add_choice_button("このセッティングで開始", _on_setting_confirmed)
	_refresh_side_panel()


func _add_selector_group(title_text: String, ids: Array, selected_id: String, on_select: Callable) -> void:
	var title = Label.new()
	title.text = title_text
	title.add_theme_font_size_override("font_size", 20)
	choice_container.add_child(title)

	for raw_id in ids:
		var item_id = str(raw_id)
		var button = Button.new()
		var prefix = "●" if item_id == selected_id else "○"
		button.text = "%s %s" % [prefix, PlayerData.get_equipment_name_by_value(item_id)]
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.pressed.connect(on_select.bind(item_id))
		choice_container.add_child(button)


func _on_bowl_selected(bowl_id: String) -> void:
	_selected_bowl = bowl_id
	_show_setting_step()


func _on_hms_selected(hms_id: String) -> void:
	_selected_hms = hms_id
	_show_setting_step()


func _on_setting_confirmed() -> void:
	if _selected_bowl == "" or _selected_hms == "":
		_append_info("ハガルとHMSを選択して。")
		return
	if not PlayerData.is_equipment_pair_compatible(_selected_bowl, _selected_hms):
		_append_info("その組み合わせは非対応。")
		return

	PlayerData.equip_item("bowl", _selected_bowl)
	PlayerData.equip_item("hms", _selected_hms)
	_apply_setting_bonus()
	_refresh_side_panel()
	_show_flavor_selection_step()


func _apply_setting_bonus() -> void:
	var lines: Array[String] = []
	if _selected_bowl == "hagal_80beat":
		_technical_points += 3.0
		lines.append("80beatハガルで立ち上がり安定。")
	elif _selected_bowl == "suyaki":
		_technical_points += 1.0
		_audience_points += 2.0
		lines.append("素焼きで香りの個性が乗りやすい。")

	match _selected_hms:
		"tanukish_lid":
			_technical_points += 4.0
			_zone_bonus += 0.12
			lines.append("タヌキッシュで扱いやすさアップ。")
		"amaburst":
			_technical_points += 3.0
			_audience_points += 2.0
			_heat_state += 1
			lines.append("アマバーストで高火力寄り。")
		"winkwink_hagal":
			_technical_points += 2.0
			_heat_state -= 1
			lines.append("winkwinkで熱持ち重視。")
		_:
			_technical_points += 2.0
			lines.append("ロートスで再現性重視。")

	if not lines.is_empty():
		_append_info("\n".join(lines))
	_heat_state = clampi(_heat_state, -3, 3)


func _show_flavor_selection_step() -> void:
	_set_phase(2, "フレーバー選択", "在庫から1〜3種を選ぶ。テーマ一致でボーナス。")
	_clear_choices()
	_flavor_checks.clear()

	var available = _get_available_flavors()
	if available.is_empty():
		PlayerData.add_flavor("double_apple", 50)
		PlayerData.add_flavor("mint", 50)
		available = _get_available_flavors()
		_append_info("在庫不足のため運営配布フレーバー(50g×2)を受け取った。")

	for entry in available:
		var check = CheckBox.new()
		var flavor_id = str(entry.get("id", ""))
		check.text = "%s（残り %dg）" % [_flavor_name(flavor_id), int(entry.get("amount", 0))]
		check.set_meta("flavor_id", flavor_id)
		check.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		choice_container.add_child(check)
		_flavor_checks.append(check)

	if _flavor_checks.size() == 1:
		_flavor_checks[0].button_pressed = true

	_add_choice_button("おすすめを自動選択", _apply_recommended_flavors)
	_add_choice_button("この配合候補で進む", _confirm_flavor_selection)

	var memo_count = PlayerData.get_tournament_memos().size()
	if memo_count > 0:
		_append_info("攻略メモ %d件を参照可能。" % memo_count)

	_refresh_side_panel()


func _get_available_flavors() -> Array:
	var result: Array = []
	for raw in PlayerData.flavor_inventory:
		if typeof(raw) != TYPE_DICTIONARY:
			continue
		var amount = int(raw.get("amount", 0))
		if amount <= 0:
			continue
		result.append({
			"id": str(raw.get("id", "")),
			"amount": amount,
		})
	return result


func _apply_recommended_flavors() -> void:
	for check in _flavor_checks:
		check.button_pressed = false

	var theme_flavors: Array = _theme.get("flavors", [])
	for check in _flavor_checks:
		var flavor_id = str(check.get_meta("flavor_id"))
		if theme_flavors.has(flavor_id):
			check.button_pressed = true
		if _count_checked_flavors() >= 3:
			break

	var min_pick = mini(2, _flavor_checks.size())
	if _count_checked_flavors() < min_pick:
		for check in _flavor_checks:
			if not check.button_pressed:
				check.button_pressed = true
			if _count_checked_flavors() >= min_pick:
				break

	_append_info("テーマ寄りの候補を自動選択した。")


func _count_checked_flavors() -> int:
	var count = 0
	for check in _flavor_checks:
		if check.button_pressed:
			count += 1
	return count


func _confirm_flavor_selection() -> void:
	var selected: Array[String] = []
	for check in _flavor_checks:
		if not check.button_pressed:
			continue
		selected.append(str(check.get_meta("flavor_id")))

	if selected.is_empty():
		_append_info("最低1種は選択して。")
		return
	if selected.size() > 3:
		_append_info("フレーバーは3種まで。")
		return

	_selected_flavors = selected
	var lines: Array[String] = []

	var theme_hits = _count_theme_hits(_selected_flavors)
	if theme_hits >= 2:
		_technical_points += 10.0
		_audience_points += 8.0
		lines.append("テーマ一致で大きく加点。")
	elif theme_hits == 1:
		_technical_points += 4.0
		_audience_points += 3.0
		lines.append("テーマに部分一致。")
	else:
		_technical_points -= 4.0
		lines.append("テーマ不一致で減点。")

	if _selected_flavors.size() == 1:
		_technical_points -= 6.0
		_audience_points -= 3.0
		lines.append("単体配合のため審査が厳しくなる。")

	if (_selected_hms == "amaburst" or PlayerData.equipment_charcoal == "cube_charcoal") and _has_alpha_heaven_flavor_selected():
		_technical_points += 4.0
		_audience_points += 4.0
		lines.append("高火力×アルファーヘブン戦略が刺さった。")

	_used_memo_count = _count_matching_memos(_selected_flavors)
	if _used_memo_count > 0:
		_memo_bonus = float(_used_memo_count * 3)
		_technical_points += _memo_bonus
		lines.append("攻略メモ参照ボーナス +%d" % int(_memo_bonus))

	_append_info("\n".join(lines))
	_refresh_side_panel()
	_show_packing_step()


func _show_packing_step() -> void:
	_set_phase(3, "パッキング配合（12g）", "各フレーバーのゲージを動かして配分を決める。合計12gで確定。")
	_clear_choices()
	_ensure_manual_packing_grams()
	_packing_sliders.clear()
	_packing_value_labels.clear()

	var title = Label.new()
	title.text = "配分ゲージ（1g刻み）"
	title.add_theme_font_size_override("font_size", 20)
	choice_container.add_child(title)

	for flavor_id in _selected_flavors:
		choice_container.add_child(_build_packing_slider_row(flavor_id))

	_packing_remaining_label = Label.new()
	choice_container.add_child(_packing_remaining_label)

	_packing_confirm_button = _add_choice_button("この配合で確定", _confirm_manual_packing)
	_refresh_packing_controls()
	_show_bowl_visual()

	_refresh_side_panel()


func _update_packing_info_text() -> void:
	var total = _sum_manual_packing_grams()
	var remaining = TOTAL_PACKING_GRAMS - total
	var lines: Array[String] = []
	lines.append("現在配合: %s" % _format_pattern_grams({"grams": _manual_packing_grams}))
	lines.append("合計: %dg / %dg" % [total, TOTAL_PACKING_GRAMS])
	if remaining == 0:
		lines.append("確定可能")
	elif remaining < 0:
		lines.append("%dg 超過。12gに戻して。" % abs(remaining))
	else:
		lines.append("残り %dg を配分して。" % remaining)
	info_label.text = "\n".join(lines)


func _ensure_manual_packing_grams() -> void:
	var needs_reset = _manual_packing_grams.is_empty() or _manual_packing_grams.size() != _selected_flavors.size()
	if not needs_reset:
		for flavor_id in _selected_flavors:
			if not _manual_packing_grams.has(flavor_id):
				needs_reset = true
				break
	if not needs_reset:
		return

	_manual_packing_grams.clear()
	var count = maxi(1, _selected_flavors.size())
	var base_grams = int(TOTAL_PACKING_GRAMS / count)
	var remainder = TOTAL_PACKING_GRAMS % count
	for i in range(_selected_flavors.size()):
		var flavor_id = _selected_flavors[i]
		var grams = base_grams
		if i < remainder:
			grams += 1
		_manual_packing_grams[flavor_id] = grams


func _build_packing_slider_row(flavor_id: String) -> Control:
	var wrapper = VBoxContainer.new()
	wrapper.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	wrapper.add_theme_constant_override("separation", 4)

	var label = Label.new()
	label.text = "%s  %dg" % [_flavor_name(flavor_id), int(_manual_packing_grams.get(flavor_id, 0))]
	wrapper.add_child(label)
	_packing_value_labels[flavor_id] = label

	var slider = HSlider.new()
	slider.min_value = 0
	slider.max_value = TOTAL_PACKING_GRAMS
	slider.step = 1
	slider.value = int(_manual_packing_grams.get(flavor_id, 0))
	slider.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	slider.value_changed.connect(_on_packing_slider_changed.bind(flavor_id))
	wrapper.add_child(slider)
	_packing_sliders[flavor_id] = slider

	return wrapper


func _on_packing_slider_changed(value: float, flavor_id: String) -> void:
	var grams = int(round(value))
	_manual_packing_grams[flavor_id] = grams
	_refresh_packing_controls()
	_update_bowl_visual()


func _refresh_packing_controls() -> void:
	for flavor_id in _selected_flavors:
		var grams = int(_manual_packing_grams.get(flavor_id, 0))
		if _packing_value_labels.has(flavor_id):
			var label = _packing_value_labels[flavor_id] as Label
			if label != null:
				label.text = "%s  %dg" % [_flavor_name(flavor_id), grams]
		if _packing_sliders.has(flavor_id):
			var slider = _packing_sliders[flavor_id] as HSlider
			if slider != null and int(round(slider.value)) != grams:
				slider.value = grams

	var total = _sum_manual_packing_grams()
	var remaining = TOTAL_PACKING_GRAMS - total
	if _packing_remaining_label != null:
		if remaining == 0:
			_packing_remaining_label.text = "残り: 0g（確定可能）"
		elif remaining > 0:
			_packing_remaining_label.text = "残り: %dg" % remaining
		else:
			_packing_remaining_label.text = "超過: %dg（12gに戻して）" % abs(remaining)

	if _packing_confirm_button != null:
		_packing_confirm_button.disabled = remaining != 0

	_update_packing_info_text()


func _sum_manual_packing_grams() -> int:
	var total = 0
	for flavor_id in _selected_flavors:
		total += int(_manual_packing_grams.get(flavor_id, 0))
	return total


func _confirm_manual_packing() -> void:
	var total = _sum_manual_packing_grams()
	if total != TOTAL_PACKING_GRAMS:
		GameManager.play_ui_se("cancel")
		_append_info("合計12gにしてから確定して。")
		return
	var pattern = {
		"label": "手動配合",
		"style": "custom",
		"grams": _manual_packing_grams.duplicate(true),
	}
	GameManager.play_ui_se("confirm")

	# パッキング確定時にフレーバーを消費
	var consume_lines: Array[String] = []
	for flavor_id in _selected_flavors:
		var grams = int(_manual_packing_grams.get(flavor_id, 0))
		if grams > 0:
			if PlayerData.can_use_flavor(flavor_id, grams):
				PlayerData.use_flavor(flavor_id, grams)
				consume_lines.append("%s %dg 使用" % [_flavor_name(flavor_id), grams])
			else:
				var remaining = PlayerData.get_flavor_amount(flavor_id)
				_append_info("%sの残量が%dgしかありません。配分を見直してください。" % [_flavor_name(flavor_id), remaining])
				GameManager.play_ui_se("cancel")
				return
	if not consume_lines.is_empty():
		_append_info("\n".join(consume_lines))

	_on_packing_selected(pattern)


func _format_pattern_grams(pattern: Dictionary) -> String:
	var grams: Dictionary = pattern.get("grams", {})
	var parts: Array[String] = []
	for flavor_id in _selected_flavors:
		if not grams.has(flavor_id):
			continue
		parts.append("%s %dg" % [_flavor_name(flavor_id), int(grams.get(flavor_id, 0))])
	return " / ".join(parts)


func _on_packing_selected(pattern: Dictionary) -> void:
	_packing_choice = pattern.duplicate(true)
	var grams: Dictionary = _packing_choice.get("grams", {})
	var style = str(_packing_choice.get("style", "balanced"))
	var delta_spec = 8.0
	var delta_aud = 0.0
	var lines: Array[String] = []

	match style:
		"balanced":
			delta_spec += 4.0 + PlayerData.stat_sense * 0.05
			lines.append("配合バランスが良い。")
		"tight":
			delta_spec += 6.0 + PlayerData.stat_technique * 0.04
			_heat_state += 1
			lines.append("高密度で火力寄り。")
		"airy":
			delta_spec += 3.0 + PlayerData.stat_sense * 0.04
			_heat_state -= 1
			lines.append("軽い立ち上がり。")
		"heat":
			delta_spec += 5.0 + PlayerData.stat_guts * 0.05
			delta_aud += 3.0
			lines.append("攻めた高火力寄せ。")
		"custom":
			var values: Array[int] = []
			for flavor_id in _selected_flavors:
				var gram = int(grams.get(flavor_id, 0))
				if gram > 0:
					values.append(gram)
			if values.size() <= 1:
				delta_spec += 4.0 + PlayerData.stat_technique * 0.03
				lines.append("単体寄りの手動配合。")
			else:
				values.sort()
				var spread = int(values[values.size() - 1]) - int(values[0])
				if spread <= 1:
					delta_spec += 6.0 + PlayerData.stat_sense * 0.04
					lines.append("手動配合のバランスが良い。")
				elif int(values[values.size() - 1]) >= 7:
					delta_spec += 5.0 + PlayerData.stat_guts * 0.04
					delta_aud += 2.0
					lines.append("主軸を立てた手動配合。")
				else:
					delta_spec += 4.0 + PlayerData.stat_insight * 0.04
					lines.append("狙いを持った手動配合。")
		_:
			delta_spec += 4.0 + PlayerData.stat_insight * 0.05
			lines.append("主軸フレーバーを明確化。")

	var theme_hits = _count_theme_hits(_selected_flavors)
	if theme_hits <= 0:
		delta_spec -= 3.0
	else:
		delta_spec += float(theme_hits) * 1.8

	for favored in _random_judge.get("flavors", []):
		var flavor_id = str(favored)
		if grams.has(flavor_id):
			delta_spec += 1.5

	var special = _detect_special_mix(_packing_choice)
	if not special.is_empty():
		_special_mix_name = str(special.get("name", ""))
		delta_spec += float(special.get("spec", 0.0))
		delta_aud += float(special.get("aud", 0.0))
		lines.append(str(special.get("text", "")))

	_technical_points += delta_spec
	_audience_points += delta_aud
	_heat_state = clampi(_heat_state, -3, 3)

	lines.append("専門 %+d / 一般 %+d" % [int(round(delta_spec)), int(round(delta_aud))])
	_show_step_result_and_next("\n".join(lines), _show_aluminum_step)


func _detect_special_mix(pattern: Dictionary) -> Dictionary:
	var grams: Dictionary = pattern.get("grams", {})
	if grams.has("pineapple") and grams.has("coconut") and grams.has("vanilla"):
		var values = [int(grams.get("pineapple", 0)), int(grams.get("coconut", 0)), int(grams.get("vanilla", 0))]
		values.sort()
		if values == [3, 4, 5]:
			return {
				"name": "ピニャコラーダ",
				"spec": 8.0,
				"aud": 8.0,
				"text": "特別ミックス『ピニャコラーダ』成立。",
			}

	if grams.size() == 1 and grams.has("mint"):
		return {
			"name": "地獄のメンソール",
			"spec": 2.0,
			"aud": 10.0,
			"text": "特別ミックス『地獄のメンソール』。観客が沸く。",
		}

	return {}


func _show_aluminum_step() -> void:
	_set_phase(4, "アルミ穴あけ", "リズムに合わせて穴を開ける。タイミングが大事！")
	_clear_choices()
	_aluminum_active = true
	_aluminum_notes.clear()
	_aluminum_notes_spawned = 0
	_aluminum_spawn_cooldown = 0
	_aluminum_hit_slot = 0
	_aluminum_hit_perfect = 0
	_aluminum_hit_good = 0
	_aluminum_hit_near = 0
	_aluminum_hit_miss = 0
	_aluminum_bad_press = 0
	_aluminum_required_hits = 6
	_aluminum_total_notes = 8

	var beat_wait = 0.16
	match _selected_hms:
		"tanukish_lid":
			beat_wait += 0.02
		"amaburst":
			beat_wait -= 0.02
		"winkwink_hagal":
			beat_wait += 0.01
	match _selected_bowl:
		"silicone_bowl":
			beat_wait += 0.01
		"suyaki":
			beat_wait -= 0.01
	if _easy_mode:
		beat_wait += 0.03
	_aluminum_spawn_interval_ticks = 2
	if _selected_hms == "tanukish_lid":
		_aluminum_spawn_interval_ticks += 1
	elif _selected_hms == "amaburst":
		_aluminum_spawn_interval_ticks -= 1
	if _selected_bowl == "suyaki":
		_aluminum_spawn_interval_ticks -= 1
	if _easy_mode:
		_aluminum_spawn_interval_ticks += 1
	_aluminum_spawn_interval_ticks = clampi(_aluminum_spawn_interval_ticks, 1, 4)
	_aluminum_timer.wait_time = clampf(beat_wait, 0.09, 0.28)
	_aluminum_timer.start()
	_spawn_aluminum_note()

	# ビジュアルリング表示
	var ring_visual = _AluminumRingVisual.new()
	ring_visual.name = "AluminumRing"
	ring_visual.custom_minimum_size = Vector2(280, 260)
	ring_visual.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	ring_visual.slot_count = _aluminum_slot_count
	ring_visual.hit_slot = _aluminum_hit_slot
	choice_container.add_child(ring_visual)

	# 穴あけボタン（大きく目立つ）
	var press_button = Button.new()
	press_button.text = "🔨 穴を開ける！"
	press_button.custom_minimum_size = Vector2(0, 60)
	press_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	press_button.add_theme_font_size_override("font_size", 28)
	var btn_style = StyleBoxFlat.new()
	btn_style.bg_color = Color("e43b44", 0.85)
	btn_style.border_color = Color("feae34", 0.7)
	btn_style.border_width_bottom = 4
	btn_style.border_width_left = 2
	btn_style.border_width_right = 2
	btn_style.border_width_top = 1
	btn_style.corner_radius_bottom_left = 8
	btn_style.corner_radius_bottom_right = 8
	btn_style.corner_radius_top_left = 8
	btn_style.corner_radius_top_right = 8
	btn_style.content_margin_top = 12
	btn_style.content_margin_bottom = 12
	press_button.add_theme_stylebox_override("normal", btn_style)
	var btn_hover = btn_style.duplicate()
	btn_hover.bg_color = Color("e43b44")
	btn_hover.border_color = Color("feae34")
	press_button.add_theme_stylebox_override("hover", btn_hover)
	var btn_pressed = btn_style.duplicate()
	btn_pressed.bg_color = Color("feae34", 0.7)
	press_button.add_theme_stylebox_override("pressed", btn_pressed)
	press_button.add_theme_color_override("font_color", Color("ffffff"))
	press_button.pressed.connect(_on_aluminum_press_hole)
	choice_container.add_child(press_button)
	_refresh_side_panel()
	_update_aluminum_rhythm_text()


func _on_aluminum_tick() -> void:
	if not _aluminum_active:
		return
	for i in range(_aluminum_notes.size() - 1, -1, -1):
		var note = _aluminum_notes[i]
		note["distance"] = float(note.get("distance", 0.0)) - 1.0
		if float(note.get("distance", 0.0)) < -1.8:
			_aluminum_hit_miss += 1
			_aluminum_notes.remove_at(i)
		else:
			_aluminum_notes[i] = note

	if _aluminum_notes_spawned < _aluminum_total_notes:
		if _aluminum_spawn_cooldown <= 0:
			_spawn_aluminum_note()
		else:
			_aluminum_spawn_cooldown -= 1

	if _aluminum_notes_spawned >= _aluminum_total_notes and _aluminum_notes.is_empty():
		_finish_aluminum_rhythm()
		return
	_update_aluminum_rhythm_text()


func _spawn_aluminum_note() -> void:
	if _aluminum_notes_spawned >= _aluminum_total_notes:
		return
	_aluminum_notes.append({"distance": _get_aluminum_start_distance()})
	_aluminum_notes_spawned += 1
	_aluminum_spawn_cooldown = _aluminum_spawn_interval_ticks


func _get_aluminum_start_distance() -> float:
	var distance = float(_aluminum_slot_count - 2)
	if _selected_hms == "amaburst":
		distance -= 1.0
	elif _selected_hms == "tanukish_lid":
		distance += 1.0
	if _easy_mode:
		distance += 1.0
	return clampf(distance, 6.0, float(_aluminum_slot_count + 2))


func _on_aluminum_press_hole() -> void:
	if not _aluminum_active:
		return
	var nearest_index = -1
	var nearest_distance = 999.0
	for i in range(_aluminum_notes.size()):
		var note = _aluminum_notes[i]
		var distance = abs(float(note.get("distance", 999.0)))
		if distance < nearest_distance:
			nearest_distance = distance
			nearest_index = i

	if nearest_index == -1 or nearest_distance > 1.55:
		_aluminum_bad_press += 1
		GameManager.play_ui_se("cancel")
		_aluminum_show_hit_feedback("MISS", Color("e43b44"))
		_update_aluminum_rhythm_text()
		return

	if nearest_distance <= 0.35:
		_aluminum_hit_perfect += 1
		GameManager.play_ui_se("confirm")
		_aluminum_show_hit_feedback("PERFECT!", Color("feae34"))
	elif nearest_distance <= 0.9:
		_aluminum_hit_good += 1
		GameManager.play_ui_se("confirm")
		_aluminum_show_hit_feedback("GOOD", Color("3e8948"))
	else:
		_aluminum_hit_near += 1
		GameManager.play_ui_se("cursor")
		_aluminum_show_hit_feedback("NEAR", Color("8b9bb4"))

	_aluminum_notes.remove_at(nearest_index)
	if _aluminum_notes_spawned >= _aluminum_total_notes and _aluminum_notes.is_empty():
		_finish_aluminum_rhythm()
		return
	_update_aluminum_rhythm_text()


func _finish_aluminum_rhythm() -> void:
	if not _aluminum_active:
		return
	_aluminum_active = false
	_aluminum_timer.stop()

	var score = _evaluate_aluminum_rhythm()
	var result_text = str(score.get("text", "穴あけ完了"))
	var delta_spec = float(score.get("spec", 0.0))
	var delta_aud = float(score.get("aud", 0.0))
	var zone_gain = float(score.get("zone", 0.0))
	_technical_points += delta_spec
	_audience_points += delta_aud
	_zone_bonus += zone_gain
	_zone_bonus = clampf(_zone_bonus, -0.4, 1.2)
	GameManager.play_ui_se("confirm" if delta_spec >= 0.0 else "cancel")
	_show_mid_score_ticker()  # アルミ後の中間速報
	_show_step_result_and_next(
		"%s: 専門 %+d / 一般 %+d / ゾーン %+d%%\n判定 P%d / G%d / N%d / M%d / 空振り%d" % [
			result_text,
			int(round(delta_spec)),
			int(round(delta_aud)),
			int(round(zone_gain * 100.0)),
			_aluminum_hit_perfect,
			_aluminum_hit_good,
			_aluminum_hit_near,
			_aluminum_hit_miss,
			_aluminum_bad_press,
		],
		_show_charcoal_prep_step
	)


func _evaluate_aluminum_rhythm() -> Dictionary:
	var hits = _count_aluminum_hits()
	if hits < _aluminum_required_hits:
		return {"text": "穴あけ不足（必要数未達）", "spec": -10.0, "aud": -2.0, "zone": 0.04}

	var weighted = float(_aluminum_hit_perfect) + float(_aluminum_hit_good) * 0.72 + float(_aluminum_hit_near) * 0.42
	var penalty = float(_aluminum_hit_miss) * 0.25 + float(_aluminum_bad_press) * 0.18
	var score = (weighted - penalty) / float(maxi(_aluminum_total_notes, 1))
	score += PlayerData.stat_technique * 0.0015
	score += PlayerData.stat_sense * 0.0008
	if _easy_mode:
		score += 0.08
	if _selected_hms == "amaburst":
		score -= 0.05
	score = clampf(score, 0.0, 1.2)

	if score >= 0.92:
		return {"text": "穴あけリズム（完璧）", "spec": 16.0, "aud": 4.0, "zone": 0.28}
	if score >= 0.78:
		return {"text": "穴あけリズム（良好）", "spec": 10.0, "aud": 2.0, "zone": 0.20}
	if score >= 0.62:
		return {"text": "穴あけリズム（可）", "spec": 4.0, "aud": 1.0, "zone": 0.12}
	return {"text": "穴あけが荒れた", "spec": -8.0, "aud": -1.0, "zone": 0.04}


func _update_aluminum_rhythm_text() -> void:
	var hit_count = _count_aluminum_hits()
	var remain = maxi(0, _aluminum_required_hits - hit_count)
	var progress_bar = ""
	for i in range(_aluminum_total_notes):
		if i < _aluminum_hit_perfect:
			progress_bar += "★"
		elif i < hit_count:
			progress_bar += "●"
		else:
			progress_bar += "○"
	var lines: Array[String] = []
	lines.append("穴あけ進捗: %s" % progress_bar)
	lines.append("成功 %d / %d（あと %d）" % [hit_count, _aluminum_total_notes, remain])
	lines.append("P:%d  G:%d  N:%d  M:%d" % [_aluminum_hit_perfect, _aluminum_hit_good, _aluminum_hit_near, _aluminum_hit_miss])
	lines.append("ノーツが判定ラインに来たらボタンを押せ！")
	info_label.text = "\n".join(lines)

	# ビジュアルリングの更新
	var ring_node = choice_container.find_child("AluminumRing", true, false) as _AluminumRingVisual
	if ring_node != null:
		ring_node.notes = _aluminum_notes.duplicate(true)
		ring_node.hit_slot = _aluminum_hit_slot
		ring_node.hits_done = hit_count
		ring_node.queue_redraw()


func _build_aluminum_ring_text() -> String:
	var slot_note_count: Dictionary = {}
	for note in _aluminum_notes:
		var slot_idx = _get_aluminum_note_slot(note)
		slot_note_count[slot_idx] = int(slot_note_count.get(slot_idx, 0)) + 1

	var sym = func(slot_idx: int) -> String:
		var note_count = int(slot_note_count.get(slot_idx, 0))
		if slot_idx == _aluminum_hit_slot:
			if note_count <= 0:
				return "★"
			if note_count == 1:
				return "◆"
			return "✦"
		if note_count <= 0:
			return "○"
		if note_count == 1:
			return "●"
		return "◎"

	var lines: Array[String] = []
	lines.append("          %s" % sym.call(0))
	lines.append("      %s       %s" % [sym.call(11), sym.call(1)])
	lines.append("   %s             %s" % [sym.call(10), sym.call(2)])
	lines.append(" %s                 %s" % [sym.call(9), sym.call(3)])
	lines.append("   %s             %s" % [sym.call(8), sym.call(4)])
	lines.append("      %s       %s" % [sym.call(7), sym.call(5)])
	lines.append("          %s" % sym.call(6))
	return "\n".join(lines)


func _get_aluminum_note_slot(note: Dictionary) -> int:
	var distance = int(round(float(note.get("distance", 0.0))))
	var slot = (_aluminum_hit_slot + distance) % _aluminum_slot_count
	if slot < 0:
		slot += _aluminum_slot_count
	return slot


func _count_aluminum_hits() -> int:
	return _aluminum_hit_perfect + _aluminum_hit_good + _aluminum_hit_near


func _show_charcoal_prep_step() -> void:
	_set_phase(5, "炭の準備", "フリップのタイミングを決める。")
	_clear_choices()
	_add_choice_button("早めにフリップ", _on_charcoal_prep_choice.bind("early"))
	_add_choice_button("ちょうどでフリップ", _on_charcoal_prep_choice.bind("perfect"))
	_add_choice_button("遅めにフリップ", _on_charcoal_prep_choice.bind("late"))
	_refresh_side_panel()


func _on_charcoal_prep_choice(choice: String) -> void:
	var desired = "perfect"
	if _selected_hms == "amaburst":
		desired = "early"
	elif _selected_hms == "winkwink_hagal":
		desired = "late"

	var delta_spec = 0.0
	if choice == desired:
		delta_spec += 10.0
	elif choice == "perfect" or desired == "perfect":
		delta_spec += 3.0
	else:
		delta_spec -= 6.0

	match choice:
		"early":
			_heat_state -= 1
		"late":
			_heat_state += 1
		_:
			pass

	if _selected_hms == "amaburst":
		_heat_state += 1

	_technical_points += delta_spec
	_heat_state = clampi(_heat_state, -3, 3)
	_show_step_result_and_next("炭準備結果: 専門 %+d" % int(round(delta_spec)), _show_charcoal_place_step)


func _show_charcoal_place_step() -> void:
	_set_phase(6, "炭の配置", "3個か4個を選んで配置する。機材と好みに合わせる。")
	_clear_choices()
	
	# Add hint dynamically based on equipment
	var hint = "通常は3個が基本。"
	if _selected_hms == "tanukish_lid" or PlayerData.equipment_bowl == "suyaki":
		hint = "この機材なら3個のほうが熱が安定しやすい。"
	elif _selected_hms == "amaburst":
		hint = "この機材は4個で熱量を叩き込むのが正解。"
		
	info_label.text = "【ヒント】\n" + hint
	
	_add_choice_button("3個（基本／安定）", _on_charcoal_place_selected.bind(3))
	_add_choice_button("4個（攻め／狙いがある時）", _on_charcoal_place_selected.bind(4))
	_refresh_side_panel()


func _on_charcoal_place_selected(count: int) -> void:
	_selected_charcoal_count = count
	var delta_spec = 0.0
	var delta_aud = 0.0

	match count:
		3:
			delta_spec += 8.0
			_zone_bonus += 0.30
			_heat_state -= 1
		4:
			delta_spec += 9.0
			_zone_bonus += 0.16

	if PlayerData.equipment_charcoal == "cube_charcoal":
		if count >= 4:
			delta_spec += 4.0
			delta_aud += 4.0
		else:
			delta_spec -= 4.0

	if _selected_hms == "amaburst" and count == 4:
		delta_spec += 3.0
		_heat_state += 1

	_technical_points += delta_spec
	_audience_points += delta_aud
	_zone_bonus = clampf(_zone_bonus, -0.4, 1.2)
	_heat_state = clampi(_heat_state, -3, 3)
	_show_step_result_and_next("炭配置結果: 専門 %+d / 一般 %+d" % [int(round(delta_spec)), int(round(delta_aud))], _show_steam_step)


var _steam_timer_label: Label

func _show_steam_step() -> void:
	_set_phase(7, "蒸らしタイマー", "5〜10分から蒸らし時間を設定。")
	_clear_choices()
	_steam_minutes = 6
	
	var ui_container = VBoxContainer.new()
	ui_container.alignment = BoxContainer.ALIGNMENT_CENTER
	ui_container.add_theme_constant_override("separation", 16)
	choice_container.add_child(ui_container)
	
	_steam_timer_label = Label.new()
	_steam_timer_label.add_theme_font_size_override("font_size", 48)
	_steam_timer_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	ui_container.add_child(_steam_timer_label)
	
	var control_row = HBoxContainer.new()
	control_row.alignment = BoxContainer.ALIGNMENT_CENTER
	control_row.add_theme_constant_override("separation", 24)
	ui_container.add_child(control_row)
	
	var minus_btn = Button.new()
	minus_btn.text = "－1分"
	minus_btn.custom_minimum_size = Vector2(80, 48)
	minus_btn.pressed.connect(_on_steam_adjust.bind(-1))
	control_row.add_child(minus_btn)
	
	var plus_btn = Button.new()
	plus_btn.text = "＋1分"
	plus_btn.custom_minimum_size = Vector2(80, 48)
	plus_btn.pressed.connect(_on_steam_adjust.bind(1))
	control_row.add_child(plus_btn)
	
	var start_btn = Button.new()
	start_btn.text = "START (決定)"
	start_btn.custom_minimum_size = Vector2(200, 56)
	start_btn.add_theme_color_override("font_color", Color(1, 0.9, 0.4))
	start_btn.pressed.connect(func(): _on_steam_selected(_steam_minutes))
	ui_container.add_child(start_btn)
	
	_update_steam_timer_display()
	_refresh_side_panel()

func _on_steam_adjust(diff: int) -> void:
	_steam_minutes += diff
	if _steam_minutes < 5:
		_steam_minutes = 5
	elif _steam_minutes > 10:
		_steam_minutes = 10
	GameManager.play_ui_se("cursor")
	_update_steam_timer_display()

func _update_steam_timer_display() -> void:
	if _steam_timer_label:
		_steam_timer_label.text = "%02d : 00" % _steam_minutes


func _on_steam_selected(minutes: int) -> void:
	_steam_minutes = minutes
	var range = _get_steam_optimal_range(_selected_charcoal_count)
	var min_minute = int(range.x)
	var max_minute = int(range.y)
	var delta_spec = 0.0

	if minutes >= min_minute and minutes <= max_minute:
		delta_spec += 11.0 + PlayerData.stat_sense * 0.05
		var midpoint = int(round((min_minute + max_minute) / 2.0))
		if minutes == midpoint:
			delta_spec += 4.0
			_zone_bonus += 0.08
	else:
		delta_spec -= 8.0
		if minutes > max_minute:
			_heat_state += 1
		else:
			_heat_state -= 1

	if _selected_hms == "amaburst" and minutes >= 6:
		_heat_state += 1
	if _selected_hms == "winkwink_hagal" and minutes <= 5:
		_heat_state -= 1

	_technical_points += delta_spec
	_zone_bonus = clampf(_zone_bonus, -0.4, 1.2)
	_heat_state = clampi(_heat_state, -3, 3)
	_show_mind_barrage_intro("蒸らし結果: 専門 %+d（適正 %d〜%d分）" % [int(round(delta_spec)), min_minute, max_minute])


func _get_steam_optimal_range(charcoal_count: int) -> Vector2i:
	match charcoal_count:
		3:
			return Vector2i(5, 7)
		4:
			return Vector2i(4, 6)
		_:
			return Vector2i(5, 7)


func _show_mind_barrage_intro(summary_text: String = "") -> void:
	if _mind_barrage_done:
		_show_pull_step()
		return
	var duration_sec = _compute_mind_barrage_duration()
	var lives = MIND_BARRAGE_BASE_LIVES + (1 if _easy_mode else 0)
	_set_phase(8, "吸い出し前: 思考の暴走", "吸い出し直前、頭の中で不安と記憶が弾幕になる。")
	_clear_choices()
	var lines: Array[String] = []
	if summary_text != "":
		lines.append(summary_text)
		lines.append("")
	lines.append("ここが大会の精神戦。")
	lines.append("弾を避ける = 他人の価値観をかわす")
	lines.append("当たる = 心がブレる（評価デバフ）")
	lines.append("耐えきる = 自分のレシピを信じ切る")
	lines.append("成績が良いほど、この後の吸い出しゲージは遅くなる。")
	lines.append("蒸らし %d分 -> 耐久 %.1f秒" % [_steam_minutes, duration_sec])
	lines.append("残機: %d（0になると吸い出しゲージは最悪速度）" % lives)
	lines.append("この精神戦は必須。終えるまで吸い出しへは進めない。")
	info_label.text = "\n".join(lines)
	_add_choice_button("弾幕開始", _start_mind_barrage_step)
	_refresh_side_panel()


func _compute_mind_barrage_duration() -> float:
	var ratio = clampf(float(_steam_minutes - 5) / 5.0, 0.0, 1.0)
	var duration_sec = lerpf(MIND_BARRAGE_MIN_SECONDS, MIND_BARRAGE_MAX_SECONDS, ratio)
	duration_sec += float(maxi(_heat_state, 0)) * 0.4
	match _selected_hms:
		"amaburst":
			duration_sec += 0.5
		"tanukish_lid":
			duration_sec -= 0.4
		_:
			pass
	if _easy_mode:
		duration_sec -= 1.0
	return clampf(duration_sec, 6.5, 18.0)


func _compute_mind_barrage_spawn_interval() -> float:
	var ratio = clampf(float(_steam_minutes - 5) / 5.0, 0.0, 1.0)
	var interval = lerpf(0.56, 0.34, ratio)
	interval -= float(abs(_heat_state)) * 0.02
	if _selected_hms == "amaburst":
		interval -= 0.02
	elif _selected_hms == "tanukish_lid":
		interval += 0.03
	if _easy_mode:
		interval += 0.06
	return clampf(interval, 0.22, 0.72)


func _start_mind_barrage_step() -> void:
	if _mind_barrage_done:
		_show_pull_step()
		return
	_set_phase(8, "思考弾幕", "弾をかわして時間まで耐える。")
	_clear_choices()
	_mind_active = true
	_mind_duration_total = _compute_mind_barrage_duration()
	_mind_elapsed = 0.0
	_mind_spawn_cooldown = 0.0
	_mind_spawn_interval = _compute_mind_barrage_spawn_interval()
	_mind_hits = 0
	_mind_spawned = 0
	_mind_hit_se_cooldown = 0.0
	_mind_lives_max = MIND_BARRAGE_BASE_LIVES + (1 if _easy_mode else 0)
	_mind_lives_remaining = _mind_lives_max
	_mind_pull_speed_adjust = 0.0
	_mind_force_worst_pull_speed = false
	_mind_bullets.clear()
	_mind_player_pos = Vector2.ZERO
	_mind_move_left = false
	_mind_move_right = false
	_mind_move_up = false
	_mind_move_down = false
	_mind_invincible_timer = 0.0

	var guide = Label.new()
	guide.text = "操作: 矢印キー / WASD（下のボタン長押しでも移動）"
	choice_container.add_child(guide)

	# 横並びレイアウト: 左にはじめの顔 + 右にアリーナ
	var mind_hbox = HBoxContainer.new()
	mind_hbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	mind_hbox.add_theme_constant_override("separation", 10)
	choice_container.add_child(mind_hbox)

	# はじめの顔パネル
	var face_panel = VBoxContainer.new()
	face_panel.custom_minimum_size = Vector2(100, 260)
	face_panel.add_theme_constant_override("separation", 6)
	mind_hbox.add_child(face_panel)

	var face_rect = TextureRect.new()
	face_rect.name = "MindFaceRect"
	face_rect.custom_minimum_size = Vector2(96, 96)
	face_rect.expand_mode = TextureRect.EXPAND_FIT_WIDTH_PROPORTIONAL
	face_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	# 初期表情: normal
	var face_path = "res://assets/sprites/characters/chr_hajime_normal.png"
	if ResourceLoader.exists(face_path):
		face_rect.texture = load(face_path)
	face_panel.add_child(face_rect)

	var face_label = Label.new()
	face_label.name = "MindFaceLabel"
	face_label.text = "集中してる…"
	face_label.add_theme_font_size_override("font_size", 13)
	face_label.add_theme_color_override("font_color", Color("ead4aa", 0.8))
	face_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	face_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	face_label.custom_minimum_size = Vector2(96, 0)
	face_panel.add_child(face_label)

	var arena_frame = PanelContainer.new()
	arena_frame.custom_minimum_size = Vector2(0, 260)
	arena_frame.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	mind_hbox.add_child(arena_frame)

	var arena = ColorRect.new()
	arena.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	arena.color = Color("181425", 0.95)
	arena.clip_contents = true
	arena.mouse_filter = Control.MOUSE_FILTER_IGNORE
	arena_frame.add_child(arena)
	_mind_arena_layer = arena

	# アリーナ枠線（バーミリオン）
	var arena_border = ReferenceRect.new()
	arena_border.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	arena_border.border_color = Color("e43b44", 0.5)
	arena_border.border_width = 2.0
	arena_border.mouse_filter = Control.MOUSE_FILTER_IGNORE
	arena.add_child(arena_border)

	var player = ColorRect.new()
	player.color = Color("e43b44")
	player.size = _mind_player_size
	player.custom_minimum_size = _mind_player_size
	player.mouse_filter = Control.MOUSE_FILTER_IGNORE
	arena.add_child(player)
	_mind_player_node = player

	# フェーズ名表示ラベル
	var phase_hint = Label.new()
	phase_hint.name = "PhaseHint"
	phase_hint.text = "― 不安が湧き上がる ―"
	phase_hint.add_theme_font_size_override("font_size", 14)
	phase_hint.add_theme_color_override("font_color", Color("8b9bb4", 0.7))
	phase_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	phase_hint.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	phase_hint.mouse_filter = Control.MOUSE_FILTER_IGNORE
	arena.add_child(phase_hint)

	var dpad = GridContainer.new()
	dpad.columns = 3
	dpad.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	dpad.add_theme_constant_override("h_separation", 8)
	dpad.add_theme_constant_override("v_separation", 8)
	choice_container.add_child(dpad)
	_add_mind_pad_spacer(dpad)
	_add_mind_direction_button(dpad, "↑", "up")
	_add_mind_pad_spacer(dpad)
	_add_mind_direction_button(dpad, "←", "left")
	var center = Label.new()
	center.text = "SOUL"
	center.custom_minimum_size = Vector2(56, 40)
	center.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	center.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	dpad.add_child(center)
	_add_mind_direction_button(dpad, "→", "right")
	_add_mind_pad_spacer(dpad)
	_add_mind_direction_button(dpad, "↓", "down")
	_add_mind_pad_spacer(dpad)

	_update_mind_barrage_info_text()
	_refresh_side_panel()
	call_deferred("_begin_mind_barrage_loop")


func _add_mind_pad_spacer(parent: GridContainer) -> void:
	var spacer = Control.new()
	spacer.custom_minimum_size = Vector2(56, 40)
	parent.add_child(spacer)


func _add_mind_direction_button(parent: GridContainer, button_text: String, dir_id: String) -> void:
	var button = Button.new()
	button.text = button_text
	button.custom_minimum_size = Vector2(56, 40)
	button.button_down.connect(func() -> void:
		_set_mind_direction(dir_id, true)
	)
	button.button_up.connect(func() -> void:
		_set_mind_direction(dir_id, false)
	)
	button.mouse_exited.connect(func() -> void:
		_set_mind_direction(dir_id, false)
	)
	parent.add_child(button)


func _set_mind_direction(dir_id: String, pressed: bool) -> void:
	match dir_id:
		"left":
			_mind_move_left = pressed
		"right":
			_mind_move_right = pressed
		"up":
			_mind_move_up = pressed
		"down":
			_mind_move_down = pressed


func _begin_mind_barrage_loop() -> void:
	if not _mind_active:
		return
	if _mind_arena_layer == null or not is_instance_valid(_mind_arena_layer):
		return
	var arena_size = _mind_arena_layer.size
	if arena_size.x < 80.0 or arena_size.y < 80.0:
		call_deferred("_begin_mind_barrage_loop")
		return
	_mind_player_pos = arena_size * 0.5
	_sync_mind_player_node()
	_spawn_mind_barrage_word()
	_mind_timer.start()
	_update_mind_barrage_info_text()


func _on_mind_barrage_tick() -> void:
	if not _mind_active:
		return
	if _mind_arena_layer == null or not is_instance_valid(_mind_arena_layer):
		return
	var dt = _mind_timer.wait_time
	_mind_elapsed += dt
	_mind_spawn_cooldown -= dt
	if _mind_hit_se_cooldown > 0.0:
		_mind_hit_se_cooldown = max(0.0, _mind_hit_se_cooldown - dt)

	if _mind_invincible_timer > 0.0:
		_mind_invincible_timer -= dt
		if _mind_player_node != null and is_instance_valid(_mind_player_node):
			# Blink effect: alternating alpha every 0.1 seconds
			var time_ms = Time.get_ticks_msec()
			_mind_player_node.color.a = 0.3 if (time_ms % 200) < 100 else 0.8
	elif _mind_player_node != null and is_instance_valid(_mind_player_node):
		_mind_player_node.color.a = 1.0

	_update_mind_player(dt)

	if _mind_spawn_cooldown <= 0.0:
		_spawn_mind_barrage_word()
		# 難易度スケーリング: 後半ほどスポーン間隔が短くなる
		var progress = clampf(_mind_elapsed / maxf(_mind_duration_total, 1.0), 0.0, 1.0)
		var phase_interval_mult = lerpf(1.0, 0.6, progress)  # 後半は40%短く
		_mind_spawn_cooldown = _mind_spawn_interval * randf_range(0.72, 1.25) * phase_interval_mult

		# アリーナの色を時間経過で変化
		if _mind_arena_layer != null and is_instance_valid(_mind_arena_layer):
			var dark_color = Color("181425", 0.95).lerp(Color("2a1520", 0.95), progress)
			_mind_arena_layer.color = dark_color

	_update_mind_bullets(dt)
	if _mind_lives_remaining <= 0:
		_mind_elapsed = _mind_duration_total
		_update_mind_barrage_info_text()
		_finish_mind_barrage_step()
		return
	_update_mind_barrage_info_text()

	if _mind_elapsed >= _mind_duration_total:
		_finish_mind_barrage_step()


func _update_mind_player(dt: float) -> void:
	if _mind_arena_layer == null:
		return
	var axis = Vector2.ZERO
	if _mind_move_left or Input.is_action_pressed("ui_left") or Input.is_key_pressed(KEY_A):
		axis.x -= 1.0
	if _mind_move_right or Input.is_action_pressed("ui_right") or Input.is_key_pressed(KEY_D):
		axis.x += 1.0
	if _mind_move_up or Input.is_action_pressed("ui_up") or Input.is_key_pressed(KEY_W):
		axis.y -= 1.0
	if _mind_move_down or Input.is_action_pressed("ui_down") or Input.is_key_pressed(KEY_S):
		axis.y += 1.0

	if axis.length_squared() > 0.0:
		axis = axis.normalized()

	var speed = 214.0 + float(maxi(_steam_minutes - 5, 0)) * 4.0
	if _easy_mode:
		speed += 20.0
	_mind_player_pos += axis * speed * dt

	var arena_size = _mind_arena_layer.size
	var margin_x = _mind_player_size.x * 0.5 + 6.0
	var margin_y = _mind_player_size.y * 0.5 + 6.0
	_mind_player_pos.x = clampf(_mind_player_pos.x, margin_x, arena_size.x - margin_x)
	_mind_player_pos.y = clampf(_mind_player_pos.y, margin_y, arena_size.y - margin_y)
	_sync_mind_player_node()


func _spawn_mind_barrage_word() -> void:
	if _mind_arena_layer == null or not is_instance_valid(_mind_arena_layer):
		return
	var arena_size = _mind_arena_layer.size
	if arena_size.x < 80.0 or arena_size.y < 80.0:
		return

	# フェーズに応じてワードカテゴリを重み付き抽選
	var progress = clampf(_mind_elapsed / maxf(_mind_duration_total, 1.0), 0.0, 1.0)
	var category_data = _pick_barrage_category(progress)
	var word_pool: Array = category_data.get("pool", MIND_BARRAGE_WORDS)
	var word_color: Color = category_data.get("color", Color("e43b44", 0.85))
	var phase_name: String = category_data.get("phase", "")

	if word_pool.is_empty():
		word_pool = MIND_BARRAGE_WORDS

	var phrase = str(word_pool[randi() % word_pool.size()])
	var bullet = Label.new()
	bullet.text = phrase
	var font_size = 20 + (4 if progress > 0.7 else 0)
	bullet.add_theme_font_size_override("font_size", font_size)
	bullet.modulate = word_color
	bullet.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_mind_arena_layer.add_child(bullet)

	# フェーズ名の更新
	if phase_name != "":
		var hint_node = _mind_arena_layer.get_node_or_null("PhaseHint")
		if hint_node != null and hint_node is Label:
			hint_node.text = phase_name

	var size = bullet.get_combined_minimum_size()
	if size.x < 40.0:
		size = Vector2(maxi(40, phrase.length() * 20), 28)

	var side = randi() % 4
	var spawn = Vector2.ZERO
	match side:
		0:
			spawn = Vector2(randf_range(0.0, arena_size.x), -size.y * 0.5 - 4.0)
		1:
			spawn = Vector2(arena_size.x + size.x * 0.5 + 4.0, randf_range(0.0, arena_size.y))
		2:
			spawn = Vector2(randf_range(0.0, arena_size.x), arena_size.y + size.y * 0.5 + 4.0)
		_:
			spawn = Vector2(-size.x * 0.5 - 4.0, randf_range(0.0, arena_size.y))

	var target = _mind_player_pos + Vector2(randf_range(-64.0, 64.0), randf_range(-42.0, 42.0))
	target.x = clampf(target.x, 20.0, arena_size.x - 20.0)
	target.y = clampf(target.y, 20.0, arena_size.y - 20.0)
	var to_target = target - spawn
	if to_target.length_squared() <= 0.0001:
		to_target = Vector2.DOWN
	var direction = to_target.normalized()

	# 難易度スケーリング: 時間経過でスピードが上がる
	var base_speed = 112.0 + float(_steam_minutes - 5) * 14.0 + float(abs(_heat_state)) * 9.0 + randf_range(0.0, 54.0)
	var phase_speed_bonus = progress * 80.0  # 後半ほど速く
	base_speed += phase_speed_bonus
	if _selected_hms == "amaburst":
		base_speed += 12.0
	elif _selected_hms == "tanukish_lid":
		base_speed -= 8.0
	if _easy_mode:
		base_speed -= 20.0
	base_speed = clampf(base_speed, 90.0, 320.0)

	var data := {
		"node": bullet,
		"pos": spawn,
		"vel": direction * base_speed,
		"size": size,
	}
	_mind_bullets.append(data)
	_mind_spawned += 1
	bullet.position = spawn - size * 0.5


## 弾幕カテゴリ選択（時間経過でフェーズ遷移）
func _pick_barrage_category(progress: float) -> Dictionary:
	if progress < 0.35:
		# Phase 1: 内なる不安（静かな立ち上がり）
		return {
			"pool": MIND_WORDS_ANXIETY,
			"color": Color("8b9bb4", 0.9),
			"phase": "― 不安が湧き上がる ―",
		}
	elif progress < 0.7:
		# Phase 2: 観客の声（外からのプレッシャー）
		if randf() < 0.6:
			return {
				"pool": MIND_WORDS_AUDIENCE,
				"color": Color("feae34", 0.85),
				"phase": "― 会場の声が聞こえる ―",
			}
		else:
			return {
				"pool": MIND_WORDS_ANXIETY,
				"color": Color("8b9bb4", 0.9),
				"phase": "― 会場の声が聞こえる ―",
			}
	else:
		# Phase 3: ライバルへの畏怖 + 不安の最高潮
		var roll = randf()
		if roll < 0.4:
			return {
				"pool": MIND_WORDS_RIVAL,
				"color": Color("e43b44", 0.9),
				"phase": "― 心が折れそうだ ―",
			}
		elif roll < 0.7:
			return {
				"pool": MIND_WORDS_AUDIENCE,
				"color": Color("feae34", 0.85),
				"phase": "― 心が折れそうだ ―",
			}
		else:
			return {
				"pool": MIND_WORDS_ANXIETY,
				"color": Color("e43b44", 0.9),
				"phase": "― 心が折れそうだ ―",
			}


func _update_mind_bullets(dt: float) -> void:
	if _mind_arena_layer == null:
		return
	var arena_size = _mind_arena_layer.size
	for i in range(_mind_bullets.size() - 1, -1, -1):
		var bullet = _mind_bullets[i]
		var node = bullet.get("node") as Label
		if node == null or not is_instance_valid(node):
			_mind_bullets.remove_at(i)
			continue
		var pos = bullet.get("pos", Vector2.ZERO) + bullet.get("vel", Vector2.ZERO) * dt
		var size = bullet.get("size", node.get_combined_minimum_size())
		bullet["pos"] = pos
		node.position = pos - size * 0.5
		if _mind_invincible_timer <= 0.0 and _is_mind_barrage_collision(pos, size):
			_mind_hits += 1
			_mind_lives_remaining = maxi(0, _mind_lives_remaining - 1)
			if _mind_hit_se_cooldown <= 0.0:
				GameManager.play_ui_se("cancel")
				_mind_hit_se_cooldown = 0.08
			_mind_invincible_timer = 1.0 # 1 second of i-frames
			_mind_hit_flash()
			_mind_update_face()
			node.queue_free()
			_mind_bullets.remove_at(i)
			continue
		if pos.x < -size.x - 24.0 or pos.x > arena_size.x + size.x + 24.0 or pos.y < -size.y - 24.0 or pos.y > arena_size.y + size.y + 24.0:
			node.queue_free()
			_mind_bullets.remove_at(i)
			continue
		_mind_bullets[i] = bullet


func _is_mind_barrage_collision(bullet_pos: Vector2, bullet_size: Vector2) -> bool:
	var player_rect = Rect2(_mind_player_pos - _mind_player_size * 0.25, _mind_player_size * 0.5)
	var bullet_rect = Rect2(bullet_pos - bullet_size * 0.2, bullet_size * 0.4)
	return player_rect.intersects(bullet_rect)


func _sync_mind_player_node() -> void:
	if _mind_player_node == null or not is_instance_valid(_mind_player_node):
		return
	_mind_player_node.position = _mind_player_pos - _mind_player_size * 0.5


func _update_mind_barrage_info_text() -> void:
	if not _mind_active:
		return
	var remain = max(0.0, _mind_duration_total - _mind_elapsed)
	var focus = clampi(100 - _mind_hits * 12, 0, 100)
	var ratio = 0.0
	if _mind_duration_total > 0.0:
		ratio = _mind_elapsed / _mind_duration_total
	var lines: Array[String] = []
	lines.append("残り %.1f秒 / %.1f秒" % [remain, _mind_duration_total])
	lines.append("残機 %d / %d  %s" % [_mind_lives_remaining, _mind_lives_max, _build_mind_life_text()])
	lines.append("被弾 %d / 出現 %d" % [_mind_hits, maxi(_mind_spawned, 1)])
	lines.append("集中度 %d%%" % focus)
	lines.append(_build_mind_barrage_progress_bar(ratio))
	info_label.text = "\n".join(lines)


func _build_mind_life_text() -> String:
	var chars: Array[String] = []
	for i in range(_mind_lives_max):
		chars.append("●" if i < _mind_lives_remaining else "○")
	return "".join(chars)


func _build_mind_barrage_progress_bar(ratio: float) -> String:
	var length = 24
	var fill = int(round(clampf(ratio, 0.0, 1.0) * float(length)))
	var chars: Array[String] = []
	for i in range(length):
		chars.append("■" if i < fill else "─")
	return "".join(chars)


func _finish_mind_barrage_step() -> void:
	if not _mind_active:
		return
	var result = _evaluate_mind_barrage_result()
	var result_text = str(result.get("text", "精神戦を抜けた。"))
	var delta_spec = float(result.get("spec", 0.0))
	var delta_aud = float(result.get("aud", 0.0))
	var delta_zone = float(result.get("zone", 0.0))
	var heat_shift = int(result.get("heat_shift", 0))
	var hit_count = _mind_hits
	var spawn_count = _mind_spawned
	var lives_remaining = _mind_lives_remaining
	var lives_max = _mind_lives_max
	_mind_active = false
	_mind_barrage_done = true
	_mind_timer.stop()
	_mind_pull_speed_adjust = float(result.get("pull_speed_adjust", 0.0))
	_mind_force_worst_pull_speed = bool(result.get("force_worst_pull_speed", false))

	_technical_points += delta_spec
	_audience_points += delta_aud
	_zone_bonus += delta_zone
	_zone_bonus = clampf(_zone_bonus, -0.4, 1.2)
	_heat_state = clampi(_heat_state + heat_shift, -3, 3)
	_refresh_side_panel()
	GameManager.play_ui_se("confirm" if delta_spec >= 0.0 else "cancel")
	_show_step_result_and_next(
		"%s\n被弾 %d / 出現 %d\n専門 %+d / 一般 %+d\n吸い出し速度補正: %s" % [
			result_text,
			hit_count,
			maxi(spawn_count, 1),
			int(round(delta_spec)),
			int(round(delta_aud)),
			_mind_pull_adjust_text(),
		],
		_show_pull_step
	)
	_append_info("残機 %d / %d / 吸い出し速度補正: %s" % [lives_remaining, lives_max, _mind_pull_adjust_text()])


func _evaluate_mind_barrage_result() -> Dictionary:
	if _mind_lives_remaining <= 0:
		return {
			"text": "心が折れた。雑音に飲まれたまま吸い出しへ入る。",
			"spec": -14.0,
			"aud": -5.0,
			"zone": -0.05,
			"heat_shift": 2,
			"pull_speed_adjust": 0.45,
			"force_worst_pull_speed": true,
		}

	var pressure = float(_mind_hits) / float(maxi(_mind_spawned, 1))
	var life_ratio = float(_mind_lives_remaining) / float(maxi(_mind_lives_max, 1))
	var resilience = clampf(1.0 - pressure * 1.9 + life_ratio * 0.35, 0.0, 1.0)
	if _easy_mode:
		resilience = min(1.0, resilience + 0.08)

	if resilience >= 0.86:
		return {
			"text": "表情が落ち着いた。冷静さを取り戻した。",
			"spec": 15.0,
			"aud": 6.0,
			"zone": 0.10,
			"heat_shift": -1,
			"pull_speed_adjust": -0.18,
			"force_worst_pull_speed": false,
		}
	if resilience >= 0.68:
		return {
			"text": "揺れを抑えて、レシピに意識を戻した。",
			"spec": 8.0,
			"aud": 3.0,
			"zone": 0.05,
			"heat_shift": 0,
			"pull_speed_adjust": -0.10,
			"force_worst_pull_speed": false,
		}
	if resilience >= 0.45:
		return {
			"text": "迷いは残るが、ギリギリ持ちこたえた。",
			"spec": 1.0,
			"aud": 0.0,
			"zone": 0.0,
			"heat_shift": 0,
			"pull_speed_adjust": 0.06,
			"force_worst_pull_speed": false,
		}

	var panic_penalty = 0.0
	if _mind_hits >= int(round(_mind_duration_total * 0.7)):
		panic_penalty = 3.0
	return {
		"text": "他人の価値観に呑まれ、心がブレた。",
		"spec": -9.0 - panic_penalty,
		"aud": -3.0,
		"zone": -0.03,
		"heat_shift": 1,
		"pull_speed_adjust": 0.14,
		"force_worst_pull_speed": false,
	}


func _mind_pull_hint() -> String:
	if _mind_force_worst_pull_speed:
		return "最悪速度"
	if _mind_pull_speed_adjust <= -0.14:
		return "かなり遅い"
	if _mind_pull_speed_adjust <= -0.06:
		return "やや遅い"
	if _mind_pull_speed_adjust >= 0.10:
		return "速い"
	if _mind_pull_speed_adjust >= 0.04:
		return "やや速い"
	return "標準"


func _mind_pull_adjust_text() -> String:
	if _mind_force_worst_pull_speed:
		return "最悪速度固定（%.2f以上）" % MIND_BARRAGE_WORST_PULL_SPEED
	var trend = "遅くなる"
	if _mind_pull_speed_adjust > 0.0:
		trend = "速くなる"
	elif abs(_mind_pull_speed_adjust) < 0.001:
		trend = "変化なし"
	return "%+.2f（%s）" % [_mind_pull_speed_adjust, trend]


func _stop_mind_barrage() -> void:
	_mind_active = false
	if _mind_timer != null:
		_mind_timer.stop()
	for raw in _mind_bullets:
		if typeof(raw) != TYPE_DICTIONARY:
			continue
		var node = (raw as Dictionary).get("node") as Label
		if node != null and is_instance_valid(node):
			node.queue_free()
	_mind_bullets.clear()
	if _mind_player_node != null and is_instance_valid(_mind_player_node):
		_mind_player_node.queue_free()
	_mind_player_node = null
	_mind_arena_layer = null
	_mind_move_left = false
	_mind_move_right = false
	_mind_move_up = false
	_mind_move_down = false
	_mind_hit_se_cooldown = 0.0


func _mind_hit_flash() -> void:
	if _mind_arena_layer == null or not is_instance_valid(_mind_arena_layer):
		return
	var flash = ColorRect.new()
	flash.color = Color("e43b44", 0.35)
	flash.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	flash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_mind_arena_layer.add_child(flash)
	var tween = create_tween()
	tween.tween_property(flash, "color:a", 0.0, 0.2)
	tween.tween_callback(flash.queue_free)
	# プレイヤーノードも一瞬白く
	if _mind_player_node != null and is_instance_valid(_mind_player_node):
		_mind_player_node.modulate = Color(1.0, 1.0, 1.0, 1.0)
		var ptween = create_tween()
		ptween.tween_property(_mind_player_node, "modulate", Color.WHITE, 0.15)


func _mind_update_face() -> void:
	# 被弾数に応じて表情を変える
	var face_expressions := [
		{"max_hits": 0, "face": "normal", "text": "集中してる…"},
		{"max_hits": 1, "face": "worry", "text": "ちょっと不安だ…"},
		{"max_hits": 2, "face": "sad", "text": "心がブレてきた…"},
		{"max_hits": 99, "face": "shock", "text": "もうダメかも…"},
	]
	var chosen_face = "normal"
	var chosen_text = ""
	for expr in face_expressions:
		if _mind_hits <= int(expr.get("max_hits", 0)):
			chosen_face = str(expr.get("face", "normal"))
			chosen_text = str(expr.get("text", ""))
			break
	if chosen_face == "":
		chosen_face = "shock"
		chosen_text = "もうダメかも…"

	var face_path = "res://assets/sprites/characters/chr_hajime_%s.png" % chosen_face
	if not ResourceLoader.exists(face_path):
		face_path = "res://assets/sprites/characters/chr_hajime_normal.png"

	# 顔テクスチャの更新
	var face_node = choice_container.find_child("MindFaceRect", true, false) as TextureRect
	if face_node != null and ResourceLoader.exists(face_path):
		face_node.texture = load(face_path)
		# 揺れアニメーション
		var tween = create_tween()
		face_node.position.x += 4
		tween.tween_property(face_node, "position:x", face_node.position.x - 4, 0.15).set_trans(Tween.TRANS_ELASTIC)

	# セリフの更新
	var label_node = choice_container.find_child("MindFaceLabel", true, false) as Label
	if label_node != null:
		label_node.text = chosen_text


func _show_pull_step() -> void:
	if not _mind_barrage_done:
		_show_mind_barrage_intro("吸い出し前に精神戦を完了する。")
		return
	var round_number = _pull_round + 1
	_set_phase(
		8,
		"吸い出し %d / %d" % [round_number, PULL_MAX_ROUNDS],
		"押している間だけ吸い出し、離した瞬間で判定。最低%d回、最大%d回。熱状態: %s\n精神戦補正: %s" % [
			PULL_MIN_ROUNDS,
			PULL_MAX_ROUNDS,
			_heat_label(),
			_mind_pull_adjust_text(),
		]
	)
	_clear_choices()
	_pull_timer.stop()
	_pull_is_holding = false
	_pull_step_resolved = false
	_pull_hold_button = null

	var difficulty = 1.0
	if not PULL_DIFFICULTY.is_empty():
		var difficulty_index = mini(_pull_round, PULL_DIFFICULTY.size() - 1)
		difficulty = float(PULL_DIFFICULTY[difficulty_index])
	var setting_window_adjust = _get_pull_window_adjust_by_setting()
	var setting_speed_adjust = _get_pull_speed_adjust_by_setting()
	_pull_target_width = clampf(0.22 - difficulty * 0.08 - float(abs(_heat_state)) * 0.01 + setting_window_adjust, 0.05, 0.24)
	if PlayerData.equipment_charcoal == "cube_charcoal":
		_pull_target_width = maxi(0.05, _pull_target_width - 0.02)
	if _easy_mode:
		_pull_target_width = mini(0.26, _pull_target_width + 0.04)

	_pull_target_center = clampf(0.5 + float(_heat_state) * 0.07 + randf_range(-0.12, 0.12), 0.15, 0.85)
	var base_speed = 0.85 + float(_pull_round) * 0.2 + float(abs(_heat_state)) * 0.06 + setting_speed_adjust
	if _mind_force_worst_pull_speed:
		_pull_gauge_speed = MIND_BARRAGE_WORST_PULL_SPEED + float(_pull_round) * 0.22 + float(abs(_heat_state)) * 0.08
	else:
		_pull_gauge_speed = base_speed + _mind_pull_speed_adjust
	if _easy_mode and not _mind_force_worst_pull_speed:
		_pull_gauge_speed = maxi(0.6, _pull_gauge_speed - 0.15)
	_pull_gauge_speed = clampf(_pull_gauge_speed, 0.55, 3.25)
	_pull_gauge_value = clampf(_pull_target_center + randf_range(-0.18, 0.18), 0.0, 1.0)
	_pull_gauge_direction = 1.0

	var setting_hint = ""
	if setting_window_adjust <= -0.02:
		setting_hint = "装備補正: シビア（判定が狭い）"
	elif setting_window_adjust >= 0.02:
		setting_hint = "装備補正: 安定（判定が広い）"
	else:
		setting_hint = "装備補正: 標準"
	_pull_setting_hint = "%s / 精神戦: %s（%s）" % [setting_hint, _mind_pull_hint(), _mind_pull_adjust_text()]

	var hold_button = Button.new()
	hold_button.text = "押して吸う（離して止める）"
	hold_button.custom_minimum_size = Vector2(0, 48)
	hold_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hold_button.button_down.connect(_on_pull_hold_started)
	hold_button.button_up.connect(_on_pull_hold_released)
	choice_container.add_child(hold_button)
	_pull_hold_button = hold_button
	if _pull_round >= PULL_MIN_ROUNDS:
		_add_choice_button("ここで提供に進む", _on_pull_skip_to_serving)

	if PlayerData.equipment_charcoal == "cube_charcoal":
		_append_info("キューブ炭: 当てれば高得点、外すと失点が重い。")
	_refresh_side_panel()
	_update_pull_gauge_text()


func _on_pull_gauge_tick() -> void:
	if not _pull_is_holding:
		return
	var delta = _pull_timer.wait_time
	_pull_gauge_value += _pull_gauge_direction * _pull_gauge_speed * delta
	if _pull_gauge_value >= 1.0:
		_pull_gauge_value = 1.0
		_pull_gauge_direction = -1.0
	elif _pull_gauge_value <= 0.0:
		_pull_gauge_value = 0.0
		_pull_gauge_direction = 1.0
	_update_pull_gauge_text()


func _update_pull_gauge_text() -> void:
	var bar_len = 24
	var pointer_index = int(round(_pull_gauge_value * float(bar_len - 1)))
	var target_start = int(round(clampf(_pull_target_center - _pull_target_width, 0.0, 1.0) * float(bar_len - 1)))
	var target_end = int(round(clampf(_pull_target_center + _pull_target_width, 0.0, 1.0) * float(bar_len - 1)))

	var bar_chars: Array[String] = []
	for i in range(bar_len):
		var char = "─"
		if i >= target_start and i <= target_end:
			char = "■"
		if i == pointer_index:
			char = "◆"
		bar_chars.append(char)

	var status_text = "吸い出し中...離すと判定" if _pull_is_holding else "ボタンを押して吸い出し開始"
	info_label.text = "%s\n%s\n%s\n目標帯 ■ / ポインタ ◆\n※このゲージはタイミング用。温度は右パネルの縦表示で確認。" % [
		status_text,
		_pull_setting_hint,
		"".join(bar_chars),
	]


func _on_pull_hold_started() -> void:
	if _pull_step_resolved:
		return
	if _pull_is_holding:
		return
	_pull_is_holding = true
	if _pull_hold_button != null:
		_pull_hold_button.text = "吸い出し中...（離して止める）"
	if _pull_timer.is_stopped():
		_pull_timer.start()
	GameManager.play_ui_se("cursor")
	_update_pull_gauge_text()


func _on_pull_hold_released() -> void:
	if _pull_step_resolved:
		return
	if not _pull_is_holding:
		return
	_pull_is_holding = false
	if _pull_hold_button != null:
		_pull_hold_button.disabled = true
	if not _pull_timer.is_stopped():
		_pull_timer.stop()
	_resolve_pull_result()


func _resolve_pull_result() -> void:
	if _pull_step_resolved:
		return
	_pull_step_resolved = true
	var distance = abs(_pull_gauge_value - _pull_target_center)
	var quality = "miss"
	if distance <= _pull_target_width * 0.35:
		quality = "perfect"
	elif distance <= _pull_target_width:
		quality = "good"
	elif distance <= _pull_target_width * 1.7:
		quality = "near"

	var delta_spec = 0.0
	var delta_aud = 0.0
	var result_text = ""
	match quality:
		"perfect":
			delta_spec = 24.0
			delta_aud = 6.0
			_pull_quality_total += 3.0
			_pull_hit_count += 1
			_heat_state += 1
			result_text = "完璧停止"
		"good":
			delta_spec = 14.0
			delta_aud = 3.0
			_pull_quality_total += 2.0
			_pull_hit_count += 1
			_heat_state += 1
			result_text = "有効停止"
		"near":
			delta_spec = 4.0
			delta_aud = 1.0
			_pull_quality_total += 1.0
			_heat_state += 1
			result_text = "ニア停止"
		_:
			delta_spec = -10.0
			delta_aud = -1.0
			_heat_state += 2
			result_text = "ミス停止"

	if PlayerData.equipment_charcoal == "cube_charcoal":
		if quality == "perfect":
			delta_spec += 8.0
			delta_aud += 4.0
		elif quality == "miss":
			delta_spec -= 4.0

	_technical_points += delta_spec
	_audience_points += delta_aud
	_heat_state = clampi(_heat_state, -3, 3)
	_pull_round += 1
	GameManager.play_ui_se("confirm" if quality != "miss" else "cancel")

	var next_callable = _show_pull_step if _pull_round < PULL_MAX_ROUNDS else _show_serving_step
	if _pull_round >= PULL_MAX_ROUNDS:
		_show_mid_score_reveal()  # 吸い出し完了 → ドラマチック中間発表
	_show_step_result_and_next("%s: 専門 %+d / 一般 %+d" % [result_text, int(round(delta_spec)), int(round(delta_aud))], next_callable)


func _on_pull_skip_to_serving() -> void:
	if _pull_round < PULL_MIN_ROUNDS:
		GameManager.play_ui_se("cancel")
		return
	_pull_timer.stop()
	_pull_is_holding = false
	_pull_step_resolved = true
	GameManager.play_ui_se("confirm")
	_show_step_result_and_next("吸い出しを切り上げて提供へ移る。", _show_serving_step)


func _get_pull_window_adjust_by_setting() -> float:
	var adjust = 0.0
	match _selected_hms:
		"tanukish_lid":
			adjust += 0.025
		"amaburst":
			adjust -= 0.03
		"winkwink_hagal":
			adjust += 0.01
	match _selected_bowl:
		"silicone_bowl":
			adjust += 0.01
		"suyaki":
			adjust -= 0.01
		"hagal_80beat":
			adjust += 0.005
	return adjust


func _get_pull_speed_adjust_by_setting() -> float:
	var adjust = 0.0
	match _selected_hms:
		"tanukish_lid":
			adjust -= 0.06
		"amaburst":
			adjust += 0.12
		"winkwink_hagal":
			adjust -= 0.03
	match _selected_bowl:
		"silicone_bowl":
			adjust -= 0.03
		"suyaki":
			adjust += 0.04
	return adjust


func _show_serving_step() -> void:
	_set_phase(9, "提供", "吸い出しを終えた。提供してお客さんの反応を見る。")
	_clear_choices()
	var lines: Array[String] = []
	lines.append("吸い出しヒット: %d / %d" % [_pull_hit_count, maxi(_pull_round, 1)])
	lines.append("吸い出し品質: %.1f" % _pull_quality_total)
	info_label.text = "\n".join(lines)
	_add_choice_button("提供する", _on_serving_confirmed)
	_refresh_side_panel()


func _on_serving_confirmed() -> void:
	var spec_gain = 4.0 + _pull_quality_total * 1.8 + PlayerData.stat_technique * 0.03
	var aud_gain = 3.0 + float(_pull_hit_count) * 2.0 + PlayerData.stat_charm * 0.02
	
	# Apply pull round bonus: Fewer pulls = greater bonus
	var bonus_text = ""
	if _pull_round == 2:
		spec_gain += 12.0
		aud_gain += 8.0
		bonus_text = " (最速吸い出しボーナス!)"
	elif _pull_round == 3:
		spec_gain += 5.0
		aud_gain += 3.0
		bonus_text = " (早め吸い出しボーナス)"
	
	_technical_points += spec_gain
	_audience_points += aud_gain
	GameManager.play_ui_se("confirm")
	_show_step_result_and_next("提供評価: 専門 %+d / 一般 %+d%s" % [int(round(spec_gain)), int(round(aud_gain)), bonus_text], _show_round_result.bind(1))


func _show_round_result(round_num: int) -> void:
	_set_phase(12, "ラウンド%d 終了" % round_num, "現在の暫定スコアと順位。")
	_clear_choices()

	var player_score = _build_player_score()
	var player_total = float(player_score.get("total", 0.0))
	_mid_player_total = player_total
	_mid_rival_totals.clear()

	var ranking: Array = []
	ranking.append(player_score)
	var rivals = _build_rival_mid_scores()
	for rival in rivals:
		var row = rival as Dictionary
		_mid_rival_totals[str(row.get("id", ""))] = float(row.get("total", 0.0))
	ranking.append_array(rivals)
	ranking.sort_custom(func(a, b):
		return float(a.get("total", 0.0)) > float(b.get("total", 0.0))
	)

	var lines: Array[String] = ["【ラウンド%d 暫定順位】" % round_num]
	for i in range(ranking.size()):
		var row: Dictionary = ranking[i]
		var row_id = str(row.get("id", ""))
		var row_total = float(row.get("total", 0.0))
		if row_id == "player":
			lines.append("%d位 %s %.1f点（あなた）" % [i + 1, str(row.get("name", "-")), row_total])
		else:
			lines.append("%d位 %s %.1f点（差 %+.1f）" % [
				i + 1,
				str(row.get("name", "-")),
				row_total,
				player_total - row_total,
			])

	info_label.text = "\n".join(lines)
	
	# ラウンド終了ごとのシナリオ再生と次のフェーズへの遷移セット
	var dialogue_id = ""
	var next_callable: Callable
	if round_num == 1:
		dialogue_id = "ch1_tournament_r1_end"
		next_callable = _show_adjustment_menu.bind(0)
	elif round_num == 2:
		dialogue_id = "ch1_tournament_r2_end"
		next_callable = _show_adjustment_menu.bind(1)
	else:
		dialogue_id = "ch1_tournament_r3_end"
		next_callable = _show_presentation_intro
		
	_add_choice_button("次へ進む", _play_mini_dialogue.bind(dialogue_id, next_callable))
	_refresh_side_panel()


func _show_adjustment_menu(round_index: int) -> void:
	var round_num = round_index + 2 # _show_adjustment_menu(0) means Round 2
	var step_no = 10 + round_index
	_set_phase(step_no, "ラウンド%d: 調整" % round_num, "現在の炭: %d個 / 熱状態: %d\nどう調整する？" % [_selected_charcoal_count, _heat_state])
	_clear_choices()

	_add_choice_button("炭の調整を行う", _show_charcoal_adjust_step.bind(round_index))
	_add_choice_button("吸い出しで微調整する", _show_pull_adjust_step.bind(round_index))
	
	if _adjustment_action_count >= 2:
		_add_choice_button("調整を終える（次に進む）", _finish_adjustment_phase.bind(round_index))
	else:
		var btn = _add_choice_button("調整を終える（あと%d回アクションが必要）" % (2 - _adjustment_action_count), _finish_adjustment_phase.bind(round_index))
		btn.disabled = true


func _show_charcoal_adjust_step(round_index: int) -> void:
	_set_phase(10 + round_index, "炭の調整", "現在の炭は%d個だ。どうする？\n※炭の増減は熱状態に直結する。" % _selected_charcoal_count)
	_clear_choices()
	
	if _selected_charcoal_count > 2:
		_add_choice_button("炭を1個減らす（現在%d -> %d）" % [_selected_charcoal_count, _selected_charcoal_count - 1], _apply_charcoal_change.bind(-1, false, round_index))
	if _selected_charcoal_count < 4:
		_add_choice_button("炭を1個増やす（現在%d -> %d）" % [_selected_charcoal_count, _selected_charcoal_count + 1], _apply_charcoal_change.bind(1, false, round_index))
	_add_choice_button("新しい炭に交換する", _apply_charcoal_change.bind(0, true, round_index))
	_add_choice_button("戻る", _show_adjustment_menu.bind(round_index))


func _apply_charcoal_change(diff: int, is_new: bool, round_index: int) -> void:
	_selected_charcoal_count += diff
	var heat_change = diff
	if is_new:
		heat_change += 1
	
	_heat_state = clampi(_heat_state + heat_change, -3, 3)
	_adjustment_action_count += 1
	
	var msg = "炭の数を調整した。" if diff != 0 else "新しい炭に交換した。温度が少し上がる。"
	GameManager.play_ui_se("confirm")
	_show_step_result_and_next(msg, _show_adjustment_menu.bind(round_index))


func _show_pull_adjust_step(round_index: int) -> void:
	var target_action = _target_adjust_action()
	_adjust_target_action = target_action
	var cue = _build_adjustment_cue(target_action, round_index)
	_set_phase(
		10 + round_index,
		"吸い出し微調整",
		cue + "\n方向を選択してから、ゲージでタイミング調整する。"
	)
	_clear_choices()
	_add_choice_button("温度を上げる（蓋を閉める・強めに吸う）", _on_adjust_action_selected.bind("up", round_index))
	_add_choice_button("現状維持", _on_adjust_action_selected.bind("stay", round_index))
	_add_choice_button("温度を下げる（蓋を開ける・弱めに吸う）", _on_adjust_action_selected.bind("down", round_index))
	_add_choice_button("戻る", _show_adjustment_menu.bind(round_index))


func _target_adjust_action() -> String:
	if _heat_state >= 2:
		return "down"
	if _heat_state <= -2:
		return "up"
	return "stay"


func _build_adjustment_cue(target_action: String, round_index: int) -> String:
	var judge_name = "土岐 鋼鉄"
	if round_index == 1:
		judge_name = str(_random_judge.get("name", "審査員"))

	var lines: Array[String] = []
	if _heat_state >= 2:
		lines.append("%s が短く咳払い。熱が強すぎるかもしれない。" % judge_name)
	elif _heat_state <= -2:
		lines.append("%s が首をかしげた。煙が薄いかもしれない。" % judge_name)
	else:
		lines.append("%s の表情は読みづらい。" % judge_name)

	if PlayerData.stat_insight >= 35:
		lines.append("洞察ヒント: %s が有効。" % _adjust_action_label(target_action))
	elif PlayerData.stat_insight >= 25:
		lines.append("洞察ヒント: 今は大きく動かしすぎない方が良い。")

	if not _easy_mode and randf() < 0.25:
		lines.append("パッキー「%s が正解かも♪」" % _adjust_action_label(_fake_action(target_action)))

	return "\n".join(lines)


func _fake_action(target_action: String) -> String:
	if target_action == "up":
		return "down"
	if target_action == "down":
		return "up"
	return ["up", "down"][randi() % 2]


func _adjust_action_label(action: String) -> String:
	match action:
		"up":
			return "温度を上げる"
		"down":
			return "温度を下げる"
		_:
			return "現状維持"


func _on_adjust_action_selected(action_id: String, round_index: int) -> void:
	_adjust_selected_action = action_id
	_show_adjustment_gauge_step(round_index)


func _show_adjustment_gauge_step(round_index: int) -> void:
	_set_phase(
		10 + round_index,
		"微調整ゲージ",
		"選択した方向: %s\n押している間だけ調整、離した瞬間で判定。\n判定は PERFECT / GOOD / NEAR / MISS。" % _adjust_action_label(_adjust_selected_action)
	)
	_clear_choices()
	_adjust_step_finished = false
	_adjust_is_holding = false
	
	var speed = 1.02 + float(abs(_heat_state)) * 0.16
	_adjust_gauge_speed = clampf(speed, 0.8, 2.4)
	_adjust_target_width = clampf(0.18 - float(abs(_heat_state)) * 0.015, 0.08, 0.22)
	_adjust_target_center = clampf(0.5 + randf_range(-0.08, 0.08), 0.2, 0.8)
	_adjust_gauge_value = clampf(_adjust_target_center + randf_range(-0.2, 0.2), 0.0, 1.0)
	_adjust_gauge_direction = 1.0

	var hold_button = Button.new()
	hold_button.text = "押して調整（離して決定）"
	hold_button.custom_minimum_size = Vector2(0, 48)
	hold_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hold_button.button_down.connect(_on_adjust_hold_started)
	hold_button.button_up.connect(func(): _on_adjust_hold_released(round_index))
	choice_container.add_child(hold_button)

	_update_adjust_text("調整待機中")


func _on_adjust_hold_started() -> void:
	if _adjust_step_finished or _adjust_is_holding:
		return
	_adjust_is_holding = true
	if _adjust_timer.is_stopped():
		_adjust_timer.start()
	GameManager.play_ui_se("cursor")
	_update_adjust_text("調整中...離すと判定")


func _on_adjust_hold_released(round_index: int) -> void:
	if _adjust_step_finished or not _adjust_is_holding:
		return
	_adjust_is_holding = false
	if not _adjust_timer.is_stopped():
		_adjust_timer.stop()
	_resolve_adjustment_round(round_index)


func _on_adjust_timer_tick() -> void:
	if not _adjust_is_holding:
		return
	var delta = _adjust_timer.wait_time
	_adjust_gauge_value += _adjust_gauge_direction * _adjust_gauge_speed * delta
	if _adjust_gauge_value >= 1.0:
		_adjust_gauge_value = 1.0
		_adjust_gauge_direction = -1.0
	elif _adjust_gauge_value <= 0.0:
		_adjust_gauge_value = 0.0
		_adjust_gauge_direction = 1.0
	_update_adjust_text("調整中...離すと判定")


func _update_adjust_text(status_text: String) -> void:
	var bar = _build_gauge_bar(_adjust_gauge_value, _adjust_target_center, _adjust_target_width)
	var lines: Array[String] = []
	lines.append(status_text)
	lines.append("タイミング目標帯 ■ / ポインタ ◆")
	lines.append(bar)
	info_label.text = "\n".join(lines)


func _resolve_adjustment_round(round_index: int) -> void:
	_adjust_step_finished = true
	var quality = _evaluate_gauge_quality(_adjust_gauge_value, _adjust_target_center, _adjust_target_width)
	var action_correct = _adjust_selected_action == _adjust_target_action
	var timing_good = quality == "perfect" or quality == "good"
	var success = action_correct and timing_good

	var result_line = ""
	if success:
		_adjustment_hits += 1
		_technical_points += 4.0
		if _heat_state > 0:
			_heat_state -= 1
		elif _heat_state < 0:
			_heat_state += 1
		result_line = "方向もタイミングも正解。見事に熱を抑え込んだ！（調整成功）"
	else:
		_technical_points -= 4.0
		match _adjust_selected_action:
			"up":
				_heat_state += 1
			"down":
				_heat_state -= 1
			_:
				if _heat_state > 0:
					_heat_state += 1
				elif _heat_state < 0:
					_heat_state -= 1
		result_line = "調整ミス。熱状態が悪化した。"

	_heat_state = clampi(_heat_state, -3, 3)
	
	GameManager.play_ui_se("confirm" if success else "cancel")
	_update_adjust_text(
		"判定: %s\n%s\n現在熱状態: %d" % [
			quality.to_upper(),
			result_line,
			_heat_state,
		]
	)
	_clear_choices()
	_adjustment_action_count += 1
	_add_choice_button("調整メニューに戻る", _show_adjustment_menu.bind(round_index))


func _finish_adjustment_phase(round_index: int) -> void:
	_adjustment_action_count = 0
	
	if round_index == 1 and _adjustment_hits >= 2:
		_technical_points += 5.0
		_audience_points += 2.0
		_show_step_result_and_next("連続調整成功ボーナス獲得！", _show_round_result.bind(round_index + 1))
	else:
		var next_callable: Callable = _show_round_result.bind(round_index + 1)
		_show_step_result_and_next("調整時間を終え、次の時間へ進む。", next_callable)


func _show_presentation_intro() -> void:
	var judge_focuses = _get_active_judge_focuses()
	var judge_labels: Array[String] = []
	for focus_id in judge_focuses:
		judge_labels.append(str(PRESENTATION_FOCUS_LABEL.get(focus_id, focus_id)))
	_set_phase(
		14,
		"プレゼン: 強調ポイント",
		"売りを1〜2個だけ選んで押し出す。\n審査員が刺さる軸: %s" % " / ".join(judge_labels)
	)
	_clear_choices()
	_presentation_primary_focus = ""
	_presentation_secondary_focus = ""
	_add_choice_button("1つ目の強調ポイントを選ぶ", _show_presentation_primary_choice)
	_refresh_side_panel()


func _show_presentation_primary_choice() -> void:
	_set_phase(14, "プレゼン: 1つ目", "まず最優先で押し出す売りを1つ選ぶ。")
	_clear_choices()
	for focus in PRESENTATION_FOCUS_OPTIONS:
		var focus_id = str(focus.get("id", ""))
		var label = str(focus.get("name", focus_id))
		_add_choice_button(label, _on_presentation_primary_selected.bind(focus_id))
	_refresh_side_panel()


func _on_presentation_primary_selected(focus_id: String) -> void:
	_presentation_primary_focus = focus_id
	_show_presentation_secondary_choice()


func _show_presentation_secondary_choice() -> void:
	var primary_label = str(PRESENTATION_FOCUS_LABEL.get(_presentation_primary_focus, _presentation_primary_focus))
	_set_phase(14, "プレゼン: 2つ目", "1つ目は「%s」。2つ目を足すか、1点突破でいくか選ぶ。" % primary_label)
	_clear_choices()
	_add_choice_button("1点突破でいく", _on_presentation_secondary_selected.bind(""))
	for focus in PRESENTATION_FOCUS_OPTIONS:
		var focus_id = str(focus.get("id", ""))
		if focus_id == _presentation_primary_focus:
			continue
		var label = str(focus.get("name", focus_id))
		_add_choice_button(label, _on_presentation_secondary_selected.bind(focus_id))
	_refresh_side_panel()


func _on_presentation_secondary_selected(focus_id: String) -> void:
	_presentation_secondary_focus = focus_id
	_resolve_presentation_focus()


func _resolve_presentation_focus() -> void:
	var selected: Array[String] = [_presentation_primary_focus]
	if _presentation_secondary_focus != "":
		selected.append(_presentation_secondary_focus)

	var focus_scores = _build_focus_scores()
	var judge_focuses = _get_active_judge_focuses()
	var spec_gain = 4.0
	var aud_gain = 4.0
	var lines: Array[String] = []
	var judge_hit = false

	for focus in PRESENTATION_FOCUS_OPTIONS:
		var focus_id = str(focus.get("id", ""))
		var focus_label = str(focus.get("name", focus_id))
		var score = float(focus_scores.get(focus_id, 50.0))
		if selected.has(focus_id):
			lines.append("強調: %s（適性 %.0f）" % [focus_label, score])
			var push_gain = (score - 55.0) * 0.24
			spec_gain += push_gain * 0.75
			aud_gain += push_gain * 0.55
			if judge_focuses.has(focus_id):
				spec_gain += 4.0
				aud_gain += 2.0
				judge_hit = true
		elif score < 52.0:
			var expose = (52.0 - score) * 0.22
			spec_gain -= expose
			aud_gain -= expose * 0.7
			lines.append("未強調の弱点露出: %s（-%d）" % [focus_label, int(round(expose))])

	if selected.size() == 2:
		var pair_diff = abs(float(focus_scores.get(selected[0], 50.0)) - float(focus_scores.get(selected[1], 50.0)))
		if pair_diff <= 10.0:
			spec_gain += 3.0
			aud_gain += 3.0
			lines.append("二軸が噛み合い、説得力が上がった。")
		elif pair_diff >= 28.0:
			spec_gain -= 2.0
			aud_gain -= 1.0
			lines.append("二軸の温度差が出て、訴求がブレた。")
	else:
		var single_score = float(focus_scores.get(selected[0], 50.0))
		if single_score >= 72.0:
			spec_gain += 2.0
			aud_gain += 4.0
			lines.append("1点突破がハマった。")
		elif single_score < 55.0:
			spec_gain -= 3.0
			lines.append("1点突破の根拠が弱く、押し切れなかった。")

	if not judge_hit:
		spec_gain -= 4.0
		lines.append("審査員の好みを外したため、専門評価が伸びない。")

	if _special_mix_name != "" and selected.has("unique"):
		aud_gain += 3.0
		lines.append("特別ミックスの語りが個性評価に直結した。")
	if _easy_mode:
		spec_gain += 2.0
		aud_gain += 1.0

	_technical_points += spec_gain
	_audience_points += aud_gain
	lines.append("プレゼン結果: 専門 %+d / 一般 %+d" % [int(round(spec_gain)), int(round(aud_gain))])
	_show_step_result_and_next("\n".join(lines), _finalize_and_show_result)


func _build_focus_scores() -> Dictionary:
	var theme_hit = _count_theme_hits(_selected_flavors)
	var pull_rate = float(_pull_hit_count) / float(maxi(_pull_round, 1))
	var target_temp = _get_target_temp_range()
	var current_temp = _get_current_temp_value()
	var target_center = (target_temp.x + target_temp.y) * 0.5
	var temp_error = abs(current_temp - target_center)
	var temp_quality = clampf(1.0 - temp_error / 34.0, 0.0, 1.0)
	var stability = clampf(1.0 - float(abs(_heat_state)) / 3.0, 0.0, 1.0)
	var charcoal_bonus = 4.0 if _selected_charcoal_count == 4 else 0.0

	var taste = 46.0 + float(theme_hit) * 8.0 + PlayerData.stat_sense * 0.55 + _technical_points * 0.04 + temp_quality * 14.0
	var smoke = 44.0 + _zone_bonus * 20.0 + pull_rate * 24.0 + PlayerData.stat_guts * 0.35 + charcoal_bonus
	var ease = 45.0 + stability * 16.0 + temp_quality * 14.0 + float(_adjustment_hits) * 6.0 + PlayerData.stat_insight * 0.4
	var unique = 42.0 + PlayerData.stat_charm * 0.6 + _audience_points * 0.04 + float(_used_memo_count) * 2.0

	if _special_mix_name != "":
		unique += 16.0
	if _selected_hms == "amaburst":
		smoke += 4.0
		ease -= 4.0
	elif _selected_hms == "tanukish_lid":
		ease += 5.0
	if _easy_mode:
		taste += 2.0
		smoke += 2.0
		ease += 2.0
		unique += 2.0

	return {
		"taste": clampf(taste, 20.0, 100.0),
		"smoke": clampf(smoke, 20.0, 100.0),
		"ease": clampf(ease, 20.0, 100.0),
		"unique": clampf(unique, 20.0, 100.0),
	}


func _get_active_judge_focuses() -> Array[String]:
	var focus_ids: Array[String] = []
	var judge_ids = ["toki_kotetsu", str(_random_judge.get("id", ""))]
	for judge_id in judge_ids:
		var raw = JUDGE_FOCUS_PREFERENCES.get(judge_id, [])
		if typeof(raw) != TYPE_ARRAY:
			continue
		for focus in raw:
			var focus_id = str(focus)
			if focus_id == "":
				continue
			if not focus_ids.has(focus_id):
				focus_ids.append(focus_id)
	return focus_ids


func _finalize_and_show_result() -> void:
	_set_phase(15, "最終発表", "専門審査60% + 一般投票40%")
	_clear_choices()

	var ranking: Array = []
	var player_score = _build_player_score()
	ranking.append(player_score)
	ranking.append_array(_build_rival_scores())

	ranking.sort_custom(func(a, b):
		return float(a.get("total", 0.0)) > float(b.get("total", 0.0))
	)

	_player_rank = 4
	for i in range(ranking.size()):
		if str(ranking[i].get("id", "")) == "player":
			_player_rank = i + 1
			break

	_pending_reward = int(REWARD_BY_RANK.get(_player_rank, 0))
	if _player_rank == 1:
		EventFlags.set_value("ch1_tournament_loss_count", 0)
	else:
		_pending_reward = 0
		var losses = int(EventFlags.get_value("ch1_tournament_loss_count", 0)) + 1
		EventFlags.set_value("ch1_tournament_loss_count", losses)

	var lines: Array[String] = []
	lines.append("【あなたの得点内訳】")
	lines.append_array(_build_player_score_breakdown_lines())
	lines.append("")
	lines.append("【最終順位】")
	for i in range(ranking.size()):
		var row: Dictionary = ranking[i]
		var row_id = str(row.get("id", ""))
		var mid_total = _mid_player_total if row_id == "player" else float(_mid_rival_totals.get(row_id, float(row.get("total", 0.0))))
		var diff_from_mid = float(row.get("total", 0.0)) - mid_total
		lines.append("%d位 %s  %.1f点（専門 %.1f / 一般 %.1f）" % [
			i + 1,
			str(row.get("name", "-")),
			float(row.get("total", 0.0)),
			float(row.get("specialist", 0.0)),
			float(row.get("audience", 0.0)),
		])
		lines.append("   中間比 %+.1f" % diff_from_mid)

	if _special_mix_name != "":
		lines.append("特別ミックス: %s" % _special_mix_name)
	if _player_rank == 1:
		lines.append("賞金: %d円" % _pending_reward)
		lines.append("地方大会優勝！")
	else:
		lines.append("今回は %d位。1位になるまで本編進行不可。" % _player_rank)
		lines.append("賞金は再挑戦中は支給されない。")

	info_label.text = ""
	# ダンガンロンパ風: 段階的に結果を表示する演出
	await _dramatic_result_reveal(ranking)

	if _player_rank == 1:
		_add_choice_button("優勝結果で進む", _apply_result_and_continue)
	else:
		_add_choice_button("もう一度挑戦する", _retry_tournament)
		var losses = int(EventFlags.get_value("ch1_tournament_loss_count", 0))
		if not _easy_mode and losses >= 2:
			_add_choice_button("難易度を下げて再挑戦", _enable_easy_mode_and_retry)
	_add_choice_button("タイトルに戻る", _return_to_title)
	_refresh_side_panel()


func _dramatic_result_reveal(ranking: Array) -> void:
	# 得点内訳をまず表示
	var breakdown_lines: Array[String] = []
	breakdown_lines.append("【あなたの得点内訳】")
	breakdown_lines.append_array(_build_player_score_breakdown_lines())
	info_label.text = "\n".join(breakdown_lines)
	await get_tree().create_timer(1.0).timeout

	# 「最終順位発表」のテキストをバーンと表示
	info_label.text += "\n\n【 最 終 順 位 発 表 】"
	GameManager.play_ui_se("confirm")
	await get_tree().create_timer(0.8).timeout

	# 下位から段階的に表示（ダンガンロンパの投票結果風）
	for i in range(ranking.size() - 1, -1, -1):
		var row: Dictionary = ranking[i]
		var row_id = str(row.get("id", ""))
		var mid_total = _mid_player_total if row_id == "player" else float(_mid_rival_totals.get(row_id, float(row.get("total", 0.0))))
		var is_player = row_id == "player"
		var rank_marker = "★" if is_player else "─"
		var name_text = str(row.get("name", "-"))

		info_label.text += "\n%s %d位  %s  %.1f点（専門 %.1f / 一般 %.1f）" % [
			rank_marker,
			i + 1,
			name_text,
			float(row.get("total", 0.0)),
			float(row.get("specialist", 0.0)),
			float(row.get("audience", 0.0)),
		]
		GameManager.play_ui_se("cursor")
		await get_tree().create_timer(0.7).timeout

	# 結果メッセージ
	await get_tree().create_timer(0.3).timeout
	if _special_mix_name != "":
		info_label.text += "\n特別ミックス: %s" % _special_mix_name
	if _player_rank == 1:
		info_label.text += "\n\n賞金: %d円" % _pending_reward
		info_label.text += "\n地方大会優勝！"
		_dramatic_impact("優勝！")
	else:
		info_label.text += "\n\n今回は %d位。1位になるまで本編進行不可。" % _player_rank
		info_label.text += "\n賞金は再挑戦中は支給されない。"
		_screen_shake(6.0, 0.25)


func _build_player_score() -> Dictionary:
	var score = _compute_player_score_components()
	return {
		"id": "player",
		"name": "はじめ",
		"specialist": float(score.get("specialist", 0.0)),
		"audience": float(score.get("audience", 0.0)),
		"total": float(score.get("total", 0.0)),
	}


func _compute_player_score_components() -> Dictionary:
	var specialist_base = _technical_points + _zone_bonus * 8.0 + float(_adjustment_hits) * 2.5
	var specialist = maxi(0.0, specialist_base)
	var audience_base = _audience_points + float(_count_theme_hits(_selected_flavors)) * 4.0
	var audience = maxi(0.0, audience_base)
	var specialist_mix_bonus = 0.0
	var audience_mix_bonus = 0.0

	if _special_mix_name == "地獄のメンソール":
		audience_mix_bonus += 8.0
	if _special_mix_name == "ピニャコラーダ":
		specialist_mix_bonus += 4.0
		audience_mix_bonus += 5.0

	
	var eq_flavor_bonus = PlayerData.get_equipment_flavor_bonus(_selected_flavors)
	specialist_mix_bonus += float(eq_flavor_bonus.get("specialist", 0.0))
	audience_mix_bonus += float(eq_flavor_bonus.get("audience", 0.0))


	var pipe_spec_bonus = 0.0
	var pipe_aud_bonus = 0.0
	if PlayerData.PIPE_DATA.has(PlayerData.equipment_pipe):
		var pd = PlayerData.PIPE_DATA[PlayerData.equipment_pipe]
		# 専門: 味 + 煙 / 一般: 味 + 見栄え
		pipe_spec_bonus = float(pd.get("taste_bonus", 0) + pd.get("smoke_bonus", 0))
		pipe_aud_bonus = float(pd.get("taste_bonus", 0) + pd.get("presentation_bonus", 0))

	specialist += specialist_mix_bonus + pipe_spec_bonus
	audience += audience_mix_bonus + pipe_aud_bonus
	var weighted = specialist * 0.6 + audience * 0.4
	var easy_bonus = 3.0 if _easy_mode else 0.0
	return {
		"specialist": specialist,
		"audience": audience,
		"weighted": weighted,
		"easy_bonus": easy_bonus,
		"total": weighted + easy_bonus,
		"specialist_mix_bonus": specialist_mix_bonus,
		"audience_mix_bonus": audience_mix_bonus,
		"pipe_spec_bonus": pipe_spec_bonus,
		"pipe_aud_bonus": pipe_aud_bonus,
	}


func _build_player_score_breakdown_lines() -> Array[String]:
	var comp = _compute_player_score_components()
	var lines: Array[String] = []
	lines.append("専門 %.1f = max(0, 技術 %.1f + ゾーン %.1f + 調整 %.1f) + ミックス %.1f" % [
		float(comp.get("specialist", 0.0)),
		_technical_points,
		_zone_bonus * 8.0,
		float(_adjustment_hits) * 2.5,
		float(comp.get("specialist_mix_bonus", 0.0)),
	])
	lines.append("一般 %.1f = max(0, 一般基礎 %.1f + テーマ %.1f) + ミックス %.1f" % [
		float(comp.get("audience", 0.0)),
		_audience_points,
		float(_count_theme_hits(_selected_flavors)) * 4.0,
		float(comp.get("audience_mix_bonus", 0.0)),
	])
	lines.append("総合 %.1f = 専門×0.6 + 一般×0.4%s" % [
		float(comp.get("total", 0.0)),
		(" + EASY %+d" % int(round(float(comp.get("easy_bonus", 0.0))))) if _easy_mode else "",
	])
	return lines


func _prepare_rival_score_tables() -> void:
	var rivals = [
		{"id": "naru", "name": "なる", "specialist": 78.0, "audience": 62.0, "variance": 6.0},
		{"id": "adam", "name": "アダム", "specialist": 85.0, "audience": 52.0, "variance": 5.0},
		{"id": "ryuji", "name": "リュウジ", "specialist": 65.0, "audience": 75.0, "variance": 8.0},
	]
	_rival_mid_scores.clear()
	_rival_final_scores.clear()

	for rival in rivals:
		var variance = float(rival.get("variance", 8.0))
		var rival_id = str(rival.get("id", ""))
		var rival_name = str(rival.get("name", ""))
		var base_spec = float(rival.get("specialist", 60.0)) + randf_range(-variance, variance)
		var base_aud = float(rival.get("audience", 60.0)) + randf_range(-variance, variance)
		base_spec += _get_rival_theme_bonus(rival_id, str(_theme.get("id", "")))
		if _easy_mode:
			base_spec -= 3.0
			base_aud -= 2.0

		var mid_spec = maxi(0.0, base_spec + randf_range(-4.0, 4.0))
		var mid_aud = maxi(0.0, base_aud + randf_range(-4.0, 4.0))
		var final_spec = maxi(0.0, mid_spec + randf_range(-6.0, 6.0))
		var final_aud = maxi(0.0, mid_aud + randf_range(-6.0, 6.0))

		_rival_mid_scores.append({
			"id": rival_id,
			"name": rival_name,
			"specialist": mid_spec,
			"audience": mid_aud,
			"total": mid_spec * 0.6 + mid_aud * 0.4,
		})
		_rival_final_scores.append({
			"id": rival_id,
			"name": rival_name,
			"specialist": final_spec,
			"audience": final_aud,
			"total": final_spec * 0.6 + final_aud * 0.4,
		})


func _build_rival_mid_scores() -> Array:
	if _rival_mid_scores.is_empty():
		_prepare_rival_score_tables()
	return _rival_mid_scores.duplicate(true)


func _build_rival_scores() -> Array:
	if _rival_final_scores.is_empty():
		_prepare_rival_score_tables()
	return _rival_final_scores.duplicate(true)


func _get_rival_theme_bonus(rival_id: String, theme_id: String) -> float:
	if rival_id == "naru" and (theme_id == "relax" or theme_id == "aftertaste"):
		return 4.0
	if rival_id == "adam" and theme_id == "high_heat":
		return 6.0
	if rival_id == "ryuji" and (theme_id == "high_heat" or theme_id == "fruity"):
		return 5.0
	return 0.0


func _apply_result_and_continue() -> void:
	if _pending_reward > 0:
		PlayerData.add_money(_pending_reward)
		GameManager.log_money_change(_pending_reward)

	if _player_rank == 1:
		PlayerData.add_stat("charm", 2)
		PlayerData.add_stat("guts", 1)
		GameManager.log_stat_change("charm", 2)
		GameManager.log_stat_change("guts", 1)
		EventFlags.set_value("ch1_tournament_easy_mode", false)
	else:
		PlayerData.add_stat("insight", 1)
		GameManager.log_stat_change("insight", 1)

	EventFlags.set_flag("ch1_tournament_completed", true)
	EventFlags.set_value("ch1_tournament_rank", _player_rank)
	GameManager.set_transient("morning_notice", _build_post_tournament_notice())
	GameManager.transition_to_interval()

	if GameManager.current_phase == "interval":
		get_tree().change_scene_to_file(MORNING_PHONE_SCENE_PATH)
	else:
		get_tree().change_scene_to_file(TITLE_SCENE_PATH)


func _build_post_tournament_notice() -> String:
	var rank_text = "%d位" % _player_rank
	if _player_rank == 1:
		rank_text = "優勝"
	var notice = "地方大会 %s。賞金 %d円 を獲得した。\n\n" % [rank_text, _pending_reward]
	notice += _build_sumi_feedback()
	return notice


func _build_sumi_feedback() -> String:
	var lines: Array[String] = ["──閉店後。スミさんがカウンターの向こうで腕を組んでいる。"]
	if _player_rank == 1:
		lines.append("スミさん「……ふん。まぐれじゃないことを、次で証明しろ」")
		lines.append("珍しく、ほんの少しだけ口元が緩んでいた気がする。")
		lines.append("スミさん「浮かれるのは今日だけだ。明日からは次の準備をしろ」")
	elif _player_rank <= 3:
		lines.append("スミさん「悪くはなかった。だが、詰めが甘い」")
		lines.append("スミさん「お前の弱点は分かっているはずだ。次までに潰せ」")
		lines.append("厳しい言葉。でも、目は真剣にこちらを見ていた。期待されているのだと思う。")
	else:
		lines.append("スミさん「……」")
		lines.append("何も言わない。それが一番堪える。")
		lines.append("スミさん「言いたいことは、お前自身が一番分かっているだろう」")
		lines.append("スミさん「悔しいなら、練習しろ。それだけだ」")
	return "\n".join(lines)


func _retry_tournament() -> void:
	get_tree().change_scene_to_file(TOURNAMENT_SCENE_PATH)


func _enable_easy_mode_and_retry() -> void:
	EventFlags.set_value("ch1_tournament_easy_mode", true)
	get_tree().change_scene_to_file(TOURNAMENT_SCENE_PATH)


func _return_to_title() -> void:
	get_tree().change_scene_to_file(TITLE_SCENE_PATH)


func _roll(success_rate: float) -> bool:
	var chance = clampf(success_rate, 5.0, 95.0)
	return randf() * 100.0 < chance

# ======== Mini Dialogue System ========

func _play_mini_dialogue(dialogue_id: String, on_finish: Callable) -> void:
	var path = "res://data/dialogue/ch1_tournament.json"
	if not FileAccess.file_exists(path):
		on_finish.call()
		return
	var file = FileAccess.open(path, FileAccess.READ)
	var parsed = JSON.parse_string(file.get_as_text())
	file.close()

	_mini_dialogue_queue.clear()
	if typeof(parsed) == TYPE_DICTIONARY and parsed.has("dialogues"):
		for d in parsed["dialogues"]:
			if str(d.get("dialogue_id", "")) == dialogue_id:
				_mini_dialogue_queue = d.get("lines", []).duplicate(true)
				break

	if _mini_dialogue_queue.is_empty():
		on_finish.call()
		return

	_mini_dialogue_on_finish = on_finish
	mini_dialogue_panel.show()
	_clear_choices()
	_advance_mini_dialogue()


func _advance_mini_dialogue() -> void:
	if _mini_dialogue_is_typing:
		_mini_dialogue_is_typing = false
		_mini_dialogue_timer.stop()
		mini_text_label.visible_characters = -1
		GameManager.play_ui_se("cursor")
		return

	if _mini_dialogue_queue.is_empty():
		mini_dialogue_panel.hide()
		GameManager.play_ui_se("confirm")
		if _mini_dialogue_on_finish.is_valid():
			_mini_dialogue_on_finish.call()
		return

	var line = _mini_dialogue_queue.pop_front()
	var raw_speaker = str(line.get("speaker", ""))
	var face = str(line.get("face", "normal"))
	_mini_dialogue_full_text = str(line.get("text", ""))

	if raw_speaker == "":
		mini_speaker_label.text = ""
		mini_portrait.texture = null
	else:
		mini_speaker_label.text = SPEAKER_NAMES.get(raw_speaker, raw_speaker)
		var t_path = "res://assets/portraits/%s/%s_%s.png" % [raw_speaker, raw_speaker, face]
		if ResourceLoader.exists(t_path):
			mini_portrait.texture = load(t_path)
		else:
			mini_portrait.texture = null

	mini_text_label.text = _mini_dialogue_full_text
	mini_text_label.visible_characters = 0
	_mini_dialogue_char_index = 0
	_mini_dialogue_is_typing = true
	_mini_dialogue_timer.start()


func _on_mini_dialogue_tick() -> void:
	_mini_dialogue_char_index += 1
	mini_text_label.visible_characters = _mini_dialogue_char_index
	if _mini_dialogue_char_index >= _mini_dialogue_full_text.length():
		_mini_dialogue_is_typing = false
		_mini_dialogue_timer.stop()


func _gui_input(event: InputEvent) -> void:
	if mini_dialogue_panel.visible and event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		_advance_mini_dialogue()


func _show_step_result_and_next(result_text: String, next_callable: Callable) -> void:
	_step_transition()
	_append_info(result_text)
	_clear_choices()
	_add_choice_button("次へ", next_callable)
	_refresh_side_panel()


func _count_theme_hits(flavor_ids: Array[String]) -> int:
	var count = 0
	var theme_flavors: Array = _theme.get("flavors", [])
	for flavor_id in flavor_ids:
		if theme_flavors.has(flavor_id):
			count += 1
	return count


func _has_alpha_heaven_flavor_selected() -> bool:
	for flavor_id in _selected_flavors:
		if ALPHA_HEAVEN_FLAVORS.has(flavor_id):
			return true
	return false


func _count_matching_memos(flavor_ids: Array[String]) -> int:
	var memo_entries = PlayerData.get_tournament_memos()
	if memo_entries.is_empty():
		return 0

	var count = 0
	for raw in memo_entries:
		if typeof(raw) != TYPE_DICTIONARY:
			continue
		var memo = raw as Dictionary
		var source_text = (str(memo.get("title", "")) + " " + str(memo.get("body", ""))).strip_edges()
		if source_text == "":
			continue

		var hit = 0
		for flavor_id in flavor_ids:
			if source_text.find(_flavor_name(flavor_id)) != -1:
				hit += 1
		if hit >= 2:
			count += 1
	return count


func _flavor_name(flavor_id: String) -> String:
	return str(FLAVOR_NAME_MAP.get(flavor_id, flavor_id))


func _selected_flavor_summary() -> String:
	if not _packing_choice.is_empty():
		return _format_pattern_grams(_packing_choice)
	var names: Array[String] = []
	for flavor_id in _selected_flavors:
		names.append(_flavor_name(flavor_id))
	return " / ".join(names)


func _heat_label() -> String:
	if _heat_state <= -2:
		return "低温"
	if _heat_state >= 2:
		return "高温"
	return "適正"


func _get_target_temp_range() -> Vector2:
	var min_temp = 178.0
	var max_temp = 204.0
	if _has_alpha_heaven_flavor_selected():
		min_temp += 8.0
		max_temp += 10.0
	match _selected_hms:
		"amaburst":
			min_temp += 6.0
			max_temp += 8.0
		"winkwink_hagal":
			min_temp -= 4.0
			max_temp -= 2.0
	return Vector2(min_temp, max_temp)


func _get_current_temp_value() -> float:
	var temp = 182.0
	temp += float(_heat_state) * 16.0
	temp += float(_steam_minutes - 6) * 2.0
	if _selected_charcoal_count == 4:
		temp += 8.0
	if _selected_hms == "amaburst":
		temp += 10.0
	elif _selected_hms == "tanukish_lid":
		temp -= 4.0
	temp += float(_pull_round) * 2.5
	return clampf(temp, TEMP_MIN, TEMP_MAX)


func _build_temperature_gauge_text(current_temp: float, target: Vector2) -> String:
	var lines: Array[String] = []
	var rows = 9
	var interval = (TEMP_MAX - TEMP_MIN) / float(rows - 1)
	for i in range(rows):
		var ratio = 1.0 - float(i) / float(rows - 1)
		var row_temp = lerpf(TEMP_MIN, TEMP_MAX, ratio)
		var in_target = row_temp >= target.x and row_temp <= target.y
		var cell = "■" if in_target else "│"
		var marker = "◆" if abs(current_temp - row_temp) <= interval * 0.5 else " "
		lines.append("%3d℃ %s%s" % [int(round(row_temp)), marker, cell])
	return "\n".join(lines)


func _refresh_side_panel() -> void:
	judge_label.text = "MC: パッキー / 焚口ショウ\n審査員: 土岐 鋼鉄 + %s\nテーマ: %s" % [
		str(_random_judge.get("name", "審査員")),
		str(_theme.get("name", "-")),
	]

	var target_temp = _get_target_temp_range()
	var current_temp = _get_current_temp_value()
	var lines: Array[String] = []
	lines.append("専門暫定: %.1f" % maxi(_technical_points, 0.0))
	lines.append("一般暫定: %.1f" % maxi(_audience_points, 0.0))
	lines.append("調整成功: %d / 3" % _adjustment_hits)
	lines.append("吸い出しヒット: %d / %d" % [_pull_hit_count, maxi(_pull_round, 1)])
	lines.append("熱状態: %s" % _heat_label())
	lines.append("温度: %d℃（目標 %d〜%d℃）" % [
		int(round(current_temp)),
		int(round(target_temp.x)),
		int(round(target_temp.y)),
	])
	_update_temp_gauge()
	lines.append("温度表示: ◆=現在 / ■=合格帯")
	lines.append(_build_temperature_gauge_text(current_temp, target_temp))
	lines.append("設定: %s + %s" % [
		PlayerData.get_equipment_name_by_value(_selected_bowl),
		PlayerData.get_equipment_name_by_value(_selected_hms),
	])
	lines.append("炭: %s" % PlayerData.get_equipped_item_name("charcoal"))
	if not _selected_flavors.is_empty():
		lines.append("配合: %s" % _selected_flavor_summary())
	if _special_mix_name != "":
		lines.append("特別: %s" % _special_mix_name)
	score_label.text = "\n".join(lines)

	var memos = PlayerData.get_tournament_memos()
	if memos.is_empty():
		memo_label.text = "攻略メモ\nなし"
		return

	var memo_lines: Array[String] = ["攻略メモ"]
	var max_rows = mini(3, memos.size())
	for i in range(max_rows):
		var row = memos[i]
		if typeof(row) != TYPE_DICTIONARY:
			continue
		memo_lines.append("・%s" % str((row as Dictionary).get("title", "メモ")))
	if memos.size() > max_rows:
		memo_lines.append("…他 %d件" % (memos.size() - max_rows))
	memo_label.text = "\n".join(memo_lines)


# ──────────────────────────────────────────────
# ビジュアルヘルパー（バイブコーディング）
# ──────────────────────────────────────────────

## フレーバーカラーマップ
const FLAVOR_COLORS := {
	"double_apple": Color("a22633"),   # 深紅（ダブルアップル）
	"mint": Color("63c74d"),           # グリーン（ミント）
	"blueberry": Color("124e89"),      # ディープブルー（ブルーベリー）
	"vanilla": Color("ead4aa"),        # クリーム（バニラ）
	"pineapple": Color("feae34"),      # ゴールド（パイナップル）
	"coconut": Color("e4a672"),        # サンド（ココナッツ）
}


## ─── 1. パッキングのボウル断面可視化 ───

var _bowl_visual_node: Control = null

func _show_bowl_visual() -> void:
	_remove_bowl_visual()
	var bowl = _BowlVisual.new()
	bowl.name = "BowlVisual"
	bowl.custom_minimum_size = Vector2(280, 180)
	bowl.size = Vector2(280, 180)
	bowl.flavors = _selected_flavors.duplicate()
	bowl.grams = _manual_packing_grams.duplicate()
	bowl.total_grams = TOTAL_PACKING_GRAMS
	bowl.flavor_colors = FLAVOR_COLORS
	_bowl_visual_node = bowl
	choice_container.add_child(bowl)
	choice_container.move_child(bowl, 0)


func _update_bowl_visual() -> void:
	if _bowl_visual_node != null and is_instance_valid(_bowl_visual_node):
		var bowl = _bowl_visual_node as _BowlVisual
		if bowl != null:
			bowl.grams = _manual_packing_grams.duplicate()
			bowl.queue_redraw()


func _remove_bowl_visual() -> void:
	if _bowl_visual_node != null and is_instance_valid(_bowl_visual_node):
		_bowl_visual_node.queue_free()
		_bowl_visual_node = null


class _BowlVisual extends Control:
	var flavors: Array = []
	var grams: Dictionary = {}
	var total_grams: int = 12
	var flavor_colors: Dictionary = {}

	func _draw() -> void:
		var w = size.x
		var h = size.y
		var bowl_margin = 30.0
		var bowl_top = 40.0
		var bowl_bottom = h - 20.0
		var bowl_left = bowl_margin
		var bowl_right = w - bowl_margin
		var bowl_width = bowl_right - bowl_left
		var bowl_height = bowl_bottom - bowl_top

		# ボウルの外枠（台形）
		var outline_points = PackedVector2Array([
			Vector2(bowl_left + 20, bowl_top),
			Vector2(bowl_right - 20, bowl_top),
			Vector2(bowl_right, bowl_bottom),
			Vector2(bowl_left, bowl_bottom),
		])
		draw_colored_polygon(outline_points, Color("3a4466", 0.7))
		# ボウル枠線
		for i in range(outline_points.size()):
			var next_i = (i + 1) % outline_points.size()
			draw_line(outline_points[i], outline_points[next_i], Color("feae34", 0.6), 2.0)

		# フレーバー層を下から積む
		var total = 0
		for flavor_id in flavors:
			total += int(grams.get(flavor_id, 0))
		if total <= 0:
			# 空のボウル表示
			draw_string(ThemeDB.fallback_font, Vector2(w * 0.5 - 40, h * 0.5), "空のボウル", HORIZONTAL_ALIGNMENT_CENTER, -1, 16, Color("8b9bb4"))
			return

		var y_cursor = bowl_bottom
		for flavor_id in flavors:
			var gram = int(grams.get(flavor_id, 0))
			if gram <= 0:
				continue
			var layer_ratio = float(gram) / float(maxi(total, 1))
			var layer_height = bowl_height * layer_ratio
			var y_top = y_cursor - layer_height

			# 台形の幅を高さに応じて補間
			var ratio_bottom = (y_cursor - bowl_top) / bowl_height
			var ratio_top = (y_top - bowl_top) / bowl_height
			var left_bottom = lerpf(bowl_left + 20, bowl_left, ratio_bottom)
			var right_bottom = lerpf(bowl_right - 20, bowl_right, ratio_bottom)
			var left_top = lerpf(bowl_left + 20, bowl_left, ratio_top)
			var right_top = lerpf(bowl_right - 20, bowl_right, ratio_top)

			var color = flavor_colors.get(flavor_id, Color("5a6988"))
			var layer_points = PackedVector2Array([
				Vector2(left_top, y_top),
				Vector2(right_top, y_top),
				Vector2(right_bottom, y_cursor),
				Vector2(left_bottom, y_cursor),
			])
			draw_colored_polygon(layer_points, color)

			# フレーバー名ラベル
			if layer_height > 18:
				var label_y = y_top + layer_height * 0.5 + 5
				var short_name = flavor_id.substr(0, 8)
				draw_string(ThemeDB.fallback_font, Vector2(left_top + 8, label_y), "%s %dg" % [short_name, gram], HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color("181425"))

			y_cursor = y_top

		# ボウルラベル
		draw_string(ThemeDB.fallback_font, Vector2(bowl_left, bowl_top - 8), "BOWL", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color("feae34"))


## ─── 2. 温度ゲージのビジュアルバー ───

var _temp_gauge_node: Control = null

func _show_temp_gauge() -> void:
	_remove_temp_gauge()
	var gauge = _TempGaugeVisual.new()
	gauge.name = "TempGauge"
	gauge.custom_minimum_size = Vector2(280, 36)
	gauge.size = Vector2(280, 36)
	_temp_gauge_node = gauge
	_update_temp_gauge()
	choice_container.add_child(gauge)
	choice_container.move_child(gauge, 0)


func _update_temp_gauge() -> void:
	if _temp_gauge_node == null or not is_instance_valid(_temp_gauge_node):
		return
	var gauge = _temp_gauge_node as _TempGaugeVisual
	if gauge == null:
		return
	gauge.current_temp = _get_current_temp_value()
	gauge.target_range = _get_target_temp_range()
	gauge.temp_min = TEMP_MIN
	gauge.temp_max = TEMP_MAX
	gauge.queue_redraw()


func _remove_temp_gauge() -> void:
	if _temp_gauge_node != null and is_instance_valid(_temp_gauge_node):
		_temp_gauge_node.queue_free()
		_temp_gauge_node = null


class _TempGaugeVisual extends Control:
	var current_temp: float = 180.0
	var target_range: Vector2 = Vector2(178, 204)
	var temp_min: float = 140.0
	var temp_max: float = 260.0

	func _draw() -> void:
		var w = size.x
		var h = size.y
		var bar_y = 16.0
		var bar_h = 14.0
		var margin = 10.0

		# 背景バー
		draw_rect(Rect2(margin, bar_y, w - margin * 2, bar_h), Color("262b44"), true)

		# 合格帯（ターゲット範囲）
		var range_span = temp_max - temp_min
		var target_left = margin + (target_range.x - temp_min) / range_span * (w - margin * 2)
		var target_right = margin + (target_range.y - temp_min) / range_span * (w - margin * 2)
		draw_rect(Rect2(target_left, bar_y, target_right - target_left, bar_h), Color("3e8948", 0.7), true)

		# 現在温度マーカー
		var current_x = margin + (current_temp - temp_min) / range_span * (w - margin * 2)
		current_x = clampf(current_x, margin, w - margin)
		var in_target = current_temp >= target_range.x and current_temp <= target_range.y
		var marker_color = Color("feae34") if in_target else Color("e43b44")

		# 三角マーカー
		var tri = PackedVector2Array([
			Vector2(current_x, bar_y - 2),
			Vector2(current_x - 6, bar_y - 10),
			Vector2(current_x + 6, bar_y - 10),
		])
		draw_colored_polygon(tri, marker_color)
		draw_line(Vector2(current_x, bar_y), Vector2(current_x, bar_y + bar_h), marker_color, 2.0)

		# ラベル
		draw_string(ThemeDB.fallback_font, Vector2(margin, h - 2), "%d℃" % int(temp_min), HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color("8b9bb4"))
		draw_string(ThemeDB.fallback_font, Vector2(w - margin - 30, h - 2), "%d℃" % int(temp_max), HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color("8b9bb4"))
		draw_string(ThemeDB.fallback_font, Vector2(current_x - 15, h - 2), "%d℃" % int(current_temp), HORIZONTAL_ALIGNMENT_LEFT, -1, 11, marker_color)


## ─── 3. スコア変動ポップアップ ───

func _show_score_popup(text: String, color: Color = Color("feae34")) -> void:
	var layer = CanvasLayer.new()
	layer.layer = 90
	add_child(layer)

	var label = Label.new()
	label.text = text
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.add_theme_font_size_override("font_size", 32)
	label.add_theme_color_override("font_color", color)
	label.position = Vector2(500, 300)
	label.modulate.a = 0.0
	layer.add_child(label)

	var tween = create_tween()
	tween.set_parallel(true)
	tween.tween_property(label, "modulate:a", 1.0, 0.15)
	tween.tween_property(label, "position:y", 240, 0.6).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tween.tween_property(label, "modulate:a", 0.0, 0.3).set_delay(0.5)
	tween.chain().tween_callback(layer.queue_free)


func _show_stat_popup(spec_delta: float, aud_delta: float) -> void:
	var parts: Array[String] = []
	if spec_delta != 0:
		parts.append("専門 %+d" % int(round(spec_delta)))
	if aud_delta != 0:
		parts.append("一般 %+d" % int(round(aud_delta)))
	if parts.is_empty():
		return
	var total = spec_delta + aud_delta
	var color = Color("feae34") if total >= 0 else Color("e43b44")
	_show_score_popup(" / ".join(parts), color)


## ─── 4. 画面揺れ＋フラッシュ ───

func _screen_shake(intensity: float = 8.0, duration: float = 0.3) -> void:
	var original_pos = position
	var tween = create_tween()
	var steps = int(duration / 0.03)
	for i in range(steps):
		var offset = Vector2(randf_range(-intensity, intensity), randf_range(-intensity, intensity))
		tween.tween_property(self, "position", original_pos + offset, 0.03)
	tween.tween_property(self, "position", original_pos, 0.05)


func _screen_flash(color: Color = Color("e43b44", 0.35), duration: float = 0.15) -> void:
	var flash = ColorRect.new()
	flash.color = color
	flash.anchor_right = 1.0
	flash.anchor_bottom = 1.0
	flash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(flash)

	var tween = create_tween()
	tween.tween_property(flash, "color:a", 0.0, duration)
	tween.tween_callback(flash.queue_free)


func _dramatic_impact(text: String = "") -> void:
	_screen_shake(10.0, 0.35)
	_screen_flash(Color("e43b44", 0.3), 0.2)
	GameManager.play_ui_se("confirm")
	if text != "":
		_show_score_popup(text, Color("e43b44"))


## ─── 6. アルミ穴あけビジュアル ───

func _aluminum_show_hit_feedback(text: String, color: Color) -> void:
	var ring_node = choice_container.find_child("AluminumRing", true, false)
	if ring_node == null:
		_show_score_popup(text, color)
		return
	var label = Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", 28)
	label.add_theme_color_override("font_color", color)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.position = Vector2(ring_node.size.x * 0.5 - 40, ring_node.size.y * 0.5 - 14)
	label.modulate.a = 1.0
	ring_node.add_child(label)
	var tween = create_tween()
	tween.set_parallel(true)
	tween.tween_property(label, "position:y", label.position.y - 40, 0.5).set_trans(Tween.TRANS_CUBIC)
	tween.tween_property(label, "modulate:a", 0.0, 0.3).set_delay(0.3)
	tween.chain().tween_callback(label.queue_free)


class _AluminumRingVisual extends Control:
	var slot_count: int = 12
	var hit_slot: int = 0
	var notes: Array = []
	var hits_done: int = 0

	func _draw() -> void:
		var w = size.x
		var h = size.y
		var cx = w * 0.5
		var cy = h * 0.5
		var radius = minf(cx, cy) - 20.0

		# 背景円
		draw_arc(Vector2(cx, cy), radius, 0, TAU, 64, Color("3a4466", 0.4), 2.0)

		# スロットの点を描画
		for i in range(slot_count):
			var angle = TAU * float(i) / float(slot_count) - PI * 0.5
			var pos = Vector2(cx + cos(angle) * radius, cy + sin(angle) * radius)

			if i == hit_slot:
				# 判定点: 大きなゴールドの★
				draw_circle(pos, 14, Color("feae34", 0.3))
				draw_circle(pos, 10, Color("feae34", 0.8))
				draw_arc(pos, 16, 0, TAU, 32, Color("feae34"), 2.0)
			elif i < hits_done:
				# 成功済みの穴: グリーン●
				draw_circle(pos, 6, Color("3e8948", 0.7))
			else:
				# 未使用スロット: 薄い○
				draw_circle(pos, 4, Color("5a6988", 0.4))

		# ノーツを描画（赤い円）
		for note in notes:
			var distance = float(note.get("distance", 0.0))
			var slot_idx = (hit_slot + int(round(distance))) % slot_count
			if slot_idx < 0:
				slot_idx += slot_count
			var angle = TAU * float(slot_idx) / float(slot_count) - PI * 0.5

			# 距離に応じて半径方向にもオフセット（近いほど内側に）
			var frac = fmod(distance, 1.0)
			var next_slot = (slot_idx + 1) % slot_count
			var curr_angle = TAU * float(slot_idx) / float(slot_count) - PI * 0.5
			var note_radius = radius

			var pos = Vector2(cx + cos(curr_angle) * note_radius, cy + sin(curr_angle) * note_radius)

			# 近いほど大きく＋明るく
			var closeness = clampf(1.0 - abs(distance) / 6.0, 0.2, 1.0)
			var note_size = lerpf(5.0, 10.0, closeness)
			var note_alpha = lerpf(0.4, 1.0, closeness)

			draw_circle(pos, note_size, Color("e43b44", note_alpha))

			# 判定圏内なら光るリング
			if abs(distance) <= 1.0:
				draw_arc(pos, note_size + 3, 0, TAU, 16, Color("feae34", 0.6 * closeness), 1.5)

		# 中央テキスト
		draw_string(ThemeDB.fallback_font, Vector2(cx - 24, cy + 5), "穴あけ", HORIZONTAL_ALIGNMENT_CENTER, -1, 14, Color("feae34", 0.5))


## ─── 7. ラウンド告知 ───

func _show_round_announce(step_num: int, title: String) -> void:
	var layer = CanvasLayer.new()
	layer.layer = 95
	add_child(layer)

	# 背景オーバーレイ（暗転）
	var overlay = ColorRect.new()
	overlay.color = Color("181425", 0.6)
	overlay.anchor_right = 1.0
	overlay.anchor_bottom = 1.0
	overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(overlay)

	# ステップ番号
	var step_label = Label.new()
	step_label.text = "STEP %d" % step_num
	step_label.add_theme_font_size_override("font_size", 18)
	step_label.add_theme_color_override("font_color", Color("feae34"))
	step_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	step_label.anchor_left = 0.0
	step_label.anchor_right = 1.0
	step_label.anchor_top = 0.38
	step_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	step_label.modulate.a = 0.0
	layer.add_child(step_label)

	# タイトル
	var title_label = Label.new()
	title_label.text = title
	title_label.add_theme_font_size_override("font_size", 40)
	title_label.add_theme_color_override("font_color", Color("e43b44"))
	title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title_label.anchor_left = 0.0
	title_label.anchor_right = 1.0
	title_label.anchor_top = 0.43
	title_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	title_label.modulate.a = 0.0
	title_label.scale = Vector2(0.5, 0.5)
	title_label.pivot_offset = Vector2(600, 24)
	layer.add_child(title_label)

	# 横線（バーミリオン）
	var line = ColorRect.new()
	line.color = Color("e43b44", 0.8)
	line.anchor_left = 0.2
	line.anchor_right = 0.8
	line.anchor_top = 0.56
	line.custom_minimum_size = Vector2(0, 3)
	line.size = Vector2(0, 3)
	line.mouse_filter = Control.MOUSE_FILTER_IGNORE
	line.modulate.a = 0.0
	layer.add_child(line)

	# アニメーション
	var tween = create_tween()
	tween.set_parallel(true)
	tween.tween_property(step_label, "modulate:a", 1.0, 0.15)
	tween.tween_property(title_label, "modulate:a", 1.0, 0.2)
	tween.tween_property(title_label, "scale", Vector2.ONE, 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.tween_property(line, "modulate:a", 1.0, 0.2).set_delay(0.1)
	# 消えるアニメーション
	tween.tween_property(overlay, "color:a", 0.0, 0.2).set_delay(0.9)
	tween.tween_property(step_label, "modulate:a", 0.0, 0.15).set_delay(0.85)
	tween.tween_property(title_label, "modulate:a", 0.0, 0.15).set_delay(0.85)
	tween.tween_property(line, "modulate:a", 0.0, 0.15).set_delay(0.85)
	tween.chain().tween_callback(layer.queue_free)


## ─── 8. MCコメント ───

func _show_mc_comment(step_num: int) -> void:
	var comments: Array = MC_COMMENTS.get(step_num, [])
	if comments.is_empty():
		return
	var comment = str(comments[randi() % comments.size()])
	_show_tv_ticker(comment)


## ─── 9. TV風テロップ ───

func _show_tv_ticker(text: String, duration: float = 3.5) -> void:
	var layer = CanvasLayer.new()
	layer.layer = 80
	add_child(layer)

	# テロップバー背景
	var bar = ColorRect.new()
	bar.color = Color("181425", 0.85)
	bar.anchor_left = 0.0
	bar.anchor_right = 1.0
	bar.anchor_bottom = 1.0
	bar.anchor_top = 1.0
	bar.offset_top = -52
	bar.custom_minimum_size = Vector2(0, 52)
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(bar)

	# アクセントライン
	var accent_line = ColorRect.new()
	accent_line.color = Color("e43b44")
	accent_line.anchor_left = 0.0
	accent_line.anchor_right = 1.0
	accent_line.custom_minimum_size = Vector2(0, 3)
	accent_line.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bar.add_child(accent_line)

	# テロップテキスト
	var label = Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", 18)
	label.add_theme_color_override("font_color", Color("ead4aa"))
	label.position = Vector2(24, 12)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bar.add_child(label)

	# スライドインアニメーション
	bar.modulate.a = 0.0
	bar.position.y += 60
	var tween = create_tween()
	tween.set_parallel(true)
	tween.tween_property(bar, "modulate:a", 1.0, 0.2)
	tween.tween_property(bar, "position:y", bar.position.y - 60, 0.3).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	# 消える
	tween.tween_property(bar, "modulate:a", 0.0, 0.25).set_delay(duration)
	tween.tween_property(bar, "position:y", bar.position.y, 0.25).set_delay(duration)
	tween.chain().tween_callback(layer.queue_free)


## ─── 10. 中間スコア発表 ───

func _show_mid_score_ticker() -> void:
	var spec_text = "専門 %.1f" % _technical_points
	var aud_text = "一般 %.1f" % _audience_points
	var total = _technical_points + _audience_points
	_show_tv_ticker("【中間速報】 %s / %s ＝ 合計 %.1f点" % [spec_text, aud_text, total], 4.0)


func _show_mid_score_reveal() -> void:
	# 中間発表をドラマチックに表示
	var layer = CanvasLayer.new()
	layer.layer = 85
	add_child(layer)

	var overlay = ColorRect.new()
	overlay.color = Color("181425", 0.7)
	overlay.anchor_right = 1.0
	overlay.anchor_bottom = 1.0
	overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(overlay)

	var title = Label.new()
	title.text = "── 中 間 発 表 ──"
	title.add_theme_font_size_override("font_size", 28)
	title.add_theme_color_override("font_color", Color("feae34"))
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.anchor_left = 0.0
	title.anchor_right = 1.0
	title.anchor_top = 0.25
	title.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(title)

	# スコアバー表示（プレイヤーのスコアをバーで視覚化）
	var total = _technical_points + _audience_points
	var max_possible = 100.0  # 概算の最大値

	var bar_container = VBoxContainer.new()
	bar_container.anchor_left = 0.15
	bar_container.anchor_right = 0.85
	bar_container.anchor_top = 0.38
	bar_container.add_theme_constant_override("separation", 8)
	bar_container.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(bar_container)

	# 専門点バー
	var spec_row = _create_score_bar("専門", _technical_points, max_possible * 0.5, Color("e43b44"))
	bar_container.add_child(spec_row)

	# 一般点バー
	var aud_row = _create_score_bar("一般", _audience_points, max_possible * 0.5, Color("feae34"))
	bar_container.add_child(aud_row)

	# 合計
	var total_label = Label.new()
	total_label.text = "合計: %.1f 点" % total
	total_label.add_theme_font_size_override("font_size", 24)
	total_label.add_theme_color_override("font_color", Color("ead4aa"))
	total_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	total_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bar_container.add_child(total_label)

	# コメント
	var comment = Label.new()
	if total >= 40:
		comment.text = "土岐「悪くない。だが上はまだいる」"
	elif total >= 25:
		comment.text = "土岐「まだ伸びる余地がある」"
	else:
		comment.text = "土岐「…ここからどう巻き返すか」"
	comment.add_theme_font_size_override("font_size", 16)
	comment.add_theme_color_override("font_color", Color("8b9bb4"))
	comment.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	comment.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bar_container.add_child(comment)

	# アニメーション
	layer.modulate.a = 0.0
	var tween = create_tween()
	tween.tween_property(layer, "modulate:a", 1.0, 0.3)
	tween.tween_interval(3.5)
	tween.tween_property(layer, "modulate:a", 0.0, 0.3)
	tween.tween_callback(layer.queue_free)


func _create_score_bar(label_text: String, value: float, max_val: float, color: Color) -> HBoxContainer:
	var row = HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE

	var lbl = Label.new()
	lbl.text = label_text
	lbl.custom_minimum_size = Vector2(60, 0)
	lbl.add_theme_font_size_override("font_size", 16)
	lbl.add_theme_color_override("font_color", Color("ead4aa"))
	lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(lbl)

	var bar_bg = ColorRect.new()
	bar_bg.color = Color("262b44")
	bar_bg.custom_minimum_size = Vector2(300, 22)
	bar_bg.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bar_bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(bar_bg)

	var bar_fill = ColorRect.new()
	var ratio = clampf(value / maxf(max_val, 1.0), 0.0, 1.0)
	bar_fill.color = color
	bar_fill.custom_minimum_size = Vector2(300 * ratio, 22)
	bar_fill.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bar_bg.add_child(bar_fill)

	var val_lbl = Label.new()
	val_lbl.text = "%.1f" % value
	val_lbl.custom_minimum_size = Vector2(50, 0)
	val_lbl.add_theme_font_size_override("font_size", 16)
	val_lbl.add_theme_color_override("font_color", color)
	val_lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(val_lbl)

	return row


## ─── 5. ステップ間トランジション ───

func _step_transition() -> void:
	_glitch_transition()


## ─── 11. サイバーEDM演出 ───

var _scanline_layer: CanvasLayer = null
var _beat_tween: Tween = null

func _init_cyber_effects() -> void:
	# スキャンラインレイヤー
	_scanline_layer = CanvasLayer.new()
	_scanline_layer.layer = 50
	add_child(_scanline_layer)

	var scanline = _ScanlineEffect.new()
	scanline.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	scanline.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_scanline_layer.add_child(scanline)

	# ビート脈動（ヘッダーラベルが周期的に光る）
	_start_beat_pulse()


func _start_beat_pulse() -> void:
	if _beat_tween != null and _beat_tween.is_valid():
		_beat_tween.kill()
	_beat_tween = create_tween().set_loops()
	_beat_tween.tween_property(header_label, "modulate", Color(1.3, 1.0, 1.0, 1.0), 0.08)
	_beat_tween.tween_property(header_label, "modulate", Color.WHITE, 0.4)
	_beat_tween.tween_interval(0.52)


func _glitch_transition() -> void:
	var layer = CanvasLayer.new()
	layer.layer = 92
	add_child(layer)

	# グリッチブロック（ランダムなカラーバーが横に走る）
	var glitch_colors = [
		Color("e43b44", 0.3),  # バーミリオン
		Color("00e5ff", 0.25),  # サイバーシアン
		Color("feae34", 0.2),   # アンバーゴールド
		Color("181425", 0.8),   # ダーク
	]
	for i in range(6):
		var bar = ColorRect.new()
		bar.color = glitch_colors[randi() % glitch_colors.size()]
		bar.anchor_left = 0.0
		bar.anchor_right = 1.0
		var y = randf_range(0.0, 0.85)
		var h = randf_range(0.02, 0.08)
		bar.anchor_top = y
		bar.anchor_bottom = y + h
		bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
		# 横方向にズレ
		bar.position.x = randf_range(-30, 30)
		layer.add_child(bar)

	var tween = create_tween()
	tween.tween_property(layer, "modulate:a", 0.0, 0.2).set_delay(0.08)
	tween.tween_callback(layer.queue_free)


class _ScanlineEffect extends Control:
	var _time: float = 0.0

	func _process(delta: float) -> void:
		_time += delta
		queue_redraw()

	func _draw() -> void:
		var h = size.y
		var line_spacing = 4.0
		var alpha = 0.04

		# CRT風スキャンライン
		var y = 0.0
		while y < h:
			draw_line(Vector2(0, y), Vector2(size.x, y), Color("00e5ff", alpha), 1.0)
			y += line_spacing

		# 移動するスキャンバー（上から下に流れる）
		var scan_y = fmod(_time * 120.0, h + 40.0) - 20.0
		draw_rect(Rect2(0, scan_y, size.x, 2), Color("00e5ff", 0.08))
		draw_rect(Rect2(0, scan_y - 8, size.x, 20), Color("00e5ff", 0.015))

