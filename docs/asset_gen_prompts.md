# 画像生成プロンプト集（codex用）— シーシャ作りパート＋立ち絵

> 2026-10-09 TA13: 制作済みのヒロイン原画は[共通の採用候補一覧](../asset_sources/title-daily-heroines-20261009/README.md)から選ぶ。今回の19案と旧15案を保存し、ゲームの差し替え・自動採用は行わない。原画・生成指示・実参照SHA・目視メモを候補集に残す。

> 2026-10-09 CI72〜82: [漫画カットインの全画面／主人公エリア中央・動く比較](../asset_sources/craft-success-cutins/placements-v2-20261008/README.md)。[漫画コマ](../asset_sources/craft-success-cutins/placements-v2-20261008/pair-prompt.txt)・[中央突起の除去](../asset_sources/craft-success-cutins/placements-v2-20261008/stove-fix-prompt.txt)・[コンロの短い目印を真下へ](../asset_sources/craft-success-cutins/placements-v2-20261008/dial-fix-prompt.txt)の指示を保存。目印を斜め・長い中央線にした案は不採用。カットインは比較用で、本編の成功条件へは未接続。コンロPNG／WebPの描画修正は本編素材にも反映。

> 2026-10-09 CI71: [首掛けマイマウスピースがチェーンだけ／ホースが実機につながらない生成ミスの出力後QA](../asset_sources/shisha-hardware-reference/visual-qa-necklace-hose-20261009.md)。キャラは正規立ち絵優先。**チェーン＋立体吸い口本体**と**ホースポートからハンドルまでの連続性**を検品し、NGなら再生成（構図上の遮蔽・見切れは自然なら可）。

> 2026-10-09 CI70: [追加マウスピース3点＋ハンドル4点の実物写真とルール](../asset_sources/shisha-hardware-reference/mouthpiece-handle-skins-20261009.md)。先端チップ（消耗品/マイチップ）・硬いハンドル・柔らかいホースを分ける。色・素材・装飾は自由、首のチェーンはホースではない。スキンは構想のみ、実装変更なし。トングは実物資料待ち。

> 2026-10-09 CI69: [ホースとマウスピースの実物6写真・外部調査・誤描写防止](../asset_sources/shisha-hardware-reference/hose-and-mouthpieces-20261009.md)。[自作のホース接続図](../asset_sources/shisha-hardware-reference/hose-mouthpiece-connections-20261009.svg)も見る。横のポート→1本のホース→硬い持ち手→着脱式衛生チップ→人物の口元。使い捨てチップ／首掛けマイチップは別の選択肢で、首の紐をホースにしない。

> 2026-10-09 CI68: [構造図3点と部品/空気の通り道](../asset_sources/shisha-hardware-reference/anatomy-diagrams-20261009.md)、[ハガルの伝統型・ファンネル型・ボルテックス型、アルミ穴、炭配置、HMD比較調査](../asset_sources/shisha-hardware-reference/bowl-interiors-foil-coal-placement-20261009.md)。[自作の内部模式図](../asset_sources/shisha-hardware-reference/bowl-interiors-types-20261009.svg)も参照。実際のパーツ配置と既存ゲーム工程を優先し、唯一の炭/穴の正解と決めない。

> 2026-10-09 CI67: [アルミ・煙突・シーシャの構図9写真](../asset_sources/shisha-hardware-reference/usage-and-installation-20261009.md)と[これまでの37写真を横断したAI誤描写防止ガイド](../asset_sources/shisha-hardware-reference/ai-generation-structural-pitfalls.md)。ボウル内部の穴の型式、アルミ小穴、HMD・チムニー・トレー、人物・ホース・複数台の接続を区別。既存ゲーム工程・設定は維持。

> 2026-10-09 CI66: [アルミ・HMD・炭の近接写真9点](../asset_sources/shisha-hardware-reference/heat-management-closeups-20261009.md)。アルミに炭を置く方式と別体HMDを区別し、炭の灰と赤熱の描写、器具のスリットと取っ手、陶器の大きさと接続を参考にする。既存の穴あけ・機材を変更しない。

> 2026-10-09 CI65: [実際の喫煙シーンとヒートマネジメントの参考10点](../asset_sources/shisha-hardware-reference/smoking-and-heat-management-20261009.md)。人物の使い方・比率・ホース・煙の描写、ボウルとHMDの違い、炭をトングで扱う位置関係を参考にする。写真の人物・製品は完コピしない。

> 2026-10-09 CI64: シーシャ台を描く際は[実物写真9種の縮小一覧と生成ルール](../asset_sources/shisha-hardware-reference/README.md)を必ず参照。形と材質の理解が目的で、メーカー商品の模写は禁止。色・装飾・比率の創作は自由。描かない指定は優先。

> 2026-10-08 CI62／63: 制作成功カットインの[目元／漫画コマの2案](../asset_sources/craft-success-cutins/concepts-v1-20261008/README.md)。同じ炭焼き画面とはじめを参照した比較モックアップ。[目元の生成指示](../asset_sources/craft-success-cutins/concepts-v1-20261008/eyes-prompt.txt)は工程共通の斜め帯、[漫画コマの生成指示](../asset_sources/craft-success-cutins/concepts-v1-20261008/comic-prompt.txt)は成功した手元と笑顔。本編接続・演出頻度・採用案は未決定。

> 2026-10-08 TA08〜12: [新版19案](../asset_sources/title-art/heroine-concepts-v2-personality-pixel-20261008/README.md)。サメちゃんを加えた6人×3案＋みんとの公私の中間1案。メーカーの異なる木／真鍮／ガラス／ピンクのカット形／黒い金属／青いキューブ型の台を個別参照し、場所と色も分ける。現行ましろタイトル絵はドットの画風だけを参照。[生成指示の記録](../asset_sources/title-art/heroine-concepts-v2-personality-pixel-20261008/make-prompts.py)と各 `.prompt.txt` を保存。最初の15案は比較履歴。

> 2026-10-08 TA01〜07: [ヒロイン5人×3種類のタイトル用アート比較](../asset_sources/title-art/heroine-concepts-v1-20261008/README.md)と各 `.prompt.txt`。採用済み立ち絵を第一参照、現在のタイトル絵を画風のみの参照とする。シーシャ案はメーカー実物写真を併用し、ハガルの上に閉じたHMD・その内側に炭、台の側面から手元へ1本のホースを描く。残りは本人らしい日常や趣味。15枚を独立した縦2:3の原画で保存し、タイトルへの採用は別途扱う。

> 2026-10-08 CI58〜61: 採用登場背景の修正は[アダム・はじめの修正版](../asset_sources/character-intros/adam-hajime-v4-20261008/README.md)を参照。[アダム](../asset_sources/character-intros/adam-hajime-v4-20261008/adam/prompt.txt)は葉・花を除いて二つのリンゴと蛇・古い書物風の装飾、[はじめ](../asset_sources/character-intros/adam-hajime-v4-20261008/hajime/prompt.txt)はシーシャ本体・ホース・マウスピースを除く。人物は再生成せず、文言は正本データを使う。

> 2026-10-08 CI57: 最新の検討案は[紫系のシンプルで抽象的な3案](../asset_sources/transitions/concepts-v5-minimal-purple-20261008/README.md)と[保存済みプロンプト](../asset_sources/transitions/concepts-v5-minimal-purple-20261008/prompt.txt)。紫と淡いラベンダーを中心に少数の曲線・面・余白へ絞り、一筆の煙／丸い波／余白が開くを比較。網点や細かな装飾の多い前案は履歴。今回は静止モックアップのみ。

> 2026-10-08 CI55／56: 最新の煙トランジション案は[紫系の3パターン](../asset_sources/transitions/concepts-v4-purple-smoke-20261008/README.md)と[保存済みプロンプト](../asset_sources/transitions/concepts-v4-purple-smoke-20261008/prompt.txt)。紫・ラベンダー・少量のピンクを統一配色にし、巻き込む渦／もくもく流れ／交差する煙リボンを比較。前の水色・コーラル案は履歴。今回も比較用の静止画像のみ。

> 2026-10-08 CI54: 最新の追加案は[抽象的な煙のポップな生成モックアップ](../asset_sources/transitions/concepts-v3-abstract-smoke-20261008/README.md)と[保存済みプロンプト](../asset_sources/transitions/concepts-v3-abstract-smoke-20261008/prompt.txt)。リアルな煙ではなく、水色・コーラル・クリームの大きな渦、太い輪郭、網点で動きを表す6コマ。今回は静止した比較用のみ。

> 2026-10-08 CI52／53: 最新トランジションは[大胆なグラフィック3案の生成モックアップ](../asset_sources/transitions/concepts-v2-persona-inspired-20261008/README.md)と[保存済みプロンプト](../asset_sources/transitions/concepts-v2-persona-inspired-20261008/prompt.txt)。オーナー指定で煙・黒・金への固定を撤回し、P4/P5のような大きな形・強い配色・斜めの構成を参考にする。黄ポップ／赤シャープ／青×ピンク。今回は比較ボードのみ。

> 2026-10-08 CI51: トランジション再制作の[生成モックアップ3案](../asset_sources/transitions/concepts-v1-20261008/README.md)と[保存済みプロンプト](../asset_sources/transitions/concepts-v1-20261008/prompt.txt)。煙の流れ／黒と金の斜め帯／炭の光と煙の輪。今回は比較ボードのみで、runtime素材ではない。個別の本番レイヤーは選択後に制作する。

> 2026-10-08 GP41: 現行remake/の温度計・操作ボタン・リフレッシュ・共通パネルは[4枚の生成指示](../asset_sources/ui/craft-luxury-20261008/prompts.json)と[素材・配線契約](../asset_sources/ui/craft-luxury-20261008/README.md)を参照。黒ガラス・真鍮・煙の刻印の静的素材。温度、最適温、予測、文字、使用回数はコードが表示する。

> 2026-10-09 CL06: 旧ブラウザ版（web/）向けの部品分割・配線表・ダミーUIの節を削除し、現行 `remake/` の作業台素材表へ置き換えた。旧版の生成プロンプトはgit履歴で参照できる。現行版の画像取り込み・制作手順は `CLAUDE.md`、`.claude/skills/` の該当スキル、`remake/README.md` を参照する。
>
> 2026-10-08の採用タイマーは[最終プロンプト](../asset_sources/ui/craft-focus-20261008/kitchen-timer-final-prompt.txt)と[素材・配線契約](../asset_sources/ui/craft-focus-20261008/README.md)を参照。白い100均風の本体、空の液晶、分／秒／スタート＆ストップ／リセットの4ボタン。文字と7セグ数字は実際の状態をコードで重ねる。下記の旧「数字は出さない」リングタイマー案は採用していない。

## 共通スタイル指針（全アセット冒頭に付ける）
```
スタイル: 薄暗いシーシャラウンジの空気。`assets/backgrounds/bg_eden_shop.png` 程度の2Dドット絵〜ピクセルペインター調で、輪郭・影・質感に細かいドット感を残す。リアル写真調や滑らかすぎる3D調は避ける。シーシャ台の先端は小さい凸型の金属ポストにし、凹んだカップ型・ボウル一体型・大きな先端パーツにしない。手・腕は細身で中性的、明るいピーチ系の同一肌色に統一する。
配色: 黒〜濃紫の闇に、琥珀／金（#f4d27a系）の暖色ネオンが差す。煙のかすみ。
視点: 作りパートは一人称（プレイヤーの手元を上から見下ろす角度）。
出力: PNG・透過指定のものは背景完全透過。@2x（実寸の2倍）で。指定なき限り 1280×720 基準。
NG: 文字/ロゴ/UI/数字の焼き込み（数値はゲーム側UIで出すので画像に入れない）、watermark。
```

---

## 分業の大原則（画像に焼き込まないもの）

| 担当 | 内容 |
|---|---|
| **画像（生成AI）** | 静物: 穴のあるボウル・保存タッパー・湿った赤い葉片・スケール・コンロ・炭・短いトング・一式の各部・手 |
| **コード（既実装）** | 葉の量と配置、アルミの**穴**（開けた角度と同位置）、炭の**熾き明滅・灰化**、ベースの**水・泡**、**煙**、注ぎの**葉粒**、火の粉、ゲージ/数値/文字 |

数値・文字・ゲージ・穴・煙は絶対に画像へ焼き込まない（ゲーム状態と食い違う）。

## 現行の作業台素材（`assets/ui/making/`・2026-10-09時点）

ゲームは `remake/data/manifest.json` に載ったファイルだけを読み、`craft/art.js` が中身の範囲（`makingBox`）基準で配置する。
同名で差し替えたら `python3 remake/tools/build_manifest.py` を実行する。新しいファイル名を足すときはコード側の参照も必要。

| ファイル | 使う場所 | 備考 |
|---|---|---|
| `bench_base.png` | `craft/worker.js` | はじめと作業台の広い静止モックアップ（`.bench-worker-stage`） |
| `bowl_empty_silicone.png`・`bowl_empty_clay.png`・`bowl_empty_phunnel.png` | `craft/art.js` | 空のハガル3種 |
| `bowl_packed_{airy,normal,firm}.png` | `craft/art.js` | ストレート型の詰め3段階 |
| `bowl_packed_phunnel_{airy,normal,firm}.png` | `craft/art.js` | ファンネル型の詰め3段階 |
| `foil_surface.png` | `craft/art.js` | アルミ面。穴はコードが描く |
| `coal_{cold,red,white,just}.png`・`coal_flat_{cold,red,white,just}.png` | `craft/heat.js`・`craft/art.js` | キューブ／フラット炭の4状態 |
| `stove_coil.png` | `craft/heat.js` | 電熱コンロ。明滅はコード |
| `hookah_tray.png`・`hookah_stem.png`・`hookah_base.png` | `craft/art.js`・`craft/worker.js` | 一台の受け皿・ステム・ガラスベース |
| `kitchen_timer.png` | `craft/timer.js` | 蒸らしのキッチンタイマー。数字は7セグをコードで描く |
| `smoke_thick.png` | `scenes/coldopen.js` | 冒頭の煙 |
| `ui_craft_panel.png`・`ui_craft_button.png`・`ui_refresh_button.png`・`ui_temperature_frame.png` | `craft/skin.js`・`craft/thermometer.js` | 制作UIの枠・ボタン・温度計（[生成指示](../asset_sources/ui/craft-luxury-20261008/prompts.json)） |

