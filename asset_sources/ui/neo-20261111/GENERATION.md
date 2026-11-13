# LK19 neo UI 追加2部品（PR #3365）

2026-11-11 UTC。原画候補を保存。ゲームへ未組込・未採用。GitHubへの書込・Git LFS登録は未実施。

## 正本と重複確認
PR #3365 / branch `claude/festive-cerf-ruw60j` の `asset_sources/ui/neo-20261111/README.md` と各promptを取得。正本は未生成と記載、PRのコメント0件、最新Issue/OPEN PRに追加担当や生成記録なし。共通styleはmainの `asset_sources/ui/craft-night-20261102/prompts/style.txt`。

## 生成
内蔵imagegen、1回に1枚、transparent_background=true。参照画像は指定されていないため無し。各回 `prompts/style.txt` を先頭、その次に各 `prompts/<name>.txt` を原文のまま渡した。band-smokeは3回、heading-ruleは1回。実際の全文は同梱promptファイル2つの連結。APIの直接呼出なし。原画は無加工コピー。

## QA
- 2枚とも2172×724のRGBA PNG、3:1、alpha=0の背景あり、全透明ではない。
- 機材・人物・文字・枠なし、パネルの塗り足しなしを原寸目視確認。
- heading-rule: 金の水平線と下の薄いラベンダー線、左の小さな煙飾り、右へ透過する構成。飾りの幅5%以内で、約92%の長さ、中央配置を目視確認。採用前の実画面QAは未実施。
- **band-smokeは不透明度条件が未達**。指定は概ね10〜35%だが、3回ともalpha>90の画素を含む濃い帯となった。最も薄い2回目を候補に選び、他2枚をrejectedに保存。原画を勝手に薄く加工していない。文字が重なる場所では背景が明るくなり過ぎる可能性があるため、本番合格とはしない。組込時の明示的な低opacity指定または再編集が必要。
- 見本の比較画像は暗い紫に原画を合成し、煙の上に白い検査文字を重ねたQA用。文字は原画にはない。

## ファイル記録

| 原画 | 画素寸法 | bytes | SHA-256 | 判定 |
|---|---|---:|---|---|
| raw/band-smoke.png | 2172×724 | 1307004 | `544e045a39d4680661898f3158feff5f3b4b0f0fdb415dd81bb2aae616fadc98` | CANDIDATE_OPACITY_NG |
| raw/heading-rule.png | 2172×724 | 110259 | `2512a7c805181b03086c20c9390751cb54273aa803e904d33462cd4b752dc443` | PASS_VISUAL |

GitHub PRを作成する場合は最新main起点、生成画像をGit LFSで追加して確認。今回の納品はZIPまでで、本編のコード・CSS・既存画像は変更していない。
