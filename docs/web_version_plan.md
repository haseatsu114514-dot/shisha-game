# ブラウザ版 開発方針・ロードマップ

このファイルは「Claudeをメイン開発者にしてゲームを完成させる」ための
作業方針。新しいセッションを始めたら、まずこれを読むこと。

## 開発の原則

1. **データが唯一の正** — シナリオ・キャラ・フレーバー等は `data/` のJSONに置く。
   ブラウザ版 (`web/`) と Godot 版は同じJSONを読む。シナリオ追加はJSONに書く。
2. **ブラウザ版をメインの開発トラックにする** — Claudeはこの環境で
   ブラウザを起動して自動プレイ・スクリーンショット確認まで自走できる。
   Godot はこの環境で実行できないため、Godot 版は「演出強化版」として後追い。
3. **毎回テストを通す** — `web/test/playthrough.mjs`（優勝ルート）と
   `web/test/screenshots.mjs`（敗北→再挑戦）を変更のたびに実行する。
4. **演出（ジュース）を仕様として明示する** — 「動く」と「気持ちいい」は別タスク。
   新機能には必ず「SE・アニメーション・画面遷移演出」の項目を含めて依頼する。

## ユーザー（オーナー）との分業

| 担当 | 内容 |
|---|---|
| ユーザー | プレイして気になった点を箇条書きで送る／画像生成（キャラ・背景・CG）／方針決定 |
| Claude | 実装・演出・データ組み込み・自動テスト・バランス調整・アセット仕様書/プロンプト作成 |

### フィードバックの送り方（効くやつ）

- 「○○がしょぼい」だけでなく「どうなってほしいか」を1行添える
  （例:「ミックス画面、注ぐたびにボウルに色が溜まってほしい」）
- スクリーンショット添付があると最速
- 1メッセージに何件入れてもよい。Claudeが分解して全部対応する

## アセット差し替えパイプライン

1. Claude が `アセット差し替え進捗管理表.csv` を基に生成プロンプト一覧を作る
2. ユーザーが画像生成AIで作成し、所定のパス（`assets/backgrounds/` 等）に
   同名で上書き
3. Claude が `python3 web/build_data.py && python3 web/build_standalone.py` で
   再ビルド（立ち絵は透過余白を自動計測して表示を正規化する）

現状プレースホルダのままの主な背景: `bg_title` `bg_tournament_stage`
`bg_shop` `bg_home` `bg_naru_shop` `bg_adam_shop` `bg_street_day/night`
`bg_tonari_outside`

## 実装済み（第1章）

- 会話エンジン（dialogue JSON互換・タイプライター・立ち絵2スロット＋自動サイズ正規化）
- 日常ループ（7日×昼夜2行動・バイト・練習・キャラ訪問・スポット解禁制・日替わりカード）
- SMOKE CROWN CUP（機材選択→テーマ→12g配合→パッキング→アルミ穴あけ→炭起こし→
  配置→蒸らし→集中→引き→プレゼン→採点、作業台リグのリアルタイム可視化）
- 演出: WebAudio合成SE・BGM・判定スタンプ・煙/泡パーティクル・結果リビール
- 16:9固定ステージ（スマホ横向き対応）・localStorageセーブ・1ファイル配布ビルド

## 公開URL（プレイ・確認用）

- **開発中ブランチの最新（push 直後に反映・動作確認済み）**:
  `https://raw.githack.com/haseatsu114514-dot/shisha-game/<ブランチ名>/web/dist/shisha_ch1.html`
  - 初回アクセス時に raw.githack の確認ページが出る →「Open the page」を1タップ
- **安定版（未開通）**: https://haseatsu114514-dot.github.io/shisha-game/
  - `.github/workflows/deploy-pages.yml` が `web/dist/` を GitHub Pages へ配備
    （main と claude/** ブランチの push がトリガー）
  - ⚠️ **ユーザーの作業待ち**: Settings → Pages → Source を「GitHub Actions」に
    する必要がある（workflowのトークンでは初回有効化が403で失敗する。
    実行ログで確認済み）。有効化後に再push（空コミットでよい）すれば公開される
- jsDelivr / statically.io は HTML を text/plain で返すため使えない（検証済み）
- スマホは横向き推奨（縦だと回転ヒントが出る）。PC/スマホどちらも同じURLでOK

## 引き継ぎメモ（2026-06-10 時点の最新状態）

- 開発ブランチ: `claude/hopeful-ride-5rg3zg`（mainに未マージ。続きはここから）
- **タイトルロゴ**: ユーザー製ロゴ画像（黒地・墨筆風「水煙前線」）はチャット内
  画像のためファイル未着。暫定で `tools/make_title_logo.py` による生成ロゴを
  `assets/ui/ui_title_logo.png` に配置済み。**ユーザーからロゴPNGがファイル添付で
  届いたら同パスに上書き → `python3 web/build_data.py && python3 web/build_standalone.py`
  で反映**（黒背景つきならクロマキー等で透過化してから）
- **タイトルBGM**: `assets/audio/bgm/title.mp3`（ユーザー提供 Hookah Midnight Loop、
  64kbps）。スタンドアロンには先頭1.2MB（約150秒）を埋め込み
- **タイトルキャラ**: `TITLE_CHARA_POOL`（game.js）= tsumugi / sumi / packii から
  ランダム。切り抜き素材が増えたらプールに追加する
- **一人称視点**: はじめの立ち絵は出さない（engine.js `NO_PORTRAIT_SPEAKERS`）
- **チュートリアル**: opening後に1回だけ（`state.flags._tutorial_done`）。
  フローは game.js `TUTORIAL_FLOW` / ヒントは `TUTORIAL_TIPS`

## 2026-06-10 セッションで実装済み（後半）

- **タイトル画面 v2** — 墨ベースの背景＋漂う煙レイヤー、右側にカラフルな煙星雲と
  ランダムキャラ（つむぎ/スミ/パッキー、`TITLE_CHARA_POOL`）。ロゴ・メニューの
  時間差フェードイン、メニューホバーの金バー演出
- **タイトルBGM** — `assets/audio/bgm/title.mp3`（Hookah Midnight Loop)。
  自動再生ブロック時は最初のタップ/キーで再試行
- **チュートリアル** — オープニング後にスミさんの作業台で1回シーシャ作りを通し体験
  （`TUTORIAL_FLOW`: テーマ→ミックス→パック→穴あけ→炭起こし→配置→蒸らし→引き、
  各ステップにスミさんのアドバイス表示、結果に応じた講評＋技術/センス上昇）。
  `state.flags._tutorial_done` で1回のみ
- **一人称視点** — 主人公はじめの立ち絵は表示しない（`NO_PORTRAIT_SPEAKERS`）

## 2026-06-10 セッションで実装済み

1. **タイトル刷新** — 新ロゴ「水煙前線 -EN:CODE-」、左寄せ縦メニュー
   （NEW GAME / LOAD / GALLERY / CONFIG / EXIT）。GALLERY・CONFIG・EXIT は
   ダミーで disabled
2. **ダイアログUI刷新** — 紫の花飾りネームプレート、金縁＋四隅装飾のテキスト枠、
   右下に AUTO / SKIP / LOG / MENU ツール、左上に「⚓ 場所」HUD、
   右上に「🔥 Lv.X」HUD（5ステータス平均から算出）
3. **マップをタップ式に** — `#map-pins` にシールド型ピンを座標配置。
   ロックは鍵アイコン＋グレースケール。右下に金バナーの情報パネル、
   左上に Sakae 風の DAY カード（日数・行動・所持金）
4. **立ち絵の拡大** — 切り抜き素材は TARGET 88% / 最大 145% でバストアップ気味に。
   背景込み素材（naru/adam/minto/ageha/mashiro/ryuji）には `.portrait.bgfull`
   クラスを当て、上下グラデマスクで枠に収める
5. **演出** — ボタンに :active scale、選択肢に hover scale + shadow glow

## 次回セッションの修正タスク

1. **正式ロゴの差し替え** — ユーザーのロゴPNGがファイルで届き次第
   `assets/ui/ui_title_logo.png` に上書き（上の引き継ぎメモ参照）
2. **GitHub Pages 開通の確認** — ユーザーが Settings で有効化したら
   空コミットpushでデプロイし、URLの200を確認する
3. **背景込み立ち絵の本番素材** — bgfull リスト（naru/adam/minto/ageha/
   mashiro/ryuji）を切り抜き素材に差し替えれば大きく出せる。
   `tools/pixelize.py` で透過・トリム・パレット統一が可能
4. **マップピン座標の手調整** — `SPOT_LAYOUT` は仮配置。
   背景画像の建物に合わせて x/y を微調整したい
5. **LOG ウィンドウ** — `vn-log` ボタンは未実装（toast のみ）
6. **CONFIG / GALLERY** — タイトルメニューのダミーをアクティブ化
7. **タイトルBGMのループ調整** — スタンドアロン版は曲の途中でループが
   先頭に戻る（1.2MB切り出しのため）。気になるならフェード処理を入れる

## 画像生成パイプライン（統一感を出す方法）

スタイルの統一はプロンプトで頑張らず、**後処理スクリプトで揃える**:

1. 生成時は透過を要求しない。**単色背景（マゼンタ #FF00FF など）で生成**
2. `tools/pixelize.py`（次回作成）で一括処理:
   クロマキー透過 → 余白トリム → 共通グリッドに縮小 → 共通パレットに減色
   → ドットの粒度が全キャラ・全背景で自動的に揃う
3. キャラの同一性は「マスター1枚を作って、それを参照画像に表情差分を
   依頼する」方式（gpt-image-1 / NanoBanana の image-to-image）
4. ファイル名規約: `chr_{id}_{face}.png` / `bg_{place}_{time}.png` を厳守すれば
   ビルドスクリプトが自動で拾う



1. **大会の3ラウンド制** — `ch1_tournament_r1_end〜r3_end` の会話が未使用。
   ラウンド間で機材・配合を調整できると本家仕様に近づく
2. **敗者復活戦** — 2位以下の救済ルート（本家仕様: 枠1〜2）
3. **LIMEメッセージ（morning_phone）** — `data/lime_messages.json` が未使用。
   朝のスマホ演出は世界観の柱
4. **ショップ** — 機材・フレーバーの購入（`shop.gd` 相当）。お金の使い道を増やす
5. **好感度イベントの深掘り** — `ch1_events.json`（outing系）・confession.json
6. **第2章** — ch2_main.json 等のデータは既にある。エンジンはそのまま使える
7. **タイトル/大会ステージの本番アセット差し替え**

## ビルド・テストコマンド

```bash
python3 web/build_data.py          # data/ → web/js/data.js
python3 web/build_standalone.py    # → web/dist/shisha_ch1.html（要 pillow）
npx http-server -p 8123 &          # リポジトリルートで
node web/test/playthrough.mjs      # 通しプレイ（要 playwright）
node web/test/screenshots.mjs      # 敗北ルート＋スクショ
```
