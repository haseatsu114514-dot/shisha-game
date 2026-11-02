# ロード画面の2コマ漫画 — 制作規格（正本）

ロード画面（作業台に入るときなどの共通ロード）に出る2コマ漫画の **作り方・寸法・プロンプト・組み込み** を1か所にまとめた正本。
表示側の仕様は [docs/spec/loading_screen_and_comics.md](../../docs/spec/loading_screen_and_comics.md)、登録先は `remake/js/core/loading-comics.js`、切り出しツールは `tools/loading_comic_cut.py`。
以前の参照先 `work/loading-comic-ref/REFERENCE.md` はリポジトリに無いので、本書が置き換える。

## 0. なぜ規格が要るか（2026-11-01 オーナー指摘）

「Codex で作ると微妙にサイズ感が違ったり、コマ割がおかしい」。原因は **4段組みのシート（1086×1448）に描かせて、あとから画素を測って切り出す** 方式にある。
生成AIは段やコマの寸法を毎回少しずつ変えるため（実績: 25話 左486×307／右565×307、『炭の耳』510×399／520×399、27話の右は 623×317 ＝ 比率 1.97）、表示枠 3:2 に収めると **左右のコマの大きさが揃わない・紙の余白が出る**。

対策は3つで、どれも本書と `tools/loading_comic_cut.py` に入っている。

1. **下敷き（テンプレート）を渡して描かせる**: 1536×1024 の紙面にコマ枠2つだけを引いた画像を Codex に添付し、「この枠の中だけを描く」と指示する。
2. **ツールで枠を検出して 3:2 に揃える**: 多少ずれても、紙色を足して 3:2 に整え、2枚とも同じ規格の WebP にする。許容を外れたら「作り直し」と判定する。
3. **1コマ＝1ファイルで登録する**: 原画シートの座標（`region`）に頼らない。表示枠に端から端まで収まるので、大きさは必ず揃う。

## 1. 寸法規格（数値はツールの定数と一致）

| 項目 | 値 |
| --- | --- |
| 生成キャンバス | **1536×1024**（Codex / GPT 画像生成の横長サイズ）。紙色 `#EEE3CF` |
| コマ枠 | **720×480（3:2）× 2**。左 x=36 y=272、右 x=780 y=272。コマ間 24px、枠線 3px `#2C1F2A` |
| セーフマージン | 枠の縁から **各辺 4%（29×19px）** の内側に吹き出し・顔・重要な線を収める |
| 配信用 | `remake/img/loading/<id>-1.webp` と `<id>-2.webp`。**3:2・最大 1440×960**（拡大はしない）・quality 85・1枚 400 KiB 以下 |
| 比率の許容 | 1.35〜1.65 は紙色を足して 3:2 に整える（片側 5% 以内の帯）。1.25〜1.80 は警告つきで通す。**それ以外は作り直し** |
| 画像に入れない | 題名・話数・シリーズ名・署名・透かし・ページ番号・英語の説明文（題名と一行解説はゲームが描く） |
| 画像に入れる | コマ枠線、絵、吹き出しと台詞（台本と一字一句同じ）、文字のない擬音・記号 |

下敷きとガイド: [`template/2koma_template_1536x1024.png`](template/2koma_template_1536x1024.png)（Codex に添付する方）／[`template/2koma_template_1536x1024_guide.png`](template/2koma_template_1536x1024_guide.png)（人が寸法を確認する方。添付しない）。
再生成は `python3 tools/loading_comic_cut.py template`。

## 2. ネーム（話づくり）の型

- **① 導入 → ② オチ**。読む順は左から右。1話は2コマで完結し、前後の話に依存しない。
- 登場人物は **2人まで**（原則、はじめ＋相手1人）。**両コマで立ち位置を揃える**（例: はじめが左、相手が右）。入れ替えると読者が人物を取り違える。
- 台詞は **合計3つまで、1つ12字以内、2行まで**。①に1〜2つ、②に1〜2つ。ツッコミは②の端に短く。
- **1コマに吹き出しが2つあるときは、先に話す方を左か上に置く**（2026-11-02 追加）。はじめが左に立つので、右の相手が先に話す場面では、相手の吹き出しを左上に高く置いて尻尾を相手へ伸ばし、はじめの返事を右下に置く。同じ高さで左右に並べると、左から読んだときに返事やオチが先に入る（候補54話のうち10話がこれで不採用になった）。
- 題名は 4〜7 字（ゲームが紙面の上に描く）。一行解説（任意）は初心者向けの 25 字前後。
- 内容は **番外編のギャグ**。本編の能力・人物設定・ゲーム挙動を変えない（`brand/character_profiles.md`、`data/characters.json` が正本）。誇張や不可能な出来事は「ギャグの誇張」として台帳に記す。
- シーシャ機材・炭が写るときは [シーシャ描写の早見表](../shisha-hardware-reference/drawing-sheet/README.md) の「生成前に決める8行」に従う。火の付いた炭を素手で扱う・直炭などの危険な描写はしない。

## 3. Codex に渡すプロンプト（コピペ用）

下敷き `template/2koma_template_1536x1024.png` と、登場人物の立ち絵（`assets/sprites/characters/<id>/chr_<id>_normal.png`）を添付する。`【 】` を埋めて1ブロックで渡す。

```text
添付の下敷き画像（1536×1024、クリーム色の紙に黒い枠が2つ）を編集して、2コマ漫画を1話描いてください。

■ 守ること（寸法）
- 出力は 1536×1024。下敷きの2つの枠（左: x=36〜756 / 右: x=780〜1500、y=272〜752、各 720×480、3:2）の位置と大きさを変えない。
- 絵は枠の内側だけに描く。枠の外（上下の紙・コマ間 24px）は紙色 #EEE3CF のまま、何も描かない。
- 枠線（3px、黒）は残す。枠の縁から内側 4%（約29×19px）には吹き出し・顔・重要な線を置かない。
- 題名・話数・シリーズ名・署名・透かし・ページ番号・英語の説明文を入れない。文字は吹き出しの中の台詞だけ。

■ 画風
- 添付の立ち絵の人物を、同じ髪型・服・小物で、2〜3頭身のデフォルメ漫画にする。太めのきれいな主線、セル塗り＋少しの紙の質感、暖色寄りの明るい配色。
- 吹き出しは白地に黒い縁、台詞は太いゴシック体で大きく読みやすく。台詞は下の台本と一字一句同じにする（句読点・！？も同じ）。
- 2コマで人物の立ち位置を揃える（【はじめ】が左、【相手】が右）。
- 1コマに吹き出しが2つあるときは、先に話す方の吹き出しを左か上に置く。右の人物が先に話すなら、その吹き出しを左上に高く置いて尻尾を右の人物へ伸ばし、後から話す左の人物の吹き出しは右下に置く。同じ高さで左右に並べない。

■ 台本
- 題名（画像には描かない。参考）: 【題名】
- 登場人物: 【はじめ】（黒いキャップ・黒パーカー）、【相手の名前と外見の要点】
- 左①（導入）: 【場所・状況・表情】。吹き出し: 「【台詞1】」「【台詞2】」
- 右②（オチ）: 【誇張された結果・表情】。吹き出し: 「【台詞3】」
- 描かないもの: 【例: シーシャ台・ホース・火の付いた炭・武器】
```

- 1回で2コマとも描くのが基本（人物の顔が揃う）。片方だけ直したいときは、**採用するコマの画像を添付して**「このコマの人物と画風を保ち、もう一方のコマを 1536×1024 の全面に 3:2 で描く」と頼み、`panel` モードで揃える。
- 良いプロンプトができたら本書のブロックを更新する（チャットに使い捨てにしない）。

## 4. 受け取ってから組み込むまで

```bash
# 1) 原画を保存（話ごとにフォルダ。番号は既存の最大+1）
mkdir -p asset_sources/loading-comics/43-<id>
cp ~/Downloads/xxx.png asset_sources/loading-comics/43-<id>/43-<id>.png

# 2) コマを検出して 3:2 の WebP 2枚に揃える（--dry-run で先に検出結果だけ見てもよい）
python3 tools/loading_comic_cut.py sheet asset_sources/loading-comics/43-<id>/43-<id>.png \
  --id <id> --title "題名" --caption "初心者向けの一行解説"
#    → remake/img/loading/<id>-1.webp, <id>-2.webp と、登録・台帳用の JSON が出る
#    「比率が許容帯の外」と出たら作り直す（--force で無理に通さない）

# 3) 登録: 出力された panels を remake/js/core/loading-comics.js に貼り、src を imgFileUrl("loading/<id>-1.webp") にして alt を書く
# 4) 検査と目視
node remake/test/loading_comics_spec.mjs
python3 tools/loading_comic_cut.py check remake/img/loading/<id>-*.webp
#    ブラウザ: python3 remake/tools/serve_preview.py --port 8123 → /remake/craft-preview.html?loading=comic（本編と同じ経路）
#    git add 後に git lfs ls-files で新規画像が LFS 管理になっていることを確認（.gitattributes で自動）
```

話の記録（台本・プロンプト要約・参照画像・原画の SHA-256・検品結果・region）は、話フォルダの `comics.json` に既存の [loading-comics-batch1-20261029/comics.json](../loading-comics-batch1-20261029/comics.json) と同じ項目で残す。

## 5. 検品チェックリスト（採用前に全部見る）

- [ ] ツールの比率判定が ok（warn なら理由を台帳に書く。reject は不採用）
- [ ] 2枚の出力が同じ高さ・3:2（`check` が OK）。紙帯が出ていても吹き出し・顔が欠けていない
- [ ] 台詞が台本と一字一句同じ。余計な文字・英語・署名・題名が入っていない
- [ ] 1コマに吹き出しが2つあるとき、左（または上）から読むと台本の順になっている。返事やオチを先に読ませない
- [ ] 人物が立ち絵と同一人物に見える（髪型・帽子・眼鏡・服の色）。2コマで立ち位置が同じ
- [ ] 枠の外（紙・コマ間）に描き込みがない
- [ ] 禁止描写なし（火の付いた炭の素手扱い・直炭・武器・暴力・本編設定の変更）
- [ ] ゲーム内（`craft-preview.html?loading=comic`）で PC 横・スマホ横の両方で文字が読める

## 6. 既存2本の扱い

『メニュー改訂』（25話、`img/loading/adam-chaos.webp`）と『炭の耳』（41話、`img/loading/loading-batch1.webp`）は旧方式（シート＋`region`）の登録のまま使い続ける。作り直しは不要（オーナー決定 2026-10-29）。表示側は同じ 3:2 の墨枠の中に紙色の余白つきで収めるので、新規格の話と並んでも破綻しない。

## 7. 置き場所と履歴

- 本書・下敷き: `asset_sources/loading-comics/`（新規の話もこの下に `NN-<id>/` で追加する）
- 過去のバッチ: [short-comics-unhinged-ltr-20261025](../short-comics-unhinged-ltr-20261025/README.md)（21〜40話・在庫。未登録分はオーナー決定により採用しない）、[loading-comics-batch1-20261029](../loading-comics-batch1-20261029/README.md)（41話）
- モックアップ（見た目の基準）: [issue-loading-mockup](../issue-loading-mockup/README.md)
- 実画面の確認（2026-11-01 の刷新前後・PC 1280×720 とスマホ横 844×390）: [qa/before-pc-20261101.webp](qa/before-pc-20261101.webp) → [qa/after-pc-20261101.webp](qa/after-pc-20261101.webp)、[qa/after-phone-landscape-20261101.webp](qa/after-phone-landscape-20261101.webp)、[qa/after-portrait-20261101.webp](qa/after-portrait-20261101.webp)（ロゴと LOADING の印の作り直し後）

## 8. 新作（2026-11-02）

正式立ち絵と下敷きで制作した、はじめ＋スミさんの日常ギャグ6話。第42話は既存PR #1398 のため使用しない。各フォルダの `comics.json` に台本・プロンプト・ハッシュ・切り出し領域・検品記録を保存。第45話は原画比率1.31〜1.33の警告を記録し、紙色を左右約6%足して内容を保った。全12枚の配信用WebPは3:2の規格検査に合格。

| 話 | 題名 | 原画と台帳 |
| --- | --- | --- |
| 43 | 予約の正体 | [sumi-reserved-seat](43-sumi-reserved-seat/) |
| 44 | 畳みの極意 | [sumi-cloth-fold](44-sumi-cloth-fold/) |
| 45 | 一行の秘訣 | [sumi-recipe-scroll](45-sumi-recipe-scroll/) |
| 46 | 雨音の合奏 | [sumi-rain-concert](46-sumi-rain-concert/) |
| 47 | 座り心地派 | [sumi-cushion-tower](47-sumi-cushion-tower/) |
| 48 | 看板の向き | [sumi-sign-reverse](48-sumi-sign-reverse/) |

## 9. 候補54話の選別と登録（2026-11-02）

オーナー依頼「候補の内容と実画面表示を確認し、採用できるものを整理して登録を進めて」。候補は #2246（記録番号49〜72・24話・merged）と #2258（記録番号61〜90・30話・Draft）。**61〜72は両PRで番号が重なる別作品**なので、以下はすべて **PR番号:安定ID** で書く。ゲームの登録 id は安定IDそのもの（`remake/js/core/loading-comics.js`）。

**確認したこと**: 全108コマを目視（台詞・人物の見た目・アダムの髪の左右・みんとの営業時の姿だけでお姉さんの正体に触れない・機材や炭の描写なし）。人物設定は `data/characters.json` と照合（アダムの私生活は少し抜けている・なるはバニラと菓子系の作り手で口癖「全部見てけ」・みんとの店はキャスト一人で「人気No.1」・なるとアダムの一人称「俺」）。実画面は、ゲームの `#stage` に同じロード画面の部品で1話ずつ差し込み、PC 1280×720 とスマホ横 844×390 の108表示すべてで、2コマの読み込み・3:2の枠いっぱい・画面内・左→右を確認した（スマホ横でコマ幅 252px、吹き出しの文字は読める）。結果と画面写真は [qa/selection-20261102/](qa/selection-20261102/)。

**採用 39話**（全話 `contexts: ["craft"]`・`minChapter: 1`）

| 出どころ | 話（安定ID） |
| --- | --- |
| #2246（20話） | steeping-clock・mint-question・scent-overtime・apple-interview・apple-light・apple-ratio・sweet-unit・dessert-stomach・leave-it-to-you・all-favorites・short-visit・apple-study・apple-season・apple-break・sweet-name・not-sweet・cake-lunch・mint-ranking・mint-service・mint-photo |
| #2258（19話） | sumi-cold-tea・sumi-memory-kitchen・sumi-clean-counter・sumi-coin-hunt・adam-holiday-choice・adam-lunch-dessert・adam-shopping-bag・adam-alarm-clock・adam-napkin-fold・adam-weather-forecast・adam-key-ring・naru-vanilla-break・naru-recipe-notes・naru-biscuit-measure・naru-cake-compass・naru-freezer-space・naru-spoon-choice・naru-flavor-dream・naru-tiny-sample |

**不採用 10話（吹き出しの順。§2 の決まりで描き直せば再候補）**: 1コマ目で右の人物が先に話すのに、吹き出しが同じ高さで左右に並び、左から読むと返事やオチが先に入る。

| 話 | 先に読めてしまう台詞 |
| --- | --- |
| PR2246:flavor-address | 「雨上がりの実家。」が「どんな味だった？」より先 |
| PR2246:apple-judge | 「おいしいです。」が「味の感想は？」より先 |
| PR2246:cake-praise | 2コマ目のツッコミ「ケーキに報告。」が「聞いたか、お前。」より先 |
| PR2246:cake-apology | 「次がありますよ。」が「失敗した。」より先 |
| PR2258:sumi-seat-choice | 「迷いますね。」が「好きな席でいいぞ。」より先 |
| PR2258:sumi-tasting-sketch | 「任せてください。」が「感想は一言で。」より先 |
| PR2258:sumi-order-practice | 「爽やかな味で！」が「注文の練習だ。」より先 |
| PR2258:sumi-two-umbrellas | 「ちゃんとあります。」が「傘、忘れるなよ。」より先 |
| PR2258:adam-gift-wrap | 「難しいですね。」が「中身、当ててみて。」より先 |
| PR2258:adam-cup-noodles | 「内側の線です。」が「お湯はどこまでだ。」より先 |

**保留 5話（似た話を採用済み。入れ替えたいときは安定IDで指定する）**: 絵と台詞に問題はない。

| 話 | 採用した似た話 | 理由 |
| --- | --- | --- |
| PR2258:sumi-jacket-souvenir | PR2246:scent-overtime | 閉店後に服の香りを嗅ぎ、果物の想像図で見せる状況とオチが近い |
| PR2258:adam-photo-album | PR2246:apple-study | 帳面を開くとリンゴばかり、の種明かしが同じ。題名「写真の主役」も PR2246:mint-photo と重なる |
| PR2258:sumi-slow-clock | PR2246:steeping-clock | 残り一分を待ちきれず時計を見つめる |
| PR2258:naru-sweet-description | PR2246:sweet-unit | 甘さをケーキで説明する入り方が同じ |
| PR2258:naru-last-cookie | PR2258:naru-biscuit-measure | なるがお菓子を測るほど厳密に扱う |

#2258 の原画・台本・プロンプトは同PRの各話フォルダ（`asset_sources/loading-comics/61-sumi-jacket-souvenir/` など。#2246 の `61-leave-it-to-you/` とは別フォルダ）にある。ゲームに要る配信用WebPだけを `remake/img/loading/` に複製して登録した。#2246 側の各話 `comics.json` には採否（`status`・`registered`・`selection_note`）を書き込んだ。

