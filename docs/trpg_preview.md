# 10分TRPG「世界一普通の一台」独立試作

Issue #484 / PR #487。日常パートに組み込む前の、最後まで遊べる独立試作。

## 遊ぶ

```bash
python3 remake/tools/serve_preview.py --port 8123
```

`http://127.0.0.1:8123/remake/trpg-preview.html` を開く。
PCはクリックとキーボード、タッチ端末は横持ち。会話はEnter/Space、ボタンはTab/Enter。

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
所要時間は約10分の想定で、実時間の制限はない。読み込み待ちや考える時間を減点しない。
更新・中断後は表紙から始まる。本編セーブ・手動枠・sessionStorageを読み書きしない。

## 正本と構成

- `data/dialogue/trpg_ordinary.json`: シナリオ、調査資料、選択肢、既存のdialogues/lines形式の台詞。
  本編の `loadAll()` に登録しておらず、試作の開始時だけ直接読む。
- `remake/js/trpg/session.js`: DOM・ストレージに依存しない、seed付きのセッション処理。
- `remake/js/trpg/view.js`: 会話、部屋の調査、メモ、切り札、サイコロ、結末の表示。
- `remake/js/trpg/index.js`: 本編接続用の呼び出し窓。
- `remake/js/trpg/preview.js` / `remake/trpg-preview.html`: 独立起動と画面縮尺。
- `remake/js/trpg/room.svg`: この架空の茶房の、図形による試作用挿絵。
- `remake/css/trpg.css`: 1280×720ステージ内に限定した表示。

人物設定と採用済み立ち絵の正本を直接参照。顔位置は既存manifestのh/b/aspectで合わせる。
新しい本編キャラ設定や立ち絵、BGM、報酬、マップピンは追加していない。

## 呼び出す

呼び出し側のCSSに `remake/css/trpg.css` を含め、空の画面領域を渡す。

```js
import { runTrpg } from "./trpg/index.js";

const result = await runTrpg(host, { signal: abortController.signal });
if (!result.cancelled) {
  // scenarioId、ending、variant、plan、hypothesis、clues、checksなどを返す。
  // 解放条件・行動消費・報酬・本編の記録は、採用後に呼び出し側で扱う。
}
```

`runTrpg()` は卓を片付けた時に解決し、画面・イベント・中断リスナーを除去する。
中断は `{ cancelled: true, scenarioId }`。単体の処理から本編の状態モジュールを読み込まない。
`mountTrpg()` には `finished`、読み取り用の `snapshot()`、`destroy()` がある。

QA用: `?seed=9&traveler=quiet`、`traveler=home`、`traveler=company`。
通常起動では事情と出目をseedから選ぶ。条件をURLで固定でき、再現に使える。
`window.__trpg.snapshot()` は独立プレビューの読み取り窓。

## 検証

```bash
node --test remake/test/trpg.mjs
python3 tools/lint_dialogue.py trpg_ordinary
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/trpg.mjs
```

ブラウザの既定URLは8123。`BASE_URL`・`ARTIFACT_DIR`で変更できる。
PlaywrightとChromiumが必要。CIは `.github/workflows/trpg-preview.yml`。

純関数テストは全243提案組み合わせ、4結末、全判定段階、二重操作、
切り札と連携札、snapshotの分離、seed再現性を確認。
ブラウザはPC/横持ちタッチ、会話送り、調査/相談/メモ、仮説、4結末、
振り直し、中断/再挑戦、縦持ち案内、画面内収まり、ブラウザストレージへのアクセスゼロを確認。

物理端末/Safari、実際の10分所要時間、本編イベントからの接続・採用判断は未確認。
試作用の図形背景と無音の演出は、採用時に別途評価する。
