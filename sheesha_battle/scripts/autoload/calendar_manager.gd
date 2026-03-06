extends Node

signal day_changed(day: int)
signal time_changed(time_slot: String)

var current_day: int = 1
var current_time: String = "morning"
var max_days: int = 7
var actions_remaining: int = 2
var tournament_day: int = 8

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


func reset_calendar(new_max_days: int = 7, tournament_day_num: int = 8) -> void:
	current_day = 1
	current_time = "morning"
	max_days = new_max_days
	tournament_day = tournament_day_num
	actions_remaining = 2
	emit_signal("day_changed", current_day)
	emit_signal("time_changed", current_time)


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
			current_day += 1
			actions_remaining = 2
			emit_signal("day_changed", current_day)
		_:
			current_time = "morning"

	emit_signal("time_changed", current_time)


func use_action() -> bool:
	if actions_remaining <= 0:
		return false
	actions_remaining -= 1
	return true


func is_tournament_day() -> bool:
	return current_day >= tournament_day


func get_remaining_days() -> int:
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
	return "Day %d / %d　%s" % [current_day, max_days, slot_name]


func get_weather_id(day: int = -1) -> String:
	var target_day = current_day if day <= 0 else day
	return str(WEATHER_SCHEDULE.get(target_day, "sunny"))


func get_weather_label(day: int = -1) -> String:
	var weather_id = get_weather_id(day)
	return str(WEATHER_LABELS.get(weather_id, "晴れ"))


func get_weekday_label(day: int = -1) -> String:
	var target_day = current_day if day <= 0 else day
	var index = posmod(target_day - 1, WEEKDAY_LABELS.size())
	return WEEKDAY_LABELS[index]
