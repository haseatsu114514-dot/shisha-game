# DJ ミニゲーム（セット形式・2026-11-01 再構成）

Entry: `remake/previews/dj/index.html?set=1〜3`（旧 `?stage=` も同じ）。本編と同じ 1280×720 の固定ステージを画面に合わせて拡縮する（`controller-fx.mjs`）。本編の SAVE・所持金・時間は変えない。セット終了時に親フレームへ `postMessage({type:'dj-result', set, rank, total, floor})` を送るので、本編へ接続するときはこれを受けて `state.dj.bestRank` に残す（`core/growth-board-data.js` の SBD39 が読む）。

## 遊び方（操作は ▶ と横フェーダーだけ）

1. **A の ▶** でセットが始まる。A が鳴り、B には次の曲が載る。上の波形に「IN」の線が来るまで待つ（最低4小節先のフレーズ頭）。
2. 入りの直前4拍はフロアに大きな数字が出て、B の ▶ が点滅する。**0 で B の ▶**。押した瞬間に判定（PERFECT / GOOD / OK / EARLY / LATE）が出る。
   - **QUANTIZE**（常時ON）: CDJ と同じく、押したタイミングを今の曲の一番近い拍に吸着して B を鳴らす。拍はずれないので、ジョグで位相を直す操作は無い。採点はずれた分で決まる。
3. **8小節MIX**: 横フェーダーを A から B へゆっくり動かす。**EQ は自動**（AUTO EQ）: フェーダーが中央を越えるまで B の低音を抑え、越えたら A の低音を抑える（低音の入れ替え）。つまみとランプは動きに合わせて回るが操作はできない。
4. 8小節が終わると A が降りて次の曲が A に載り、次の入りを待つ（B が主になり、今度は A の ▶ → フェーダーを A へ）。これを曲数ぶん繰り返して終了。フェーダーが B 側（0.9 以上）に届いていない場合、A は最大8小節まで鳴り続ける（猶予。届いた時点で終了）。

### BPM 合わせ（任意）

- **SET 1** は全曲 120 BPM のまま届くので何もしなくてよい（LOCK が点いている）。
- **SET 2** は次の曲が ±1.2〜2.8 % ずれて届く。**PITCH フェーダー（±8 %）**かジョグ外周（1目盛り 0.01 BPM）で合わせる。0.15 % 以内で **LOCK** が点き、QUANTIZE が位相も合わせる。
- **SYNC** ボタンを押せば次の曲の BPM が今の曲に揃う（実機の SYNC と同じ）。使った回のBPM点は 85 止まり。
- **SET 3** は 120 ↔ 122 BPM の曲が交互なので、毎回 +1.67 % / −1.64 % の合わせが要る。

### 採点

1回のつなぎごとに 3 項目（各 100 / 85 / 60 / 30）→ 平均 → S（90〜）/ A（75〜）/ B（55〜）/ C。

| 項目 | 100 | 85 | 60 | 30 |
|---|---|---|---|---|
| BPM（終了時のずれ） | ≤0.15 % | ≤0.3 %（SYNC使用もここ） | ≤0.6 % | それ以上 |
| 入り（▶のずれ） | ≤30 ms | ≤60 ms | ≤120 ms | それ以上 |
| フェーダー | 到達（8小節中に 0.9 へ。3割より前は 85・猶予中は 60・未到達 30）と滑らかさ（0.25秒内の移動 ≤0.2 / ≤0.4 / ≤0.7）の平均 | | | |

セットの結果は全つなぎの平均。**FLOOR**（盛り上がり 0〜100）は演出用: きれいに混ざっていると上がり、無音・片側だけ薄い・拍が噛み合っていない・EARLY/LATE で下がる。PERFECT と S/A のつなぎで跳ねる。群衆の手が上がる人数と光の強さが FLOOR に連動する。

## 画面

- 上: **フロア**（群衆のドット・FLOOR ゲージ・セット名と曲数・判定・カウント・やり直す）。
- 中: **上下 A/B の横波形**（共通の秒スケール・小節番号・8小節の頭は明るい線・次の入りの「IN」・MIX 中は窓を薄く塗る）と案内文1行。
- 下: **コントローラー**。皿（アートワーク・BPM・LOCK）を外側、PITCH と ▶ をミキサー側に。中央は自動 EQ のつまみ・レベルメーター・QUANTIZE / AUTO EQ ランプ・SYNC・銀色の横フェーダー。A は紫、B は水色。

素材は `remake/img/ui/dj/`（#2071/#2073/#2095/#2107/#2114 の生成物をそのまま使用）。フロアの背景は `bg-purple.webp`（空のクラブ）の上に群衆をコードで描いている。

### 任意の差し替え: フロアの群衆画像（Codex 用プロンプト）

画像生成 API のクレジット切れ（2026-11-01）のため群衆はコード描画。より写実的にしたい場合は次を Codex に渡し、できた画像を `asset_sources/ui/dj-floor/` に原画、`remake/img/ui/dj/floor-crowd.webp`（1536×512・不透過）に組み込み、`style.css` の `.floor` の背景に差し替える（`#crowd` のドット群衆は FLOOR 連動の演出として残す）。

```
Painterly illustration, game theme palette deep purple-black (#0b0812, #151024) with violet (#b45cf0), neon pink (#ff5fa8) and cyan (#3fd0e8) stage light, faint hookah smoke wisps, moody shisha-bar club atmosphere.
Scene: wide view from behind the DJ booth looking out over a packed club dancefloor at night. A dense crowd of dark back-lit silhouettes with raised hands fills the middle band; violet and cyan beams and haze above; the very bottom edge is the dark top surface of the DJ table. Horizontal 3:1 composition (1536x512), crowd heads roughly in the lower half so UI text can sit on the dark ceiling area.
No text, no letters, no logos, no numbers, no watermark, no readable faces, no gauges or UI elements baked in.
Save as: remake/img/ui/dj/floor-crowd.webp (opaque, 1536x512). Keep the original PNG in asset_sources/ui/dj-floor/.
```

## 検証

- `node remake/test/dj_preview.mjs`: 純関数（セット進行・クオンタイズ・採点・FLOOR）と注入 WebAudio の契約。
- `node remake/test/browser/dj_preview.mjs`（プレビューサーバー起動後）: PC / タッチ / 動き低減で、操作部の数、▶ の大きさ、PITCH とジョグの実入力、入りのカウントとクオンタイズ、キーボード／タップでの8小節フェード、自動 EQ ランプ、つなぎ後の曲の載せ替え、やり直しを実ブラウザで確認。CI は `tools/ci/suites.json` の `dj-preview`。
- 実機の発音・遅延・OS 中断は CI 外。

## 経緯

Issue #1064（Codex 試作: 手動ピッチ・即時 PLAY・ジョグで位相合わせ・1回のつなぎで採点）→ #2073〜#2118（コントローラー表示の調整）→ **2026-11-01 オーナー指示で再構成**: 「よりリアルに DJ をしている感じ、でも操作は横フェーダーと再生ボタンくらい。EQ は自動。BPM 合わせはやっても良い程度」。1回のつなぎからセット（3〜4曲）の連続ミックスへ変え、位相合わせを QUANTIZE に置き換え、採点をつなぎごと＋FLOOR の盛り上がりにした。
