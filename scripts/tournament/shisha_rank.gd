## シーシャランク（Shisha Rank）
## 大会終了後のリザルト画面でプレイヤーのスコアに基づいてランクを表示する。
## 勝敗に関わらず、大会が終わると必ず表示される。

class_name ShishaRank

## ランク定義（スコア閾値は大会章ごとのmax_scoreに対する割合）
## SSS: 95%以上, SS: 85%以上, S: 75%以上, A: 60%以上, B: 45%以上, C: それ以下
const RANK_THRESHOLDS := [
	{"rank": "SSS", "label": "Smokin' Supreme Session", "threshold": 0.95, "color": Color(1.0, 0.84, 0.0)},
	{"rank": "SS", "label": "Smokin' Session", "threshold": 0.85, "color": Color(1.0, 0.55, 0.0)},
	{"rank": "S", "label": "Smokin'", "threshold": 0.75, "color": Color(0.9, 0.2, 0.2)},
	{"rank": "A", "label": "Absolute", "threshold": 0.60, "color": Color(0.6, 0.4, 0.9)},
	{"rank": "B", "label": "Blazing", "threshold": 0.45, "color": Color(0.3, 0.6, 1.0)},
	{"rank": "C", "label": "Chill", "threshold": 0.0, "color": Color(0.5, 0.8, 0.5)},
]

## 各章の想定最大スコア（完璧プレイ時の理論値ベース）
const MAX_SCORES_BY_CHAPTER := {
	1: 90.0,
	2: 100.0,
	3: 110.0,
	4: 120.0,
}


## スコアからランク情報を返す
## 返り値: {"rank": "S", "label": "Smokin'", "color": Color, "ratio": float}
static func calculate_rank(score: float, chapter: int = 1) -> Dictionary:
	var max_score = float(MAX_SCORES_BY_CHAPTER.get(chapter, 90.0))
	var ratio = clampf(score / max_score, 0.0, 1.0)
	
	for entry in RANK_THRESHOLDS:
		if ratio >= float(entry["threshold"]):
			return {
				"rank": entry["rank"],
				"label": entry["label"],
				"color": entry["color"],
				"ratio": ratio,
				"score": score,
			}
	# フォールバック（ここには来ないはず）
	return RANK_THRESHOLDS[-1].duplicate()


## ランク表示用のテキストを生成
static func get_rank_display_text(score: float, chapter: int = 1) -> String:
	var info = calculate_rank(score, chapter)
	return "%s (%s)" % [info["rank"], info["label"]]


## Ch5解禁条件チェック: S以上かどうか
static func is_ch5_unlock_rank(score: float, chapter: int = 4) -> bool:
	var info = calculate_rank(score, chapter)
	return info["rank"] in ["S", "SS", "SSS"]
