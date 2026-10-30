# 画像生成プロンプト集（codex用）— シーシャ作りパート＋立ち絵

## アダム・EDENの色と左右（#711・現行指示）

2026-10-19のオーナー訂正「本人から見て正しい色がいいの」に従う。**本人の左右**と**見る側（画面）の左右**を区別し、次の対応を生成・修正指示へ明記する。

| 対象と左右の基準 | 左 | 右 |
|---|---|---|
| アダム本人から見た髪 | 緑のリンゴ色 | 赤のリンゴ色 |
| 正面のアダムを見た画面 | 赤 | 緑 |
| EDENのロゴ・背景・登場絵にある対のリンゴと対応する装飾色（画面基準） | 赤いリンゴ／赤 | 緑のリンゴ／緑 |

横顔・振り向きも髪色は本人の左右に固定し、画面の中央で機械的に二色へ分割しない。緑はリンゴの緑色とし、青色にしない。EDENの対の意匠は正面のアダムと同じ画面左＝赤・右＝緑に揃える。

修正は配色の左右が逆になっている部分に限定する。採用済みの顔・表情・髪型・ポーズ・衣装、店名・ラベル・文字、構図・リンゴの個数は保持し、対以外のリンゴや既に正しい配色は変更しない。画像全体を左右反転せず、人物や文字を反転させない。各画像の採用先と実物を照合し、修正が必要な画像とその表示用派生物だけを更新する。

この指示はCI30・CI58など過去の「画面左＝緑・右＝赤」の指定より優先する。以下の制作記録と `asset_sources/` 内の当時の生成指示は履歴として保持する。

> 2026-10-30 GB02: 心得の盤の画面デザイン案5パターン（漆と金／炭火の焼き網／煙の星図／店の木の盤／ネオンのラウンジ）の[Codex用プロンプト](../asset_sources/ui/growth-board-20261030/concepts/prompts.txt)。正本 `docs/stat-design/ADDENDUM-BOARD-LAYOUT.md`（3能力・能力ごとの盤・枝分かれの道）に合わせた方向決め用の見本で、文字は焼き込まない。選ばれた案でGB01の素材を作り直す。

> 2026-10-30 GB01: 心得の盤・火種・レベルアップの[デザイン方針と画像の契約](../asset_sources/ui/growth-board-20261030/README.md)と[Codex用プロンプト4枚](../asset_sources/ui/growth-board-20261030/prompts.txt)。火種（炭火の粒・万能＋5色のシート）、スキルアイコン14種のシート、盤の背景、中央の紋。輪・扇・線・ノードの丸・ゲージ・文字・状態の光はコードが描き、画像に焼き込まない。

> 2026-10-11 SF49〜56: 蒸らしの[シンプルな円形操作UI・生成指示・原画SHA・実画面](../asset_sources/steam-controls-simple-20261011/README.md)。青白い渦、細い金の照準と緑の輪、太い矢印の黒紫スティック台座をそれぞれ新規生成。精密は照準、スティックは灰色の大きい可動ノブで区別し、文字・オン／オフ・回転・可動ノブはコード側が表示する。以下のSF39〜44の素材は履歴として保持。

> 2026-10-11 SF39〜44: 蒸らしの[円形操作UIの生成指示・個別原画・SHA・表示検証](../asset_sources/steam-controls-20261011/README.md)。青白い渦のリフレッシュ、金の照準と緑の輪の精密モード、黒紫・金のスティック台座を別々の透過RGBAで制作。名前・ON/OFF・発光の変化・スティックのノブ移動・エネルギー回転はコードで制御する。参考画像の操作以外の要素は移さない。

> 2026-10-11 CV35〜46: 添付の完成形を採用してCONTINUEを刷新。[透過アトラス原画](../asset_sources/ui/continue-v4-20261010/neon-reference-20261011/neon-atlas-original.png)・[完全な生成指示](../asset_sources/ui/continue-v4-20261010/neon-reference-20261011/neon-atlas.prompt.txt)・[実参照とSHA256](../asset_sources/ui/continue-v4-20261010/neon-reference-20261011/generation.json)。指定の「コンティニューする？」と「GAME OVER」だけを静的文字として生成し、数字・ボタン文言・人物は焼き込まない。金／紫の文字なし鋭角フレームを生成し、機械的な切出しのみでPNGとWebPへ。以前の暗いステージを本編へ採用し、SVGのHUD・CSSの光と煙を重ねる。[完成画面と改善記録](../asset_sources/ui/continue-v4-20261010/README.md)。以下の古い採用状態は当時の記録。

> 2026-10-10 CV30・CV32: CONTINUEの比較版に[煙と金のGAME OVERロゴ](../asset_sources/ui/continue-v4-20261010/generated/game-over-smoke.png)と[暗いステージ背景](../asset_sources/ui/continue-v4-20261010/generated/backdrop-stage.png)を新規生成。[ロゴの完全な指示](../asset_sources/ui/continue-v4-20261010/generated/game-over-smoke.prompt.txt)・[背景の完全な指示](../asset_sources/ui/continue-v4-20261010/generated/backdrop-stage.prompt.txt)・[生成記録と実画面](../asset_sources/ui/continue-v4-20261010/README.md)。ロゴだけ指定文字を許可。背景の人物・台詞・数字はコードで表示する。紫背景と通常配置は本編の既定のまま、試用背景・上段ボタン・拡大する背面カウントはプレビューで比較。

> 2026-10-10 SF02: 蒸らし中に目を閉じて息を整えるはじめの[生成指示](../asset_sources/steam-focus-20261010/hajime-wait-prompt.txt)・[実参照と原画SHA](../asset_sources/steam-focus-20261010/generation.json)を保存。採用済みの帽子・パーカー・携帯中のマイチップと画風を維持し、シーシャ台やホースは人物画像へ追加しない。[実装画面・検品記録](../asset_sources/steam-focus-20261010/README.md)。

> 2026-10-10 SF22〜27: 精神世界はシンプルで抽象的な宇宙へ。[採用背景の生成指示](../asset_sources/steam-focus-20261010/world-prompt.txt)・[原画SHA](../asset_sources/steam-focus-20261010/world-generation.json)。暗い紫に薄い星雲と小さな星粒だけを描き、言葉・心拍・動く弾・リフレッシュの波はコードが描く。店内が残る前案は[不採用の記録](../asset_sources/steam-focus-20261010/rejected-lounge-generation.json)として保存し、ゲームへ接続しない。

> 2026-10-10 CV20: CONTINUE背景は紫の煙を採用。[原画](../asset_sources/ui/continue-v4-20261010/generated/backdrop-purple.png)・[画像編集の実行指示と参照SHA256](../asset_sources/ui/continue-v4-20261010/generated/backdrop-purple.json)・[日本語見出しと数字だけのカウントを含む実画面](../asset_sources/ui/continue-v4-20261010/README.md)を保存。煙の構図・質感を保ち、人物画像は加工しない。

> 2026-10-10 CV08〜11: CONTINUEの[原画・表示確認・ボタン3案](../asset_sources/ui/continue-v4-20261010/README.md)。ロゴ2種・可決の朱印・背景・ボタンの[完全な生成指示](../asset_sources/ui/continue-v4-20261010/generated/prompts.json)、暗いボタンを朱赤／オフホワイトへ変えた[修正指示](../asset_sources/ui/continue-v4-20261010/generated/buttons-revision.json)を保存。ユーザー指定のロゴとスタンプのみ文字入り。ボタンの文言・カウントはゲーム側で表示し、正規人物画像は加工しない。CV12〜13でボタン画像は不使用（文字だけ）、背景とロゴの赤は `remake/tools/build_continue_art.py` で藍〜青へ色替え（原画は保持）。

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

フレーバーの商品箱は現行採用画像のメーカー意匠を参照する。AFバニラの生成指示と参照画像は [`asset_sources/af-vanilla/prompt.txt`](../asset_sources/af-vanilla/prompt.txt)、原画・変換・検品は[制作資料](../asset_sources/af-vanilla/README.md)。黒箱・白い翼と独立した輪・味の筆帯は既存AFから継承し、既存10点の採用正本は変更しない。

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

