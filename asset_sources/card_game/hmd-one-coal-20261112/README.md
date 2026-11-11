# ワンコールリッドの実物手本候補（#3389・ICG50）

**状態: 実物手本の確認待ち。画像はまだ生成していない。**

Issue #3389 は「どの実物を手本にするかは、オーナーに確認してから作る」と指定している。その確認用に、日本の機材資料の写真と商品説明を調べた。推奨は **Y2 ヒートマネジメント**。オーナーが想定している製品と同じか、ここで確認する。

## 推奨: Y2

[EGG SHISHAの説明](https://www.official-eggshisha.com/items/y2-heat-management-system) に「使用する炭もキューブタイプなら1つ、フラットタイプなら2つ」とあり、外径は6.0cmと記載されている。写真は小さなステンレスの二重の筒、蓋と本体の横長通気口、木製の取っ手が読み取れる。一般的なロータス型の黒い取っ手ともシルエットを区別できる。

これは店の記述と写真による候補選定で、熱性能を実測した結果ではない。ゲーム内で実物名・ロゴ・説明文をそのまま使用する意図はない。

- [資料庫の写真（siryou、閲覧権限が必要）](https://github.com/haseatsu114514-dot/siryou/blob/main/shisha-hardware-reference/web-refs/images/hmd-twoPiece-woodHandle-01.jpg)
- 写真ID: `hmd-twoPiece-woodHandle-01`（資料のIDは一般名だが、同じ写真を掲載している店のページでY2と特定）
- 画像のSHA-256: `7b939e0156b0f4be599c3da82f7059c5b2484afe591aaa801dd336d55381473d`

<img src="https://cdn.prod.website-files.com/62484dbf7845614277b8a9bb/692ec29cc8867efe71a53fb9_0a586943e5b8e1147df327eb366c79f2.avif" alt="手本候補Y2。出典EGG SHISHA。木製取っ手の蓋と本体" width="360">

上は出典サイトの画像URLへの参照。写真ファイルをゲームのリポジトリにコピーしていない。画像が表示できなければ資料庫または出典ページを開く。

## 比較して除外した候補

| 写真のモデル | 写真・説明から確認したこと | 今回の扱い |
|---|---|---|
| Y2 | キューブ炭1個の運用が明記、6cm、木製取っ手と二重筒 | 推奨。オーナーが選ぶまで未確定 |
| ONMO | 開いた器状。店の説明は3個目の炭を縁に置く用途も説明 | 今回の1炭向けの手本には選ばない |
| ロータス型ノーブランド | 蓋付きの低い器と黒い取っ手 | 現在の仮絵と同じ系統。1炭モデルと確認できず選ばない |
| アマボースト | 薄い穴あき皿とドーム蓋、緑の取っ手 | 直置きに近い高火力という資料の説明と今回の低温用途が合わないため選ばない |

[ONMOの比較写真](https://github.com/haseatsu114514-dot/siryou/blob/main/shisha-hardware-reference/web-refs/images/hmd-onmo-01.jpg) / [ロータス型の比較写真](https://github.com/haseatsu114514-dot/siryou/blob/main/shisha-hardware-reference/web-refs/images/hmd-lotus-nobrand-01.jpg) / [アマボーストの比較写真](https://github.com/haseatsu114514-dot/siryou/blob/main/shisha-hardware-reference/web-refs/images/hmd-amaboost-open-01.jpg)

各写真は元の資料庫に置いたまま、出典URL・Git blob SHA・ファイルSHA-256・検討結果だけ [`reference-selection.json`](reference-selection.json) に記録した。

## 手本決定後の具体的な生成内容

Y2が選ばれた場合、1枚につき1つの組み上がったHMDを描く。写真のように蓋と本体を分解して並べず、ボウル・炭・台・人物は足さない。蓋・取っ手・通気口はY2だけを構造の基準とし、他の型の部品を混ぜない。木製取っ手と小型筒の外形を76pxでも判別できるようにする。

- 画風の基準: `remake/img/shop/equipment/lotos_hagal.webp`、`tanukish_lid.webp`、`amaburst_hms.webp`。3枚とも取得して目視した。**向き・明るさ・金属の色とピクセルペインター調だけ**を参照し、その構造は写さない。
- 希望寸法は512×512、RGBA透過。返された原画は加工せず `one-coal-untouched.png` として保存し、実寸とSHA-256を記録する。採用後の配信用は512×512 WebP。
- 生成前の8行、参照の役割と順序、必須文を含む英文全文、生成後の検品項目は [`generation-plan.json`](generation-plan.json)。すべて**未実行の条件付き計画**として記録した。別の実物が選ばれたらその構造に合わせて差し替える。

## 現行コードと残作業

確認したmain: `4d197952bb2d05908917ae48ee77496f33d9cd2d`。`HMD_ART` には `one_coal` がなく、`hmdArt` のフォールバックでロートスが出る。今回そのコードや配信用画像は変更していない。

1. オーナーがY2か別の実物かを決める。
2. 決まった1モデルで画像生成し、原画・実際のプロンプト・参照SHA・構造/透過/縮尺の検品をこのフォルダに追記する。
3. オーナーが原画を採用したら、`one_coal_lid.webp` と `HMD_ART.one_coal` を追加する。
4. 一式「一つ火の低温型」と76pxのHMD枠を実画面で比較し、`node tools/ci/run.mjs --kind browser --suites ichidai` を実行する。

今回の検証は資料写真・出典記述・既存ショップ絵・現行マッピングの確認と記録のみ。生成後QA、実画面の合否、採用済みとは扱わない。
