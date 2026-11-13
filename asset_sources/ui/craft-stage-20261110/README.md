# Craft stage UI source record（CSL・「一枚の舞台」レイアウトの部品）

シーシャ作りの新しいレイアウト（[設計の要点](../../../docs/design/craft-stage-layout.md)）で新しく要る部品の原画と記録。依頼文は [prompts.md](prompts.md)。画風は現行の夜紫UI（`../craft-night-20261102/`）と同じ。

## 原画の記録（生成したら1枚1行で書く）

| 原画 | サイズ | bytes | SHA-256 | CHECK の結果 |
|---|---:|---:|---|---|
| `raw/counter-stone.png`（Codex の B案） | 1536×1024 | 1872433 | `9345cae748a116b426377b71e3a779661745656141d198134ef5d91ee8283b14` | 合格（枠なし・境界約17%・中央は空・小物は右端）。採用 `assets/ui/craft-stage/counter-stone.png`（無加工）→ `remake/img/ui/craft-stage/counter-stone.webp` 1280×853 |
| 残りの11部品（2026-11-11 Codex）: `raw/<名前>.png` は画像生成の未加工原画、`processed/<名前>.png` は Codex 側で寸法・透明窓・灯の位置をコードで補正したもの（`records/build_derived.py`） | 各 `records/final-manifest.json` | — | 同 manifest に原画・加工済みの全11枚 | 合格（`records/final-qa.json`: 透明窓は内部の面まで alpha0、灯5種は輪の中心と外径574を共通、文字なし）。採用は `processed/` を alpha≥8 で切り出し（灯5種は lamp-shine の外接範囲 780×780 を共通の枠に）→ `assets/ui/craft-stage/` → `remake/img/ui/craft-stage/*.webp` |

## 本編での当て方（2026-11-11）

| 部品 | 場所 | 当て方 |
|---|---|---|
| `spine-housing` | 熱の柱 | 幅74・y96〜608 の border-image（上86・下97 を残して縦に伸ばす）。窓 y139〜559 に管（幅26）を重ね、温度計はこの窓の高さ420 |
| `lamp-*` | 上のレールの工程の灯 | 灯の箱の外へ18%広げた疑似要素。off→未着手、faint→かすか（dim）、fair→灯った（good）、good→よく灯った（great）、shine→輝く（brilliant） |
| `voice-plate` | 左下の一言 | border-image（左194・右112・上下96）。顔は左の丸い座（直径57） |
| `counter-mat` | 配合・詰め方・穴あけ・蒸らしの舞台 | 舞台いっぱいに敷き、左と上を暗く溶かす（石の天板と同じ） |
| `dial-bezel` | 吸い出しのダイヤル | 外径R=224.3（viewBox単位）で、透明の窓 0.53R〜0.945R が帯の溝 r118〜212 に重なる位置へ。針と帯はその上 |
| `spine-plate` | 柱の上の札（温度帯・ぬるい等） | 両端の丸を残して横に伸ばす。中の色と文字はコード |
| `rail-now` | 今の工程の札 | 左の白い丸に工程の番号。右端の丸を残して横に伸ばす |

## 受け取った後の手順（実装側）

1. 透過の画像は alpha≥8 の外接範囲で切り出し、完全透明画素の RGB を黒にする（光彩のある `lamp-good`・`lamp-shine`・`rail-now` は光彩ごと残す。5つの灯は同じ切り出し枠を使う）。
2. 採用画像を `assets/ui/craft-stage/<名前>.png` に置き、この表へ切り出し後のサイズを追記する。
3. `remake/tools/build_ui_skin.py` に `craft-stage` の表（`CRAFT_NIGHT_PARTS` と同じ形）を足し、`remake/img/ui/craft-stage/*.webp` を作る。
4. 画面で確かめる寸法（1280×720 のステージ座標）:
   - `spine-housing`: 幅60×高さ468〜520。中央の透明窓に管（グラデーション・適温の線・矢印）をコードで重ねる。縦は中ほどを九分割で伸ばす。
   - 灯5種: 上のレールで直径36。光彩ぶんを含めて約60で置く。
   - `voice-plate`: 388×96。顔の座は直径約58。右側を横に伸ばす。
   - `counter-stone`・`counter-mat`: 舞台（x410〜1280・y76〜720）に敷く。左端はコード側でも暗く溶かす。
   - `dial-bezel`: 半円ダイヤル（本編の viewBox 480×240・帯は半径118〜212）に合わせ、帯の透明窓へ色分けと針をコードで重ねる。
   - `spine-plate`: 132×42。中の色と文字はコード。`rail-now`: 高さ44で横に伸ばす。
5. 新規画像は Git LFS（`git lfs ls-files` で確認）。差し替え後は該当画面を目視し、`craft_materials`・`phone_density` など関連のブラウザ検査を通す。
