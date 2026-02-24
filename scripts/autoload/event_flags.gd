extends Node

var flags: Dictionary = {}


func reset_flags() -> void:
	flags.clear()


func set_flag(flag_name: String, value: bool = true) -> void:
	flags[flag_name] = value


func get_flag(flag_name: String) -> bool:
	return bool(flags.get(flag_name, false))


func set_value(key: String, value: Variant) -> void:
	flags[key] = value


func get_value(key: String, default_value: Variant = null) -> Variant:
	return flags.get(key, default_value)


func to_save_data() -> Dictionary:
	return flags.duplicate(true)


func from_save_data(data: Dictionary) -> void:
	flags = data.duplicate(true)
