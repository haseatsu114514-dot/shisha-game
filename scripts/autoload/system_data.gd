extends Node

const SYSTEM_DATA_PATH := "user://system_data.json"

var unlocked_cgs: Array[String] = []

func _ready() -> void:
    load_data()

func load_data() -> void:
    unlocked_cgs.clear()
    if not FileAccess.file_exists(SYSTEM_DATA_PATH):
        return
        
    var file = FileAccess.open(SYSTEM_DATA_PATH, FileAccess.READ)
    if file == null:
        return
        
    var parsed = JSON.parse_string(file.get_as_text())
    file.close()
    
    if typeof(parsed) == TYPE_DICTIONARY:
        var cgs = parsed.get("unlocked_cgs", [])
        if typeof(cgs) == TYPE_ARRAY:
            for cg in cgs:
                unlocked_cgs.append(str(cg))

func save_data() -> void:
    var data: Dictionary = {
        "unlocked_cgs": unlocked_cgs
    }
    
    var file = FileAccess.open(SYSTEM_DATA_PATH, FileAccess.WRITE)
    if file == null:
        push_error("Failed to save system data to: %s" % SYSTEM_DATA_PATH)
        return
        
    file.store_string(JSON.stringify(data, "\t"))
    file.close()

func unlock_cg(cg_id: String) -> void:
    if not unlocked_cgs.has(cg_id):
        unlocked_cgs.append(cg_id)
        save_data()

func is_cg_unlocked(cg_id: String) -> bool:
    return unlocked_cgs.has(cg_id)
