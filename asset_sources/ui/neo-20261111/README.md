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
| `band-smoke` | 会話の帯（下から立ち上がる夜紫の帯）の上に重ねる煙。帯は下の絵を透かすので、煙だけの透過画像にする | `prompts/band-smoke.txt` | 組み込み済み（下の記録） |
| `heading-rule` | 見出しの下の金の罫線（小窓・行動の選択・心得の盤・会話の名前の下）。左端に小さな煙の飾り、右へ消える | `prompts/heading-rule.txt` | 組み込み済み（下の記録） |

2026-11-11 に画像生成の API（api.openai.com）で `band-smoke` を試したが、残高切れ（`credit_balance_exhausted`）で生成できなかった。

## 第2弾の原画と組み込み（2026-11-11 Codex で生成・オーナーから受領）

生成の経緯と Codex 側の検品は [GENERATION.md](GENERATION.md)・[QA.json](QA.json)。共通の画風の文は `craft-night-20261102/prompts/style.txt`、各部品の文は `prompts/` のまま（受領した依頼文は末尾の改行以外同じ）。

| 原画 | サイズ | bytes | SHA-256 | 判定・採用 |
|---|---:|---:|---|---|
| `raw/band-smoke.png` | 2172×724 | 1307004 | `544e045a39d4680661898f3158feff5f3b4b0f0fdb415dd81bb2aae616fadc98` | 不透明度が依頼（10〜35%）より濃い（3回とも同じ。いちばん薄い2回目）。**採用**: alpha≥8 で切り出し（2156×454）→ `assets/ui/neo/band-smoke.png`。実行時の `remake/img/ui/neo/band-smoke.webp`（1280×270）だけ不透明度を35%に下げる（`remake/tools/build_ui_skin.py` の `NEO_PARTS`）。白い本文が読めることを画面で確認 |
| `raw/heading-rule.png` | 2172×724 | 110259 | `2512a7c805181b03086c20c9390751cb54273aa803e904d33462cd4b752dc443` | 合格。**採用**: alpha≥8 で切り出し（1903×79）→ `assets/ui/neo/heading-rule.png` → `remake/img/ui/neo/heading-rule.webp`（1142×47。画面では0.3倍の571×23.7） |
| `rejected/band-smoke-01.png`・`rejected/band-smoke-03.png` | 2172×724 | — | `5ee7fc97…`・`a8d5d682…` | 不採用（2回目より濃い） |

### 当て方（`remake/css/look-neo-art.css` の 7）

- **会話の帯**: 帯の暗いグラデーション（`.vn-box::before`）に、煙（帯の上の端、名前の行のあたり）と飾り罫（金の線の中心を、名前と本文のあいだの金の線に合わせる）を重ねる。地の文・心の声は名前が無いので煙だけ。
- **見出しの下**（小窓の見出し・LOG の見出し・行動の選択の見出し）: 下端の金の線（1px のグラデーション）に、飾り罫の金の線を重ねる。絵の下5pxは箱の外なので切れる。
- 元の CSS の金の線と帯のグラデーションは下に残す（絵が読めない時は今の見た目）。箱の大きさ・余白は変えない。
- 心得の盤の見出しにはまだ当てていない（`look-neo-board.css` の盤は専用の作り）。

