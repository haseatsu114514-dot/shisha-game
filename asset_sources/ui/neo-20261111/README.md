# 新版（neo）の絵の部品の記録（LK19）

オーナー「CSSで作りました感強いところは直したい　コーデックスとかに頼りつつ」（2026-11-11・台帳 LK19）。

## 第1弾: 既にある夜紫の部品を日常の画面へ広げる（新しい生成なし）

新版の小窓・ボタン・行動の選択の札・HUD の板・全画面 MENU には、制作・大会の画面用に生成済みの夜紫の部品
（原画と依頼文は `asset_sources/ui/craft-night-20261102/`、採用は `assets/ui/craft-night/`、実行時の WebP は `remake/img/ui/craft-night/`）を
`remake/css/look-neo-art.css` で九分割して重ねた。使った部品: `board`（板）・`window`（札）・`button-glass`／`button-gold`（ボタン）・`rank-strip`（細い帯）・`backdrop`（MENU の奥）。

## 第2弾: 新しく要る部品（未生成。下の依頼文で Codex に生成してもらう）

共通のスタイル指針は夜紫の部品と同じ `asset_sources/ui/craft-night-20261102/prompts/style.txt` を冒頭にそのまま貼る。1回の生成で PNG 1枚。
生成した原画は `asset_sources/ui/neo-20261111/raw/<名前>.png` に置く（採用は `assets/ui/neo/<名前>.png`、実行時は `remake/img/ui/neo/<名前>.webp`）。

| 名前 | 使う場所 | 依頼文 | 状態 |
|---|---|---|---|
| `band-smoke` | 会話の帯（下から立ち上がる夜紫の帯）の上に重ねる煙。帯は下の絵を透かすので、煙だけの透過画像にする | `prompts/band-smoke.txt` | 未生成 |
| `heading-rule` | 見出しの下の金の罫線（小窓・行動の選択・心得の盤・会話の名前の下）。左端に小さな煙の飾り、右へ消える | `prompts/heading-rule.txt` | 未生成 |

2026-11-11 に画像生成の API（api.openai.com）で `band-smoke` を試したが、残高切れ（`credit_balance_exhausted`）で生成できなかった。
