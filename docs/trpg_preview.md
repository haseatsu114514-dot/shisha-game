# 小さな卓の冒険・10分TRPG集

Issue #484 / PR #487。最後まで遊べる短編2本を、本棚から選ぶミニゲーム。
公開プレビュー: https://shisha-trpg-ordinary-484.briskdill17.chatgpt.site （所有者限定）。

## 遊ぶ

```bash
python3 remake/tools/serve_preview.py --port 8123
```

本編 `http://127.0.0.1:8123/remake/` のタイトルから **PLAY ROOM / 遊び場** を開く。
セーブなしでも2本を選べる無料プレイ。読了・中断後は本棚、そこからタイトルへ戻る。
現在の日常の時間・費用・体力・報酬・絆・読了記録は変えない。途中の内容は保存しない。
タイトルBGMは卓を開く時に止め、タイトルへ戻る時に再開する。卓の音は初期OFF。

独立プレビューは `http://127.0.0.1:8123/remake/trpg-preview.html` を開く。
PCはクリックとキーボード、タッチ端末は横持ち。会話はEnter/Space、ボタンはTab/Enter。

本棚で2本を選択。表紙から戻る、途中中断、同じ物語の再挑戦に対応。
音は初期OFF。「音 ON」で小さな環境音と卓の効果音を有効にする。設定はページ内のメモリだけで保持。

### 世界一普通の一台

GMはスミさん、PLははじめ・なる・つむぎ。架空の小冊子の作者は汐見しお。
物語は港町ノーラの茶房「波止場の灯」。PLが演じるのはフィン・ニコ・ルカ、
旅人はオル。本編人物・店舗を冒険の登場人物にしていない。

1. 旅人の話を聞く（2d6）。
2. 部屋の6箇所を調査し、3つ以上の手がかりから仮説を立てる。仲間への相談とメモ再読は自由。
3. 香りと席を組み合わせ、一台を準備する（2d6）。
4. 声のかけ方を選び、提供する（2d6）。結末と卓の振り返りを読む。

どの判定も基本＋1。10以上は成功、7〜9はひと手間、6以下はハプニング。
失敗しても次の場面へ進む。共有の連携札は2枚、切り札は一人一度。
なるは準備＋2、つむぎは提供＋2、はじめは結果を見てサイコロ1個を振り直す。
切り札を使うたび連携札1枚を使うため、全員分を一度に使うことはできない。

旅人の事情は静かな休息・懐かしい時間・会話の3種類。提案は3×3×3通り。
結末は「雨音」「帰り道」「話の始まり」「一緒に見つける」の4種類。
香りに加えて席・声かけが結果に効く。判定の出来は途中の出来事を変える。
### サメは閉店を待たない

GMはサメちゃん、PLははじめ・なる・つむぎ。作中の架空の作者が書いたサメ映画風台本。
6つの調査地点のうち最大4箇所を選ぶ。3つ以上の手がかりで習性を見立て、道具・経路・最後の作戦を組み合わせる。
新しい場所の調査で危機＋1、判定は成功＋0／ひと手間＋1／ハプニング＋2、最大6。
危機5以上は卓の振り返りも変わる。再読・相談は危機も回数も使わない。見立てが合えば仕掛け判定に＋1。
香り・振動・光を追う3種類の怪物、4結末。どの作戦・出目でも全員生還し、先へ進める。
怪物の習性は架空の映画設定。現実のサメの生態説明ではない。ゴア表現やジャンプスケアは入れない。

両作とも各約10分の想定で、実時間の制限はない。読み込み待ちや考える時間を減点しない。
ページ更新後は本棚またはURLで指定した表紙から始まる。本編セーブ・手動枠・sessionStorageを読み書きしない。

## 正本と構成

- `data/trpg_catalog.json`: シナリオIDと正本ファイル、独立人物profileの参照。
- `data/dialogue/trpg_ordinary.json` / `trpg_shark.json`: 物語・調査・ルール・選択肢・選択への返答・台詞。
  本編の `loadAll()` に登録しておらず、TRPGの開始時だけ読む。
- `remake/js/trpg/session.js`: DOM・ストレージに依存しない、seed付きのセッション処理。
- `remake/js/trpg/view.js`: 会話、部屋の調査、メモ、切り札、サイコロ、結末の表示。
- `remake/js/trpg/index.js`: 本編接続用の呼び出し窓。
- `remake/js/trpg/preview.js` / `remake/trpg-preview.html`: 独立起動と画面縮尺。
- `remake/js/trpg/library.js`: 2本の選択。本編人物のID・表示名は共有の正本を参照。
- `remake/js/trpg/collection.js`: 本編・独立版で共通の本棚、読み込み再試行、中断と再挑戦の管理。
- `remake/js/scenes/trpg-room.js`: タイトルからの無料プレイ。画面撤去・ページ離脱で卓と音を破棄する。
  履歴キャッシュからの復帰ではタイトルへ戻す。
- `remake/js/trpg/presentation.js`: 正本人物とmanifestから表示名・立ち絵位置を導出。
- `remake/js/trpg/audio.js`: 外部音源を使わない独自WebAudioの雨・波・卓の効果音。
- `assets/backgrounds/trpg_*_room.png`: 生成背景2枚の原画。画面では同寸法のWebPを使用。
  生成指示・原画と配信画像のハッシュ・目視QAは `asset_sources/trpg-duo/generation.json`。
- `remake/css/trpg.css`: 1280×720ステージ内に限定した表示。

人物設定と採用済み立ち絵の正本を直接参照。顔位置は既存manifestのh/b/aspectで合わせる。
本編キャラ設定・立ち絵・BGMを置換していない。短編の作者・港町・役名は作品固有設定。

## 呼び出す

呼び出し側のCSSに `remake/css/trpg.css` を含め、空の画面領域を渡す。

```js
import { runTrpg } from "./trpg/index.js";

const result = await runTrpg(host, {
  scenarioId: "shark-last-order", // "ordinary-cup" が既定
  signal: abortController.signal,
});
if (!result.cancelled) {
  // scenarioId、ending、variant、plan、hypothesis、clues、checksなどを返す。
  // 解放条件・行動消費・報酬・本編の記録は、採用後に呼び出し側で扱う。
}
```

`runTrpg()` は卓を片付けた時に解決し、画面・タイマー・イベント・中断リスナー・所有する音声を除去する。
再挑戦ボタンでは `replayRequested: true` を添える。再開の可否と本編の費用は呼び出し側が決める。
ロード中もAbortでキャンセルし、事前Abortならリソースを読まない。単体呼び出しは指定した1本だけ読む。
中断は `{ cancelled: true, scenarioId }`。単体の処理から本編の状態モジュールを読み込まない。
`mountTrpg()` には `finished`、読み取り用の `snapshot()`、`destroy()` がある。

2本の本棚ごと組み込む場合は `mountTrpgCollection(host, { signal, closable: true, closeLabel })`
を `trpg/collection.js` から呼ぶ。`ready` は初回読み込み後、`finished` は閉じた後に解決する。
失敗時は画面内で再試行でき、読み込み中も閉じられる。`snapshot()` と `audioSnapshot()` は読み取り専用。

QA用: `?scenario=ordinary-cup&seed=9&traveler=quiet`、`traveler=home`、`traveler=company`。
サメ編は `?scenario=shark-last-order&seed=9&traveler=scent`、`traveler=vibration`、`traveler=light`。
通常起動では事情と出目をseedから選ぶ。条件をURLで固定でき、再現に使える。
`window.__trpg.snapshot()` は独立プレビューの読み取り窓。

## 検証

```bash
node --test remake/test/trpg.mjs
python3 tools/lint_dialogue.py trpg_
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/trpg.mjs
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/trpg_main.mjs
```

ブラウザの既定URLは8123。`BASE_URL`・`ARTIFACT_DIR`で変更できる。
PlaywrightとChromiumが必要。CIは `.github/workflows/trpg-preview.yml`。

純関数11ケースは全486提案組み合わせ、8結末、全判定段階、二重操作、
切り札と連携札、調査制限と危機、見立てボーナス、snapshotの分離、seed再現性を確認。
ブラウザ16ケースはPC/横持ちタッチ、2本の往復、8結末、会話/調査/相談/メモ、仮説、
振り直し、中断/再挑戦、縦持ち案内、音ON/OFF、ロード失敗からの再試行、背景再読込、
API中断、画面内収まり、Storageアクセスゼロと既存保存の不変を確認。

本編接続7ケースはPC／実タッチ入力の両作読了、再挑戦・別作品への移動・タイトルへ戻る・フォーカスと絵の維持、
通信応答破損からの再試行と帰還、読み込み中断、判定中の画面撤去と音の破棄、事前Abort、
履歴復帰イベントを確認。既存のオート／手動2枠・設定・無関係なStorage・本編stateの参照と全内容を保持する。
履歴の検証はPageTransitionEventで行い、物理端末の履歴キャッシュ保証ではない。

`ch1_facility_art.mjs` の雨描写4ケースは、改稿前の「緊張」という文字列ではなく、
正本から選んだ台詞の全文と会話レイヤーの表示を待つ。背景・窓限定の雨・描画サイズの既存検査は維持する。
本編素材のPC／タッチ全24ケースとGitHubのfacility-artがPASS。

## 静的配信を切り出す

```bash
python3 tools/export_trpg_preview.py --commit HEAD --output /tmp/trpg-static --pr 487
python3 -m http.server 8124 --directory /tmp/trpg-static
```

指定したGitコミットから実ファイルだけを切り出す。背景・立ち絵の使用表情・人物overlay・フォント・モジュールを含み、
`SOURCE.json` に元リポジトリ・コミット・PR・ファイルハッシュを記録する。ソースはGitHubが正本。
Sitesで配信する場合も、この出力は配信スナップショットだけとし、実装を分岐させない。

物理端末/Safari、実際の10分所要時間は未確認。
日常のイベントとしての解放条件・行動消費・報酬・本編の読了記録は、今回のタイトルの無料プレイとは別の接続範囲。
