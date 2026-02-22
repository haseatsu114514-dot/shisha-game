extends Control

@onready var money_label: Label = %MoneyLabel
@onready var item_container: VBoxContainer = %ItemContainer
@onready var info_label: RichTextLabel = %InfoLabel
@onready var back_button: Button = $BackButton

# ショップの品揃えデータ
# item_type: "flavor", "bowl", "hms", "charcoal", "pipe"
const SHOP_ITEMS := [
	{
		"id": "special_mint",
		"name": "幻のミント (極小ロット)",
		"type": "flavor",
		"price": 5000,
		"chapter_req": 1,
		"desc": "最高級のミントフレーバー。通常では手に入らない爽快感。[color=yellow]購入するとフレーバー熟練度が上がるかも？[/color]"
	},
	{
		"id": "premium_apple",
		"name": "ダブルアップル・ヴィンテージ",
		"type": "flavor",
		"price": 8000,
		"chapter_req": 2,
		"desc": "数年熟成された最高級のダブルアップル。[color=yellow]購入するとフレーバー熟練度が上がるかも？[/color]"
	},
	{
		"id": "tokyo_special",
		"name": "東京限定ミックスフレーバー",
		"type": "flavor",
		"price": 10000,
		"chapter_req": 3,
		"desc": "東京のトレンドを取り入れた特製フレーバー。[color=yellow]大会でのウケが良い。[/color]"
	},
	{
		"id": "pipe_middle",
		"name": "中級パイプ(スチール製)",
		"type": "pipe",
		"price": 30000,
		"chapter_req": 1,
		"desc": "少し値が張るが、気密性が高く味が安定する。\n[color=yellow]効果: 専門評価+2, 一般評価+2[/color]"
	},
	{
		"id": "pipe_high",
		"name": "高級パイプ(ガラス・真鍮)",
		"type": "pipe",
		"price": 100000,
		"chapter_req": 2,
		"desc": "美しさと実用性を兼ね備えた名機。審査員の目を惹く。\n[color=yellow]効果: 専門評価+5, 見栄え等ボーナス大[/color]"
	},
	{
		"id": "pipe_highest",
		"name": "最高級パイプ(特注品)",
		"type": "pipe",
		"price": 300000,
		"chapter_req": 3,
		"desc": "限られた職人しか作れない幻の台。すべてにおいて圧倒的な性能を誇る。\n[color=yellow]効果: 全評価+8 圧倒的ボーナス[/color]"
	}
]

func _ready() -> void:
	back_button.pressed.connect(_on_back_button_pressed)
	_refresh_ui()

func _refresh_ui() -> void:
	money_label.text = "所持金: %d円" % PlayerData.money
	
	for child in item_container.get_children():
		child.queue_free()
		
	var current_ch = GameManager.current_chapter
	
	for item in SHOP_ITEMS:
		if current_ch < item.get("chapter_req", 1):
			continue
			
		var box = HBoxContainer.new()
		
		var label = Label.new()
		label.text = "%s - %d円" % [item.get("name", ""), item.get("price", 0)]
		label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		box.add_child(label)
		
		var desc_btn = Button.new()
		desc_btn.text = "詳細"
		desc_btn.pressed.connect(_show_info.bind(item))
		box.add_child(desc_btn)
		
		var buy_btn = Button.new()
		# check if already owned (mainly for equipment)
		var is_owned = _is_item_owned(item)
		if is_owned:
			buy_btn.text = "所持済"
			buy_btn.disabled = true
		else:
			buy_btn.text = "購入"
			if PlayerData.money < item.get("price", 0):
				buy_btn.disabled = true
			buy_btn.pressed.connect(_try_buy_item.bind(item))
		
		box.add_child(buy_btn)
		item_container.add_child(box)

func _show_info(item: Dictionary) -> void:
	GameManager.play_ui_se("cursor")
	var t = "[b]%s[/b]\n価格: %d円\n\n%s" % [
		item.get("name", ""),
		item.get("price", 0),
		item.get("desc", "")
	]
	info_label.text = t

func _is_item_owned(item: Dictionary) -> bool:
	var t = item.get("type", "")
	var id = item.get("id", "")
	if t == "flavor":
		# Let's say special flavors can only be bought once for a permanent bonus
		return PlayerData.flavor_inventory.has(id)
	return PlayerData.has_item(t, id)

func _try_buy_item(item: Dictionary) -> void:
	var price = int(item.get("price", 0))
	if PlayerData.money < price:
		GameManager.play_ui_se("cancel")
		return
		
	PlayerData.spend_money(price)
	GameManager.log_money_change(-price)
	GameManager.play_ui_se("confirm") # maybe buy se
	
	var t = item.get("type", "")
	var id = item.get("id", "")
	
	# Give item
	if t == "flavor":
		if not PlayerData.flavor_inventory.has(id):
			PlayerData.flavor_inventory.append(id)
			PlayerData.flavor_specialties[id] = 20 # Auto mastery start
	elif t == "pipe" or t == "bowl" or t == "hms":
		match t:
			"pipe":
				if not PlayerData.owned_pipes.has(id): PlayerData.owned_pipes.append(id)
			"bowl":
				if not PlayerData.owned_bowls.has(id): PlayerData.owned_bowls.append(id)
			"hms":
				if not PlayerData.owned_hms.has(id): PlayerData.owned_hms.append(id)
				
	_show_info({"name": "購入完了", "price": 0, "desc": "%s を購入しました！" % item.get("name", "")})
	_refresh_ui()

func _on_back_button_pressed() -> void:
	GameManager.play_ui_se("cancel")
	get_tree().change_scene_to_file("res://scenes/daily/map.tscn")
