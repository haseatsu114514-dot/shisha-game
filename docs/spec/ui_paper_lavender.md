# UIテーマ: 紙とラベンダー（既定）と DS風レイアウト

> 2026-11-02 に `remake/README.md` から移した。新しい節が上。実装は `remake/css/`・`remake/js/`、採用記録は `docs/owner_requests.md`（CUI・DUI・GUI）。

## 第1〜2章の斧投げ・TRPG・くじ・ギャラリーも紙とラベンダーへ

既定の `paper` テーマでは、斧投げの入口・得点・操作・レッスン・ルールと、TRPGの本棚・部活・会話・座席・相談・ダイスを日常の紙×ラベンダー＋琥珀へ揃える。斧投げは `css/axe-throw.css`、TRPGは `css/trpg-paper.css`（`trpg.css` から読込）で上書きし、他の6テーマには適用しない。単独の斧投げ・TRPG試遊ページも同じ紙テーマを使い、プレイヤーの設定は書き換えない。

- 既存の `img/ui/paper/` の板とラベンダーを再利用。素材の新規生成・追加はない。的・部屋・選択肢の絵や、力の適正帯の緑とキルショットの青は維持する。
- `ui-paper.css` でくじの結果・ギャラリーのタブと操作帯も揃える。写真・漫画・動画の鑑賞面とスロットの実機は既存の表現を保つ。
- 操作領域・当たり判定・ルール・料金・報酬・台詞・セーブは維持。2d20の数字は旧ドット用の3列から1列へ戻して中央へ置き、盛り上がりの勢いが無い時に出ていた `null` を除く。縮小されるダイス窓の数字は18px・説明は12px以上に保ち、スクロール端でボタンが欠けない余白を設ける。本編のTRPG入口は従来どおり横向き案内を出す。
- シーシャ制作・大会・開発中の心得の盤はこの変更の対象外。TRPGの静的書き出しにも紙のCSSと素材を含め、LFSポインタを実体へ解決する。
- 検証入口: `node tools/ci/run.mjs --kind quick`、`--kind browser --suites axe-throw,trpg,play-spots`、`node remake/test/browser/gallery.mjs`、`shop_ui.mjs`。TRPGの卓テストで、実際の2d20と数字の一致・数字の中央位置・盛り上がりの余計な文字なしを確認する。
- 実画面: [斧投げ・PC](../qa/minigames-paper/axe-play.webp)／[斧投げ・縦](../qa/minigames-paper/axe-portrait.webp)／[ダイス・PC](../qa/minigames-paper/trpg-dice.webp)／[ダイス・縦](../qa/minigames-paper/trpg-dice-portrait.webp)／[部活](../qa/minigames-paper/trpg-club.webp)／[ギャラリー](../qa/minigames-paper/gallery.webp)／[くじ](../qa/minigames-paper/kuji.webp)。素材の採用記録ではなく、実装後の表示確認用の画像。

## 2026-11-01 制作（シーシャ作り）の紫×白＋金

シーシャ作りパート（作業台）は、日常の白×紫＋金から紫を主役にした夜の配色。現行のレイアウト・工程・操作・ゲーム性は維持する。別途検討中の新しい制作UIモックは反映しない。

- `css/craft-paper.css` を `craft.css`・`steam.css`・`craft-header.css`・`craft-landscape.css` の後に読み、色・面・縁だけを上書きする（寸法・座標・操作判定は変えない）。練習・レッスン・大会のどのモードでも同じ面。`data-ui-theme` には依存しない（制作画面は常にこの配色）。
- 既存素材 `img/ui/craft-paper/`（原画 `assets/ui/craft-paper/`、生成記録 `asset_sources/ui/craft-paper-20261031/`、ビルド `python3 remake/tools/build_ui_skin.py`）を再利用。左右の板・結果カードは紫のグラデーション、壁紙・天板は既存素材に紫を重ねる。通常ボタンと温度計の白、決定操作の金を残す。紫の面では白い本文・薄いラベンダーの補足、白いボタンでは暗い紫の文字を使う。温度の青・橙、体調や成否の緑・赤は意味を維持し、暗い面で読める明るさに調整する。旧素材（`img/ui/making/ui_*`）と `skin.js` の読み込みは維持。新規画像は追加しない。
- 板に `filter` を付けない（DSで `position: fixed` にしている温度計の台座・外観ボタンが板の中へ閉じ込められる）。影は `box-shadow`。板の縁は1pxのままで、絵は余白と外側に描く（中身の寸法を変えない）。
- 工程ごとの舞台（CUI05・通常表示のみ）: 炭焼き・調整は石の天板、穴あけ・蒸らし時間はリネンマット、配合と詰め方はボウルの窓だけマット。素材に紫を重ね、文字は紫のカードや札に載せる。調整の炭の交換は炭の絵のカード（既存の `img/ui/making/coal_*.webp`）。
- 温度計の管は `--thermo-inset`（上下対称）で置く。`thermometer.js` が矢印・目印を同じ変数で置くため、ずらすと矢印が判定とずれる。
- ボタンの主・ホバー・選択中にも縁の太さを明示する（`craft.css` の縁1pxが勝つとホバーで高さが変わり、ボタンが揺れる）。
- 大会の演出レイヤー（入場・中間発表・南雲カットイン・最終順位表・RESULT 10 COUNT・実況コメント）は大会リメイク側で決めるため未変更。
- 検証: `node tools/ci/run.mjs --kind browser --suites craft-materials,ds-packing,heat-feedback,mix-temperature,steam-attack,steam-forecast,craft-scenes,flavor-expression,loading-gate,ch1-tournament,game-layout,water-pour`、`craft-preview.html` と本編の配合→調整までの各工程を 1280×720・844×390・390×844（DS）で撮影して確認。

## 2026-10-31 紙とラベンダーのUI（既定のUIテーマ）

日常パートのUIを Dr.fookah の紙×ラベンダー＋琥珀へ統一する方針（`docs/owner_requests.md` DUI01〜11、[設計](../design/daily-ui-menu-design.md)）の第一段。

- 生成した紙の板・会話窓・ラベンダーの面を UIテーマ `paper` として追加し、既定にした（`core/ui-theme.js`・`core/state.js`）。既存の6テーマは設定から選べる。端末に保存済みの選択はそのまま。
- `css/ui-paper.css`: 紙の面（モーダル・HUD・地図の案内・tonariの選択・ログ・トースト）の中だけ文字色の変数を墨へ切り替える。場面の上に直接書く文字の色は変えない。会話窓は共通の組版（名前札・操作札・本文2行・左右96px）を保ち、絵だけを差し替える。2画面表示は窓の大きさが違うので、原画を引き伸ばさず紙の面と線で描く。
- 素材: 原画 `asset_sources/ui/paper-20261031/`、採用 `assets/ui/paper/`、実行時 `img/ui/paper/`（`python3 remake/tools/build_ui_skin.py`）。
- 次の段階: 全画面4タブのMENU、HUDの板（行動回数なし・五角形ボタン廃止）、地図の看板A、STATUS UP の通知を使わない成長表示。大会パートは別途リメイク中のため対象外。
- 検証: `node remake/test/browser/ui_themes.mjs`（paper を含む7テーマ）、`conversation_ui.mjs`、`game_layout.mjs`、`hud_fortune.mjs`、`ds_overlay_layers.mjs`、`node remake/test/typography_css.mjs`。

## 2026-10-30 DS風（縦持ち・上下2画面）の見直し

スマホ縦 390×844・320×568 の実画面で見つかった切れ・重なり・極小文字を、DS専用CSS（`css/game-ds.css`・`css/title-ds.css`・`css/vn-lounge.css` のDS節）だけで直した。通常版・ゲーム進行・保存は変えていない。

- 会話: AUTO／SKIP／LOG／用語／設定を上画面の右上から**下画面のタッチバー**へ移し、立ち絵の顔を覆わない。3択が下画面に収まり、320×568でも本文2行と選択肢が重ならない。
- 地図: 行き先カードの店名を2行まで折り返し（「KEMURIKU…」で切らない）、4段目が案内パネルに隠れない。
- 制作: 工程バーの文字を重ねない（絵は今の工程だけ）。「外観を選ぶ」を小さな札にして中身を下げる。配合の決定ボタンの文字を切らない。水入れは縮小せず下画面の幅で組む。「3・2・1」のカウントは上画面の中に出す。師匠コメントは小さく。
- タイトル: 縦長の原画を上画面いっぱいに置き、同じ絵のぼかしを後ろに敷かない。ロゴは左上の暗い帯、設定の入口はヒンジ（本編の「表示」と同じ）。低い端末では章名の行を詰める。
- ヒンジの「表示」ボタンを小さくし、画面の角に食い込ませない。

検証: `node remake/test/browser/game_layout.mjs`（操作バーの位置の期待値を更新）、`title_layout.mjs`、`ds_packing.mjs`、`ds_overlay_layers.mjs`、`hud_fortune.mjs`、`conversation_ui.mjs`。比較画像は [docs/qa/ds-portrait-20261030/](../qa/ds-portrait-20261030/README.md)。地図の帯はぼかした地図で埋め、場面転換はDSでは全体の暗転、縮小工程の炭は当たり判定だけ広げる（同日決定、理由は同READMEの表）。
