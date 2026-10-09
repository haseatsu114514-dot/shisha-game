# 制作成功カットイン：全画面と主人公エリア中央

漫画コマ案（PR #232）を基準に、実際の制作画面で配置・動き・一時停止を比べるための試作。
カットインは比較ツールから手動再生する。本編の成功条件への自動接続は含まない。
コンロのPNGと表示用WebP、左下の実況欄の縮小・自主練の心の声・パッキー実況の移動は、このブランチの本編用素材・UIにも反映した。

## 最新の比較

[主人公エリア中央](review/center-desktop.png)／[全画面](review/full-desktop.png)／[停止と再開の比較動画](review/center-and-full-pause.mp4)。
PC1280×720、スマートフォン横844×390・縦390×844の確認画面は `review/` に保存。

| 案 | 表示場所 | 時間 | 制作の時間 |
|---|---|---|---|
| D：全画面 | 制作画面いっぱいに大きく | 1.1秒 | 炭・穴あけ・弾幕・針を止め、続きから再開 |
| E：主人公エリア中央 | 左の作業風景の中央 | 1.1秒 | 同じく停止。右の操作画面・左下の実況は見える |
| A：左枠の下に2コマ | 作業風景の下 | 0.74秒 | 継続 |
| B：左端から顔だけ | 作業風景の左端 | 0.62秒 | 継続 |
| C：左枠を漫画に切替 | 左の作業風景の中央 | 0.96秒 | 継続 |

D／Eでは新しい操作を演出中に受け付けず、押していたキー／パッドを離す操作は届く。
表示を消すと、一時停止していた作業画面のアニメーションも再開する。
説明・体調を開いているときは表示を抑止する。静止比較は解除まで停止する。
動きを減らす設定では、移動・拡大を使わずフェードする。

## プレビューを開く

リポジトリルートから以下を実行する。

```sh
python3 remake/tools/serve_preview.py --port 8125
```

`http://127.0.0.1:8125/tools/browser/craft_cutin_preview.html` をブラウザで開く。
初期表示は大会。工程・場面・出し方を選び、「カットインを再生」で試す。
「静止で比較」は保持／解除、「工程をやり直す」は制作を最初から開き直す。
ゲームのセーブは書き込まない。4工程の手元絵は比較用に炭焼き素材を共用する。

左下の実況は**大会なら審査員／パッキー、チュートリアルならスミさん、自主練ならはじめの心の声**。
以前の比較プレビューは、コメントを出さない旧仕様の自主練から開いていたため、この欄が出ていなかった。
調査時の公開版の `audience.js` とmainの実装は一致しており、マージ漏れはなかった。
その後の追加指示を受けて、自主練のコメントと大会実況の共通欄を実装した。

## 左下の実況欄

高さ140→112→88px、顔枠100→56px、人物画像300→200px、通常のセリフ16→13px。
結果の評価・セリフと人物名も合わせて縮小。フッターの実況欄と、そのための下部余白は撤去した。
大会中の既存の実況をパッキー本人の顔・名前で左下に表示し、次の作業反応や結果では担当審査員へ戻す。
自主練の穴あけ・炭焼き・蒸らし・吸い出しでは、はじめの作業中の内心と3段階の結果コメントを表示する。
心の声の正本は `data/dialogue/craft_inner_voice.json`。途中は成績記号を出さず、終了後の◎／○／△は既存の評価に従う。
表示例：[パッキー](review/audience/pakki-heat-desktop.png)／[審査員と炭焼き結果](review/audience/judges-heat-desktop.png)／[はじめの心の声](review/audience/inner-heat-desktop.png)。
修正前の画面は `references/center-desktop-before-audience-size.png`。

## 素材の修正

- `comic-pair.png`：コンロの中央にあった突起を取り除き、平らな電熱コイルへ修正。
- `stove-on.png`：つまみの目印を真下へ。斜めにした案・長い中央線の案は不採用。
  元の視点と縦の溝を保ち、下側の短い矩形に修正した。
- `assets/ui/making/stove_coil.png` は生成原画とバイト一致。
  `remake/data/manifest.json` のbboxと `remake/img/ui/making/stove_coil.webp` を再生成済み。
- 原画は透過PNG。文字は画像へ焼き込まず、比較用CSSで `EXCELLENT` を重ねる。
- 生成指示は `pair-prompt.txt`／`face-prompt.txt`／`stove-fix-prompt.txt`／`dial-fix-prompt.txt`。
  修正前・不採用案は `references/` に保持。

## 検証と確認資料

`tools/browser/craft_cutin_preview_verify.cjs` は実ゲームで時計・操作・停止／再開と配置を確認し、
`review/browser-validation.json` とPC・スマートフォンの静止画を保存する。
`art-validation.json` は原画・透明度・SHA・修正前後の目印のピクセル範囲、
`integration-validation.json` は採用先と実況欄の場面別条件を記録する。

制作UIの `craft_focus.mjs` で、パッキーの本文・話者・審査員への復帰、未紹介名の保持、
自主練4工程の途中の内心・3段階の結果、PC／スマートフォンのレイアウトを確認する。
`steam_refresh.mjs`／`stamina_condition.mjs`／`data_loading.mjs`／`playthrough.mjs`も通過。
第1章の新規開始・セーブ／ロード・日常・大会の敗北→再挑戦→クリアを確認。
最終確認記録は `review/test-validation.json`、通しログは `review/playthrough.log`。

確認結果：4工程×2停止案で、約0.3秒の実時間が経過してもゲーム時刻と状態の変化は0。
解除後の時刻の飛びは0.6〜1.0ms。1.1秒の自動演出は1100.9msを除外し、自動で再開した。
実マウスとSpaceの入力抑止・解除後のボタン入力、説明との競合抑止、
押していたキー／パッドを停止中に離せること、再起動で停止が残らないことを確認。
既存セーブは保持、ブラウザエラー0。

静止画は実際に炭をPERFECTで取り出した画面から撮影し、成功時の金色フラッシュが終わった後に比較する。
動画は吸い出しの針が動いている状態でE／Dを手動再生し、停止と再開を見せる。
再撮影は `tools/browser/craft_cutin_preview_capture.cjs`（Playwrightのffmpegとシステムffmpegが必要）。

```sh
CUTIN_PREVIEW_URL=http://127.0.0.1:8125/tools/browser/craft_cutin_preview.html \
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node tools/browser/craft_cutin_preview_verify.cjs
```

この時計の差し替えは比較用iframeにだけ入る。本編のセーブ・採点・熱管理コードは変更していない。
本編採用時には、工程完了など表示する成功場面と頻度を決めてから共通の停止処理へ接続する。
