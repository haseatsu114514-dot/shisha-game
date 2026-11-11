# Issue #3222 なる（裏ボス）のサンドボードライダー

Codex の画像生成で作った透過 PNG 原画（6ポーズ）。ゲーム用 WebP は `remake/img/ui/desert_ride/rider_naru_*.webp`。
2026-11-11 にオーナーが ZIP で受け渡し（`naru-sandboard-3222-candidates.zip`）。同梱の `SHA256.json` と 25 ファイルすべて一致を確認した。

## 採用したもの

| 原画 | ポーズ | WebP の寸法 | 基準点（板の中心） | 原画→WebP の倍率 |
| --- | --- | --- | --- | --- |
| `rider_naru_ride.png` | 通常の滑走 | 517×796 | 0.5954, 0.8026 | 0.5932 |
| `rider_naru_lean_left.png` | 画面の左へ傾けて旋回 | 581×752 | 0.588, 0.7849 | 0.5699 |
| `rider_naru_lean_right.png` | 画面の右へ傾けて旋回 | 591×810 | 0.486, 0.7764 | 0.6513 |
| `rider_naru_jump.png` | 空中で膝を曲げる | 560×696 | 0.5779, 0.8011 | 0.554 |
| `rider_naru_brace.png` | 着地に備えて深くしゃがむ | 600×656 | 0.5384, 0.8029 | 0.5348 |
| `rider_naru_fall.png` | 板が離れた転倒 | 541×652 | 0.5265, 0.9582 | 0.5062 |

正確な値と原画の SHA-256 は `adoption.json`（`build.py` が書き出す）。`desert-ride-art.js` の `naruRider…` は同じ値で、`remake/test/desert_ride.mjs` が照合する。

## 作り直しの手順（`build.py`）

Codex が同梱した `canvas-candidates/`（主人公と同じキャンバスへ中央に縮めただけ）は、板が基準点から最大29px（約4%）ずれ、背丈も主人公の約94%だったので採用しなかった。代わりに原画から作り直した。

1. 透明部分の薄いノイズを消す（不透明度10未満で、人物から6px以上離れた点）。
2. 縮尺: 主人公の同じポーズ（`rider_<pose>.webp`）と「絵の上端（頭）から板の中心まで」の長さが同じになる倍率。転倒だけは板が離れるので絵の高さをそろえる。
3. 基準点: 板の中心（クリーム色の画素の重心）。転倒は、主人公の転倒の基準点が絵の範囲のどこにあるかを写す。
4. キャンバスは絵の範囲＋2px。乗算済みアルファで縮小し、WebP（品質90）で保存。

身長の差（なる176cm・主人公172cm・ヌール168cm）は絵ではなく、描く時の倍率 `RIVAL_ART_SCALE`（`desert-ride.js`。`data/characters.json` の `spriteScale` と同じ値）で付ける。
別の原画に替えるときは、原画を置き換えて `python3 asset_sources/desert-ride-naru-3222/build.py` を実行し、出力された寸法・基準点を `DESERT_ART` に写す。

## 保存しなかったもの

- Codex の `canvas-candidates/` と同梱の WebP（上の理由で不採用）。
- `rejected/` の2枚（最初の生成で頭・指先が切れた通常と右旋回。作り直し済み）。LFS の容量を使わないため保存しない。

## Codex の生成記録

`GENERATION.txt`（生成指示の要約）、`references.json`（参照画像のパスと SHA-256）、`codex-notes.txt`（Codex の受け渡しメモ）。
