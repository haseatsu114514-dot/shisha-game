extends Node

signal day_changed(day: int)
signal time_changed(time_slot: String)

var current_day: int = 1
var current_time: String = "morning"
var max_days: int = 7
var actions_remaining: int = 2
var tournament_day: int = 8

## Interval phase: free days between tournaments (before next chapter announced)
var is_interval: bool = false
var interval_day: int = 0
var interval_max_days: int = 0

## Overseas stay tracking
var is_overseas: bool = false
var overseas_location: String = ""
var overseas_stay_days: int = 7

## Companion characters traveling with player (overseas)
var companions: Array[String] = []

const WEATHER_LABELS: Dictionary = {
	"sunny": "晴れ",
	"cloudy": "くもり",
	"rainy": "雨",
}

const WEATHER_SCHEDULE: Dictionary = {
	1: "sunny",
	2: "cloudy",
	3: "rainy",
	4: "cloudy",
	5: "rainy",
	6: "cloudy",
	7: "sunny",
	8: "sunny",
}

const WEEKDAY_LABELS: Array[String] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]

## Chapter-specific settings for overseas stays and intervals
const CHAPTER_CONFIG: Dictionary = {
	1: {
		"max_days": 7,
		"tournament_day": 8,
		"location": "地方",
		"overseas": false,
		"interval_days": 5,
	},
	2: {
		"max_days": 7,
		"tournament_day": 8,
		"location": "全国大会 - 東京",
		"overseas": false,
		"interval_days": 5,
	},
	3: {
		"max_days": 7,
		"tournament_day": 8,
		"location": "イスタンブール",
		"overseas": true,
		"overseas_stay_days": 7,
		"interval_days": 5,
		"companions": ["tsumugi"],
	},
	4: {
		"max_days": 7,
		"tournament_day": 8,
		"location": "ドバイ",
		"overseas": true,
		"overseas_stay_days": 7,
		"interval_days": 0,
		"companions": ["tsumugi", "naru"],
	},
}


func reset_calendar(new_max_days: int = 7, tournament_day_num: int = 8) -> void:
	current_day = 1
	current_time = "morning"
	max_days = new_max_days
	tournament_day = tournament_day_num
	actions_remaining = 2
	is_interval = false
	interval_day = 0
	interval_max_days = 0
	emit_signal("day_changed", current_day)
	emit_signal("time_changed", current_time)


func setup_chapter(chapter_num: int) -> void:
	var config = CHAPTER_CONFIG.get(chapter_num, CHAPTER_CONFIG[1])
	reset_calendar(int(config.get("max_days", 7)), int(config.get("tournament_day", 8)))
	is_overseas = bool(config.get("overseas", false))
	overseas_location = str(config.get("location", ""))
	overseas_stay_days = int(config.get("overseas_stay_days", 7))
	companions = []
	var comp_data = config.get("companions", [])
	for c in comp_data:
		companions.append(str(c))


func start_interval(num_days: int) -> void:
	is_interval = true
	interval_day = 1
	interval_max_days = num_days
	current_time = "morning"
	actions_remaining = 2
	emit_signal("day_changed", interval_day)
	emit_signal("time_changed", current_time)


func is_interval_over() -> bool:
	return is_interval and interval_day > interval_max_days


func get_interval_remaining_days() -> int:
	if not is_interval:
		return 0
	return maxi(0, interval_max_days - interval_day + 1)


func end_interval() -> void:
	is_interval = false
	interval_day = 0
	interval_max_days = 0


func advance_time() -> void:
	match current_time:
		"morning":
			current_time = "noon"
		"noon":
			current_time = "night"
		"night":
			current_time = "midnight"
		"midnight":
			current_time = "morning"
			if is_interval:
				interval_day += 1
			else:
				current_day += 1
			actions_remaining = 2
			emit_signal("day_changed", interval_day if is_interval else current_day)
		_:
			current_time = "morning"

	emit_signal("time_changed", current_time)


func use_action() -> bool:
	if actions_remaining <= 0:
		return false
	actions_remaining -= 1
	return true


func is_tournament_day() -> bool:
	if is_interval:
		return false
	return current_day >= tournament_day


func get_remaining_days() -> int:
	if is_interval:
		return get_interval_remaining_days()
	return maxi(0, tournament_day - current_day)


func get_display_date() -> String:
	var slot_name = "朝"
	match current_time:
		"noon":
			slot_name = "昼"
		"night":
			slot_name = "夜"
		"midnight":
			slot_name = "深夜"
	if is_interval:
		return "インターバル Day %d / %d　%s" % [interval_day, interval_max_days, slot_name]
	if is_overseas and overseas_location != "":
		return "%s Day %d / %d　%s" % [overseas_location, current_day, max_days, slot_name]
	return "Day %d / %d　%s" % [current_day, max_days, slot_name]


func get_weather_id(day: int = -1) -> String:
	var target_day = current_day if day <= 0 else day
	if is_interval:
		target_day = interval_day if day <= 0 else day
	return str(WEATHER_SCHEDULE.get(target_day, "sunny"))


func get_weather_label(day: int = -1) -> String:
	var weather_id = get_weather_id(day)
	return str(WEATHER_LABELS.get(weather_id, "晴れ"))


func get_weekday_label(day: int = -1) -> String:
	var target_day = current_day if day <= 0 else day
	if is_interval:
		target_day = interval_day if day <= 0 else day
	var index = posmod(target_day - 1, WEEKDAY_LABELS.size())
	return WEEKDAY_LABELS[index]


func has_companion(character_id: String) -> bool:
	return character_id in companions
