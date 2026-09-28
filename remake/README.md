# 水煙前線 -EN:CODE- リメイク版（remake/）

旧ブラウザ版（`web/`）とは**別バージョン**として、仕様書からゼロベースで作り直している新しい実装。
旧版は `web/` にそのまま残してあり、どちらも遊べる（セーブデータも別キー）。

- 旧版: `web/index.html`（約9,000行の `game.js` に機能が積み重なった版）
- **リメイク版: `remake/index.html`**（このフォルダ）

## 遊び方（ローカル）

```bash
# リポジトリのルートで
python3 -m http.server 8123
# → http://127.0.0.1:8123/remake/ を開く
```

`data/` と `assets/` を相対パス（`../data/`・`../assets/`）で直接読むので、
**ビルド不要**。file:// では fetch が通らないため、必ずローカルサーバー越しに開く。
開発ブランチの確認は raw.githack でも可:
`https://raw.githack.com/haseatsu114514-dot/shisha-game/<ブランチ名>/remake/index.html`

## 作り直しの方針（旧版との違い）

| 観点 | 旧版 `web/` | リメイク版 `remake/` |
|---|---|---|
| コード構成 | `game.js` 1ファイル約9,000行（512KB） | 責務ごとのESモジュール（1ファイル数百行まで） |
| データ | `build_data.py` で `data.js` に束ねる（要ビルド） | `data/*.json` を**実行時に直接読む**（台詞の正本は共有＝二重管理なし） |
| 進行の書き方 | コールバックの入れ子 | `async/await` で章の台本を上から読める形に |
| セーブ | 継ぎ足しの互換コード多数 | スキーマ版数つき `state` ＋ `migrate()` 1か所 |
| 大会 | 既存工程に仕様を後付け | `docs/master_spec.md` 第2部（穴あけ/炭焼き/FLAVOR TRIAL/10カウント）を**最初から**設計の軸に |
| 画面 | 固定16:9 | 固定16:9（1280×720論理座標）＋煙ワイプ遷移を共通化 |
| 見た目 | 墨×金＋LINE風スマホ＋看板型マップピン | **日常パートは旧版のデザインを踏襲**（オーナー指摘で揃えた・下記）。大会だけ黒×ネオン |

日常パートの見た目は旧版と同じ語彙に揃えている（「スマホとアイコンのセンスが悪くなった」の指摘を受けて）。
別の見た目を足すときもこの語彙から外さない:

- **HUD**: 左上に墨×金の DAY カード（角飾り）、右上に体力・★段階の五角形・アプリ風の LIME・MENU（`daily/hud.js`）
- **マップ**: 街マップ `bg_osu_map_day/night` ＋看板型ピン（テーマ色・白縁・しっぽ・面識のある相手は顔ドット絵）＋右下の墨×金パネル（`daily/map.js`）
- **LIME**: ノッチ付きの端末・緑のヘッダー・白と黄緑の吹き出し・明るい返信欄の丸ボタン（`daily/phone.js`）
- **報酬通知**: ステ色（`--stat-*`）の漢字バッジのカード／好感度は顔ドット絵＋ハート（`core/ui.js` の `gainCard`）
- 顔アイコンは `assets/ui/face_icons/`（48px ドット絵）。`assets/ui/ui_*.png` は仮の色板なので使わない

正史・仕様の正本は変わらない（`CLAUDE.md` / `docs/master_spec.md` / `brand/story_and_structure.md` / `data/*.json`）。
リメイク版はそれを読むだけで、既存の台詞や設定を書き換えない。
リメイク版の進行だけで使う短い場面（チュートリアルの前後・リハーサル・通い訪問の小会話など）は
`data/dialogue/remake_ch1.json` に置いてある（他の台詞と同じスキーマ・同じリンタで検査される。旧版は読まない）。

## フォルダ構成

```
remake/
  index.html
  css/            base.css（トークン・共通UI）/ vn.css / daily.css / craft.css（大会＝黒×ネオン）/ reel.css（スロット）/ extras.css（恋人・くじ・ギャラリー）
  js/
    main.js       起動（データ読込→タイトル）
    core/         util / data（ローダ・アセット解決）/ state（状態・セーブ）/ stats / audio / ui / stage
    vn/           会話エンジン（dialogue JSON 互換・autoWrap・立ち絵）
    daily/        日常パート（マップ・スポット・バイト・ショップ・くじ・スロット・恋人・ステータス・LIME）
    craft/        シーシャ作り（工程ミニゲーム・採点・FLAVOR TRIAL・結果発表）
    chapters/     章の台本（ch1.js）
    scenes/       タイトル・ギャラリー（見たCGは端末単位で記録＝はじめからやり直しても消えない）
  data/
    manifest.json    立ち絵の余白計測・アセット一覧（tools/build_manifest.py で生成）
    lover.json       恋人のLIME・デート・ちょい会いの文面
  tools/build_manifest.py
  test/playthrough.mjs   第1章の通しテスト（優勝ルート／敗北ルート）
```

立ち絵・背景・作業台の素材（`assets/ui/making/`）を追加・差し替えたら `python3 remake/tools/build_manifest.py` を1回実行する
（Pillow・numpy・scipy が必要）。立ち絵の余白と足元位置、作業台素材の中身の範囲（bbox）を測って
`remake/data/manifest.json` に書き出す。作業台の一台（ガラス台→ステム→トレイ→ボウル→アルミ→炭）は
この実測値から位置を計算して組むので、素材を差し替えても配置がずれない。それ以外の変更にビルドは要らない。
文字だけの仮置きCG（無地に説明文の画像）は一覧に載せない＝場面では飛ばし、ギャラリーにも出さない。本物の絵に差し替えて再実行すれば出る。

## 第1章の流れ（実装済み）

1. タイトル → コールドオープン（`ch1_cold_open`）→ 章タイトル → `ch1_opening`
2. チュートリアル: スミさんの手本つきで一台を通しで作る → `ch1_tutorial_oneesan`
3. 日常 DAY1〜14（1日2行動・昼/夜）
   - tonari（お客さんとして＝つむぎ／バイト＝接客イベント＋給料／スミさんと話す／自主練）
   - KEMURIKUSA（なる）・EDEN（アダム）・PEPPERMINT（みんと）: 固有会話を順に消化
   - Dr.fookah（フレーバー・機材の売買／2階＝凛）・カフェ・観音堂・チョイザップ・C.STATION・家に帰る
   - 体力・所持金・ステ（★表示のみ・章ソフトキャップ）・好感度（5段階）・LIME
   - 夜の固定イベント（DAY2/4/5/7/9/10/12/13/14）。DAY13は前日リハーサル（通し）
   - **MOKUMOKUパッキー**（日常スロット・`daily/reel.js`）: 行動を1回使うたびに1回転。結果と報酬（直前の行動で伸びたステへの上乗せ）は
     行動した瞬間に確定し、演出は次にマップを開いたときマップ左下の筐体で見せる。抽選（役・確率・天井・裏確変）は旧版 `web/js/reel.js` と同一、
     仕様の正典は `docs/pakki_slot_spec.md`。初回だけパッキーのアプリ説明
   - **シーシャくじ**（Dr.fookah の「シーシャくじ」タブ・`daily/kuji.js`）: `data/kuji.json` のボックス制。箱の並びは作った時点で保存＝ロードで変わらない。
     景品の小物は「売る」タブで換金できる
   - **恋人**（`daily/romance.js`）: 好感度MAX（つむぎ・みんと・凛）→ 告白するか選ぶ → `confession.json` で付き合う／友達のまま。
     恋人の絆（Lv1〜5）はデート（LIMEの誘い）・ちょい会い（マップの「恋人に会いに行く」＝行動を使わない・1日1回）・恋人のLIMEでだけ深まり、
     Lvが上がると `lover_events.json` の節目イベント。恋人のLIME・デートの文面は `remake/data/lover.json`（旧版の定数から抽出）
   - **修羅場**: 恋人が2人以上いると、大会当日の会場ロビーで鉢合わせる（`remake_shuraba_*`）
4. DAY15 SMOKE CROWN CUP（4人一斉・1試合）
   - R1 組み立て: 機材 → コンセプト2つ → 配合（ミント2g以上）→ 詰め → HOLE RHYTHM → HEAT IGNITION → 炭配置 → 蒸らし（雑念弾幕）
   - R2 吸い出し・提供（温度合わせ）／R3 熱管理
   - FLAVOR TRIAL（コンセプト×アピールポイントを審査員のザワザワにぶつける）
   - 審査 → RESULT 10 COUNT（プチュン＝1位確定／パリン＝敗北）→ 南雲の持ち点10一括投入
   - 優勝: 表彰 → `ch1_tournament_after` → スミさんの採点表LIME → `ch1_naru_promise` → 第1章クリア
   - 敗北: `ch1_tournament_defeat` → GAME OVER（大会の頭から再挑戦／タイトルへ）

## テスト

```bash
python3 -m http.server 8123 &
node remake/test/playthrough.mjs            # 優勝ルート＋敗北ルート
```

テスト用フック: `window.__remake`（state参照・ミニゲーム自動解決）。
開発用ジャンプ: ブラウザのコンソールで `__remake.dev.tournament()`（大会当日から）／`__remake.dev.drill("heat")`（ドリル単体）。※今のセーブを上書きする。UIの見た目を変えても壊れないよう、
テストはこのフックと `data-test` 属性だけに依存する。

## まだ無いもの（次の作業候補）

- 第2章以降（章の台本 `chapters/ch2.js` を足す形で拡張できる構造にしてある）
- 恋人になってからの章をまたぐ要素（ch4 ドバイに来る／来ない・エンディングの修羅場）は第2章以降と一緒に
- 占い師（旧版の路上占い）・家シーシャ・レシピ帳の画面
- BGMの細かい出し分け（現状は場面ごとの基本曲のみ）
