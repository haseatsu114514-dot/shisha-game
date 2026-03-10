extends Node

const MORNING_PHONE_SCENE_PATH := "res://scenes/daily/morning_phone.tscn"
const PRACTICE_SCENE_PATH := "res://scenes/daily/practice.tscn"
const TOURNAMENT_SCENE_PATH := "res://scenes/tournament/ch1_tournament.tscn"

var _failed: bool = false


func _ready() -> void:
	await get_tree().process_frame
	await _run()
	get_tree().quit(1 if _failed else 0)


func _run() -> void:
	print("[SMOKE] Chapter 1 smoke start")
	GameManager.start_new_game()
	await _smoke_morning_phone()
	GameManager.start_new_game()
	await _smoke_practice()
	GameManager.start_new_game()
	await _smoke_forced_event_resolution()
	GameManager.start_new_game()
	await _smoke_tournament()
	if not _failed:
		print("[SMOKE] Chapter 1 smoke ok")


func _smoke_morning_phone() -> void:
	print("[SMOKE] morning_phone")
	CalendarManager.current_day = 1
	CalendarManager.current_time = "morning"
	var scene = await _mount_scene(MORNING_PHONE_SCENE_PATH)
	_assert(scene.close_phone_button != null and scene.close_phone_button.visible, "朝スマホの閉じる導線が出ていない")
	_assert(scene.summary_panel.visible or scene.detail_panel.visible or scene.rule_panel.visible, "朝スマホの情報カードが空")
	await _free_scene(scene)


func _smoke_practice() -> void:
	print("[SMOKE] practice")
	PlayerData.add_flavor("double_apple", 50)
	PlayerData.add_flavor("mint", 50)
	var scene = await _mount_scene(PRACTICE_SCENE_PATH)
	scene._show_mix_step()
	scene._tutorial_packing_grams["double_apple"] = 6
	scene._tutorial_packing_grams["mint"] = 6
	scene._on_tutorial_mix_confirmed()
	scene._on_packing_style_selected("normal")
	scene._show_charcoal_prep_step()
	scene._on_charcoal_prep_choice("perfect")
	scene._on_charcoal_place_selected(3)
	scene._tutorial_steam_minutes_setting = 6
	scene._on_tutorial_steam_confirmed()
	scene._mind_barrage_done = true
	scene._show_pull_step()
	scene._pull_gauge_value = scene._pull_target_center
	scene._resolve_pull_quality()
	scene._start_adjustment_tutorial()
	scene._adjust_success_count = 2
	scene._temp_level = scene._temperature_center()
	scene._show_adjustment_summary()
	_assert(scene.phase_label.text.find("10 / 10") != -1, "チュートリアル終盤のステップ表記が崩れている")
	_assert(scene.choice_container.get_child_count() > 0, "チュートリアルの進行ボタンが消えている")
	await _free_scene(scene)


func _smoke_forced_event_resolution() -> void:
	print("[SMOKE] forced_events")
	CalendarManager.setup_chapter(1)
	GameManager.current_chapter = 1
	GameManager.current_phase = "daily"
	GameManager.game_state = "daily"
	GameManager._load_forced_events()
	CalendarManager.current_day = 8
	CalendarManager.current_time = "noon"
	var tournament_event = GameManager.get_forced_event_for_today("noon")
	_assert(str(tournament_event.get("id", "")) == "ch1_forced_tournament", "第1章大会当日の強制イベントが取得できない")
	_assert(GameManager.resolve_next_scene_path(str(tournament_event.get("next_scene", ""))) == TOURNAMENT_SCENE_PATH, "大会当日の遷移先が大会 scene になっていない")

	EventFlags.set_value("ch1_tournament_rank", 2)
	EventFlags.set_flag("ch1_tournament_rank_not_1", true)
	GameManager.transition_to_interval()
	var lose_event = GameManager.get_forced_event_for_today("morning")
	_assert(str(lose_event.get("dialogue_id", "")) == "interval_day1_morning", "敗北時インターバル導入が出ない")

	CalendarManager.end_interval()
	EventFlags.set_value("ch1_tournament_rank", 1)
	EventFlags.set_flag("ch1_tournament_rank_not_1", false)
	GameManager.transition_to_interval()
	var win_event = GameManager.get_forced_event_for_today("morning")
	_assert(str(win_event.get("dialogue_id", "")) == "interval_day1_morning_win", "優勝時インターバル導入が出ない")
	CalendarManager.end_interval()


func _smoke_tournament() -> void:
	print("[SMOKE] tournament")
	GameManager.current_phase = "tournament"
	GameManager.game_state = "tournament"
	CalendarManager.current_day = CalendarManager.tournament_day
	CalendarManager.current_time = "noon"
	PlayerData.add_flavor("double_apple", 50)
	PlayerData.add_flavor("mint", 50)
	PlayerData.add_flavor("blueberry", 50)

	var scene = await _mount_scene(TOURNAMENT_SCENE_PATH)
	scene._selected_bowl = PlayerData.equipment_bowl
	scene._selected_hms = PlayerData.equipment_hms
	scene._on_setting_confirmed()
	scene._apply_recommended_flavors()
	scene._confirm_flavor_selection()
	if scene._selected_flavors.size() < 2:
		scene._selected_flavors = ["double_apple", "mint"]
		scene._show_packing_step()
	scene._manual_packing_grams.clear()
	for flavor_id in scene._selected_flavors:
		scene._manual_packing_grams[flavor_id] = 0
	scene._manual_packing_grams[scene._selected_flavors[0]] = 6
	scene._manual_packing_grams[scene._selected_flavors[1]] = 6
	scene._confirm_manual_packing()
	scene._on_packing_style_selected("normal")
	scene._show_charcoal_prep_step()
	scene._on_charcoal_prep_choice("perfect")
	scene._on_charcoal_place_selected(3)
	scene._on_steam_selected(6)
	scene._mind_barrage_done = true
	scene._show_pull_step()
	scene._pull_gauge_value = scene._pull_target_center
	scene._pull_is_holding = true
	scene._on_pull_hold_released()
	scene._show_serving_step()
	scene._on_serving_confirmed()
	_assert(scene.phase_label.text.find("10 / 16") != -1 or scene.phase_label.text.find("13 / 16") != -1, "大会の中盤導線が崩れている")
	_assert(scene.choice_container.get_child_count() > 0, "大会の進行ボタンが消えている")
	await _free_scene(scene)


func _mount_scene(path: String) -> Node:
	var packed = load(path)
	_assert(packed != null, "scene を読めない: %s" % path)
	if packed == null:
		return Node.new()
	var scene = packed.instantiate()
	add_child(scene)
	await get_tree().process_frame
	await get_tree().process_frame
	return scene


func _free_scene(scene: Node) -> void:
	if scene == null or not is_instance_valid(scene):
		return
	scene.queue_free()
	await get_tree().process_frame
	await get_tree().process_frame


func _assert(condition: bool, message: String) -> void:
	if condition:
		return
	_failed = true
	push_error("[SMOKE] %s" % message)
