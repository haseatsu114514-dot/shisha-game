# 穴あけの初期配置・位置合わせ・完了時停止（#704 / #701 元16〜18）

開始main: `5b2b7818ff2596239ca5dd6dbf1e2a2a82af92fb`。
WORKER: `codex-701-holes-20261019-01`。予約コメントの実行は失敗し、オーナーが今回限りの予約省略を明示選択したため着手。予約取得済みとは扱わない。

## 変更

- 新しい一台の初期テンプレートは既存の `outer12-middle12` のみ。外周12＋中周12で、ユーザーの「内側12」に対応する既存の二重リング。新しいリングや穴数・判定窓・熱性能は追加しない。
- `outer24` は定義を残し、`_hole_outer24_unlocked` の明示フラグがあれば選択可。新しい解禁イベント・日付・好感度は設定していない。保存済みセッションの `availableHoleTemplateIds` と `holeTemplateId` は優先し、旧一台の選択を消さない。フラグによる将来テンプレートの既存解禁方式を維持。
- 採用済みアルミ画像の下側の折り返し縁を除いた上面に合わせ、目印・円・穴・動く光を共通平面で高さの3%上へ。プレビューも実操作も同じ中心を使う。非対称化や判定座標の変更はしない。
- 全穴が開いた最後の入力で経過・時間評価・バーを固定。外周だけ完成した段階では残りのリングへ進め、時間は継続。時間切れでも未完成を自動完了にしない。
- 「この配置で仕上げる」と結果の「次へ」を残す。全穴完了後に待っても時間切れによる自動送りはしない。

## 前後画像

1280×720 Chromiumと844×390タッチエミュレーション。同じ初期一台のプレビューを保存。画像の形式変換だけで切り貼り・加筆はしていない。

| 条件 | 変更前 | 変更後 |
|---|---|---|
| PC | [before](before-pc.webp) | [after](after-pc.webp) |
| 横タッチ | [before](before-touch.webp) | [after](after-touch.webp) |

## 検証

- `node --experimental-vm-modules remake/test/foil_holes.mjs`: PASS。両テンプレート・新規初期/フラグ解禁・外周だけでは終了不可・全穴後60秒待機でもバー不変/結果未確定・時間切れ後の明示確認・GOOD/BAD自動操作・密度/熱応答を検査。
- `remake/test/craft_templates_timing.mjs`: PC/横タッチ/縦の3条件PASS。初期1選択、保存済み旧セッションの24穴選択、12+12への実切替・キーボード開始・結果まで検査。既存の炭タイミング検査も保持。
- `remake/test/browser/craft_materials.mjs`: PC/タッチの実穴入力で、3%上の共通中心、全24目印、25実穴（空打ちを含む）、全穴後60秒のバー固定・結果未確定、仕上げ後の結果確認を検査。固定40ms待機を実フレーム反映待ちへ置換し、採点目印と光の座標assertを保持。
- Git Safety / agent docs / diff check: PASS。

## CIで見つかった既存セレクタの追補

初稿のChapter 1 presentation CI run39216430621は、`first_brew.mjs` が旧DOMの `.foil > .foil-cursor` を探して停止した。共通平面を挟んだ本番DOMに合わせ `.foil-target-plane > .foil-cursor` へ2か所変更し、ヘルプ中の光/入力停止assertをすべて維持。`CASE_FILTER=holes-and-steam-help` の実ブラウザ再検証はPASS。本番の停止処理や待機時間を変えて回避していない。

物理スマホ/Safari、公開版での動作とNEW GAMEからの全章通しは未実施。GitHub ActionsとPRレビューの最終結果はPRへ記録する。
