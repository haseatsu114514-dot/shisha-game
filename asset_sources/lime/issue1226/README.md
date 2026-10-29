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

## 第2弾18素材（未着手6人、2026-10-29）

- 生成: Codex C の画像生成。プロンプトは DESIGN §6 原文ベースで、キャラ単位に3点ずつ生成。
- 対象6人（組長・南雲・スミ・ましろ・ひより・サメちゃん）が送信者になる通常スレッドは現行データに存在しないため、本弾の成果範囲は素材・定義・台帳登録まで。会話への差し込みは、配信先スレッドの確定後に別途行う。

| ID | 種別 | 生成プロンプト要旨 | 文言（後入れ） | QA |
|---|---|---|---|---|
| `st_kumicho_ack` | スタンプ | 灰緑の湯呑みが少し傾いて一礼 | おう | 人物・文字・紋章なし |
| `st_kumicho_care` | スタンプ | ドラゴンフルーツが湯呑みを差し出す | 無理すんな | 世話好きな雰囲気 |
| `im_kumicho_tools` | 画像 | 神崎煙草店の冷えたトングと整理された炭受け | — | 赤熱炭・人物なし |
| `st_nagumo_ack` | スタンプ | 白い便箋の上で小さくうなずく煙 | 承知した | 採点・ロゴなし |
| `st_nagumo_cheer` | スタンプ | シーシャのボトル一台と細い煙 | 健闘を祈る | 王冠・順位なし |
| `im_nagumo_ready` | 画像 | 開場前の整った空席とシーシャ一台 | — | 人物・掲示なし |
| `st_sumi_ack` | スタンプ | 使い込んだトングが静かに置かれている | おう | 赤熱炭・擬音なし |
| `st_sumi_rest` | スタンプ | 小さなボトルと空いた椅子、緩む煙 | 一服しろ | 人物なし |
| `im_sumi_counter` | 画像 | tonari の拭き終えたカウンターと整えた器具 | — | 読める文字・賞状なし |
| `st_mashiro_morning` | スタンプ | 紅茶カップと眠たげな湯気 | おはよう | 人物・ハートなし |
| `st_mashiro_tea` | スタンプ | カップが空の受け皿を示して誘う | お茶にしよ | 1点目と造形統一 |
| `im_mashiro_tea` | 画像 | mukai の卓上の紅茶ポットと二つのカップ | — | 読める文字なし |
| `st_hiyori_tired` | スタンプ | マグと小さな花一輪 | おつかれさま | 病弱さの表現なし |
| `st_hiyori_break` | スタンプ | 二枚の葉がマグを両側から支える | 少し休憩 | 涙・病気の表現なし |
| `im_hiyori_ramen` | 画像 | 背脂ラーメン一杯と箸 | — | 顔の映り込みなし |
| `st_samechan_ack` | スタンプ | コロちゃん（正本造形）が小さくうなずく | 承知したぞ | 人間の手なし |
| `st_samechan_rest` | スタンプ | コロちゃんが煙の輪に寄りかかって休む | ひと休みじゃ | 造形は正本一致 |
| `im_samechan_ring` | 画像 | 練習した煙の輪 | — | 人物なし |

## 配置

- 原画: `asset_sources/lime/issue1226/stamps/<ID>/{art,master}.png`、`images/<ID>/master.png`
- ゲーム用: `remake/img/ui/lime/stamps/<ID>.png`、`remake/img/ui/lime/images/<ID>.webp`
- ゲーム用は `remake/data/manifest.json` への登録が必須（DESIGN §5）。
