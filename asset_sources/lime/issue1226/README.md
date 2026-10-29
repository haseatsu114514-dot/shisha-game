# LIME スタンプ・画像素材 制作記録（Issue #1226）

企画正本: `work/a-lime-stamps/DESIGN.md`（ミューズ作業領域。§2 コンセプト表／§5 素材リスト／§6 生成計画）。
差し込み設計: `work/claude-lime-placement/PLACEMENT.md`（Claude 担当。§6 に DESIGN との照合結果）。
本フォルダには導入11素材の原画を収める。当初6素材に、PLACEMENT との照合で生じた種別ギャップ2件（みんと応援・凛の得意げ）と、オーナー指示（2026-10-28 19:42「合うキャラには広く使う」）による前倒し3件（あげは挨拶・感謝、つむぎ挨拶）を追加した。残り25素材は企画ストック（DESIGN §3）で、配信先確定後に追加する。

## 制作方法（2026-10-28）

- 生成: Muse の media 生成パイプライン（`media.generate_image`）。プロンプトは DESIGN §6 の文案を使用。
- スタンプ: 生成は「絵のみ・白背景」。背景は辺-connected な白領域の flood fill で透過化し、1024×1024 透過 PNG に再配置したものを `art.png`、文言を後入れ合成したものを `master.png` とする。文言は生成に任せず Noto Sans CJK Bold で合成（濃茶文字＋白縁）。ゲーム用は master から 320×320 に縮小。
- 画像: 生成（4:3）→ 中央トリミングで 4:3 を厳密化し 1536×1152 を `master.png`、ゲーム用は 960×720 WebP（quality 85）。

## 初回6素材

| ID | 種別 | 生成プロンプト要旨 | 文言（後入れ） | QA |
|---|---|---|---|---|
| `st_adam_bless` | スタンプ | 左に赤・右に緑の林檎が葉を掲げる（DESIGN §6 原文） | 林檎の祝福を | 左右・色・余白とも仕様どおり |
| `st_minto_welcome` | スタンプ | ミントの葉頭の店員が前掛け姿で手を振る | 待ってるね♪ | 顔・文字なし。営業アカウント用 |
| `st_naru_sleep` | スタンプ | マフィンが小さな布団を指す | ちゃんと寝ろよ | 説教調になっていない |
| `im_adam_moon` | 画像 | 夜空の月と端の枝先、写メ風 | — | 人物・文字なし |
| `im_rin_stock` | 画像 | 棚に整然と並ぶ無地の小袋（Dr.fookah 入荷） | — | 読める価格・ロゴなし。やや実写寄りの質感 |
| `im_tsumugi_draft` | 画像 | 机のスケッチブック、鉛筆の下描き（カウンターの手・窓辺の煙） | — | 完成作・署名・顔なし。消し跡あり |

## 追加5素材（PLACEMENT 照合＋オーナー方針 19:42）

| ID | 種別 | 由来 | 文言（後入れ） | 差し込み先 |
|---|---|---|---|---|
| `st_minto_cheer` | スタンプ | PLACEMENT 種別ギャップ（stamp_minto_react）。welcome のキャラを参照し両手上げ応援ポーズで生成 | がんばれ♪ | encourage_minto |
| `st_rin_smug` | スタンプ | PLACEMENT 種別ギャップ（stamp_rin_react）。試料袋キャラの半目・得意げ＋キラキラ1つ | ふふ | lime_rin_report |
| `st_ageha_ok` | スタンプ | PLACEMENT 前倒し（stamp_ageha_greet → DESIGN の st_ageha_ok 流用） | おっけー | lime_ageha_day3 |
| `st_ageha_thanks` | スタンプ | PLACEMENT 前倒し（第2章分）。ok のクマを参照しハート抱き | ありがと | lime_ch2_ageha_after_visit |
| `st_tsumugi_nod` | スタンプ | PLACEMENT 前倒し（stamp_tsumugi_greet → DESIGN の st_tsumugi_nod 流用） | はい | lime_outing_tsumugi_1 |

## 配置

- 原画: `asset_sources/lime/issue1226/stamps/<ID>/{art,master}.png`、`images/<ID>/master.png`
- ゲーム用: `remake/img/ui/lime/stamps/<ID>.png`、`remake/img/ui/lime/images/<ID>.webp`
- ゲーム用は `remake/data/manifest.json` への登録が必須（DESIGN §5）。
