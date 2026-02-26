extends Control

@onready var scroll_container: ScrollContainer = $ScrollContainer
@onready var credits_label: Label = %CreditsLabel
@onready var skip_button: Button = $SkipButton

var _scroll_speed = 40.0
var _current_scroll = 0.0
var _is_scrolling = true

const STAFF_TEXT = """
【SHISHA GAME (仮)】

■ プロジェクトオーナー / 企画
プレイヤー (USER)

■ 開発・プログラミング
Antigravity (AI Assistant)

■ シナリオ・テキスト
Antigravity

■ 登場人物
はじめ (主人公)
スミさん (師匠)
なる (常連客・ライバル)
アダム (クールな常連客)
みんちゃん (ライバル店店長)
紡 (iPad少女)
アゲハ (ギャル社長)
パッキー (MC)
南雲 修二 (審査員長)

■ ゲームデザイン
- シーシャ作成システム
- 大会評価システム (専門/一般)
- 営業カレンダー進行機能
- フレーバー・機材による変数変化

■ スペシャルサンクス
プレイしていただいたあなた



Thank you for playing!
"""

func _ready() -> void:
	credits_label.text = STAFF_TEXT.strip_edges()
	skip_button.pressed.connect(_on_skip_button_pressed)
	GameManager.play_daily_bgm()
	
	scroll_container.get_v_scroll_bar().modulate.a = 0.0
	_current_scroll = 0.0


func _process(delta: float) -> void:
	if not _is_scrolling:
		return
		
	var max_scroll = scroll_container.get_v_scroll_bar().max_value - scroll_container.size.y
	
	if _current_scroll < max_scroll:
		_current_scroll += _scroll_speed * delta
		scroll_container.scroll_vertical = int(_current_scroll)
	else:
		_is_scrolling = false


func _on_skip_button_pressed() -> void:
	GameManager.play_ui_se("confirm")
	get_tree().change_scene_to_file("res://scenes/title/title_screen.tscn")
