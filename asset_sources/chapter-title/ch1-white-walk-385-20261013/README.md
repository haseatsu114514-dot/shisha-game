# 第1章・白背景の横歩きタイトルコール（6案）

第1章の採用済み人物画像を参照した、構図選定用の静止画候補です。6案すべてで同じ6人・同じ営業／通常衣装・同じ右向き歩行PNGを使っています。**2026-10-13、現在の仕上げDをユーザーが承認し、素材PRのmainへのマージを依頼。本編への接続は別作業です。**

**追加指示でDを選定。**「画像生成で、参考画像のようにゲームタイトルも入れて」との依頼に従い、[`selected-D/D-title.png`](selected-D/D-title.png) を追加しました。Dの並び順と6人の本人性を参照してbuilt-in image_genで一枚のプレートを仕上げ、正式作品名 `水煙前線 -EN:CODE-` と `CHAPTER 1`、`煙がつなぐ街`、正式副題 `Smoke & Ties` を別レイヤーで組版。ゲーム名は `README.md`、`remake/index.html`、`remake/js/scenes/title.js` で確認しています。文字・ロゴ禁止の当初条件は、この追加依頼の範囲で作品名を追加しています。

HTMLの初期表示は「仕上げD」。元のA〜Fは上書きせず保持しています。追加Dは元の素材をそのまま合成した6案とは異なる、画像生成で仕上げた別プレートです。追加版は白背景と人物が一枚、文字が別RGBAです。元の6人の独立RGBA、人物／背景／文字レイヤーは全て残っており、追加版から歩行アニメを制作したとは主張していません。追加Dの参照・プロンプト・ハッシュは [`selected-D/generation.json`](selected-D/generation.json)。

**文字の追加調整：** オーナーの「EN:CODEの位置が変」「章題をおしゃれにずらしたい」「他は完璧」に合わせ、人物と背景を完全に固定して3案を制作。英字・記号・副題は上端揃えからベースライン揃えへ直し、和文の作品名と欧文を別ブロックで整列しました。①控えめな段差、②文字の大小と段差、③右上がり。初期表示と `selected-D/D-title.png` は②です。[修正前との比較](selected-D/typography/comparison.png)・[文字配置の数値とSHA256](selected-D/typography/studies.json)。修正前の文字とPNGも同じフォルダに保存。3案すべてで、人物領域（y=260以降）と元のプレートのSHA256が修正前と一致することを検証しています。再組版は `python3 build_type_studies.py`。

`index.html` を開くと、個別表示・A〜F切り替え・6案一覧・章題レイヤーの表示切り替えができます。外部通信やビルドは不要です。`comparison.png` は同じ並び順の小／大を左右で比較する一覧です。

| 案 | 配置 | 左から右の人物順 | 意図 |
|---|---|---|---|
| A | 余白重視 | みんと → アダム → なる → つむぎ → スミさん → はじめ | 本命の並び順。はじめが先頭、身近な2人がすぐ後ろ。 |
| B | 余白重視 | スミさん → つむぎ → みんと → アダム → なる → はじめ | 前方ではじめとなるを隣接させる。 |
| C | 余白重視 | つむぎ → スミさん → はじめ → みんと → アダム → なる | 日常から大会へ。なるを目標として先頭に置く。 |
| D | 人物重視 | みんと → アダム → なる → つむぎ → スミさん → はじめ | Aの人物を大きくして衣装・表情を見せる。 |
| E | 人物重視 | スミさん → つむぎ → みんと → アダム → なる → はじめ | Bの人物を大きくする。 |
| F | 人物重視 | つむぎ → スミさん → はじめ → みんと → アダム → なる | Cの人物を大きくする。 |

右端が進行方向の先頭。人物高は最大208px／312px、足元はy=628／654。横幅約798px／1051px。背景は純白、人物は重ねず、足元の影は非常に薄い短い楕円だけです。

## 参照元と本人性

基準mainコミット：`f5bf90859d559fbfd42a98fe58b8f2439a0b195d`。`remake/data/manifest.json` の `portraits` と `remake/js/core/data.js:portraitInfo()` が参照する `assets/sprites/characters/{id}/chr_{id}_normal.png` を6人とも実際に開いて確認しました。

- 採用済み元画像のパス・コミットSHA・Git blob SHA・SHA256：[`references/sources.json`](references/sources.json)。`references/*-adopted-normal.png` は元ファイルとバイト一致のコピーです。元の採用画像は変更していません。
- 採用済み6人の全身・顔・識別要素：[`references/adopted-six-reference-sheet.png`](references/adopted-six-reference-sheet.png)。既存参照シートツールと共通の `tools/make_face_icons.py:face_box()` を利用し、今回専用の6人用シートを構成しました。
- 採用記録も確認：`asset_sources/adoptions/ch1-art-20261008/README.md`（はじめ・なる・アダム）、`asset_sources/portraits/resolution-upgrade-20261009/README.md`（スミさん・つむぎの採用済み画質統一）。現在の本編PNGを優先し、旧 `visual_concepts` から衣装を再構成していません。
- みんとは `normal` の黒髪・緑の瞳・黒と淡緑の営業ドレスのみ。`ura_*` 私服は参照・制作対象外。原本にある角とコウモリ羽の髪飾りは保持し、新しい体の翼・尻尾・白エプロンは加えていません。
- アダムの正面画像は画面左＝本人の右側が緑、画面右＝本人の左側が赤。右向きでは手前に見える本人の右側を緑、遠い側を赤として描き、画像の左右反転は使っていません。
- 身長ははじめ172、スミさん182、なる176、アダム178、みんと156cmを基準。つむぎに正式なcm値はないため本編の `spriteScale: 0.88` を相対高として使い、cm設定は創作していません。
- 章題は現行mainの古い見出しではなく、最新の明示的な採用指示 [Issue #445](https://github.com/haseatsu114514-dot/shisha-game/issues/445) と今回の依頼に合わせました。画面内の文字は `CHAPTER 1` と `煙がつなぐ街` のみ。正式欧文副題 `Smoke & Ties` も今回は省略しています。
- 添付された過去案は白背景・余白・下部の横歩き列という構図だけの参考です。過去案の人物、ラベル、作品ロゴは取り込んでいません。

## 素材・レイヤー

- `originals/`：組版前の無加工生成原画。built-in `image_gen` で各人を個別に制作。本人の採用済み画像を実際の画像入力として渡しました。はじめの初稿を、残り5人の画風だけの補助参照にも使用。
- `prompts/`：実行した全文プロンプト。みんとv1のヒールを原本の厚底靴へ修正したv2を選び、v1も不採用理由とともに残しています。
- `sprites/*-walk-right.png`：6人の共通RGBA素材。原画の透明余白を裁ち、最長156pxの共通グリッドへ縦横比を保ってnearestで縮小。色の変更・人物の加筆・左右反転・モザイクフィルターは行っていません。
- `titles/A.png`〜`F.png`：1280×720の完成静止画。
- `layers/background.png`、`layers/{A..F}-characters.png`、`-shadows.png`、`-type.png`：背景・人物列・薄い足元影・組版文字を独立保存。文字は生成画像に描かせず、Times New Roman／ヒラギノ明朝ProNを使って別RGBAへ描画。フォントファイルは再配布していません。
- [`generation.json`](generation.json)：使用原画、参照入力、選択／不採用履歴、プロンプト、SHA256、各人物の座標と倍率。A〜Fが参照する各人物素材のSHA256は共通。
- [`review/identity-comparison.png`](review/identity-comparison.png)：原本と歩行ポーズの見比べ。[`review/validation.json`](review/validation.json)：画像構成と目視確認記録。

## 確認と残事項

6案を原寸で開いて、6人の過不足、同じ衣装と素材、右向きの顔・胴・脚、関節と手足、アダムの配色、つむぎとみんとの本人性、はじめとスミさんの違い、足元・切れ・重なり・禁止文字を確認。素材はすべて今回新規制作で、旧 `assets/proto_walk/tsumugi_walk_*` の再利用ではありません。

右側面専用の公式設定画が存在するとは主張せず、現在の全身画像に見える識別要素を横歩きへ描き起こしています。歩行ループ・ゲーム内演出・本編差し替え・公開版の更新は制作していません。

更新：構図はDに選定済み。現在の仕上げDも2026-10-13に採用済み。残事項は別依頼での本編接続です。追加Dも6人の過不足、右向き、衣装、髪色、靴、手足、文字と切れを原寸で開いて確認しました。

検証：A〜Fの1280×720、参照コピーのSHA256、6人の素材共通性、並び順、収まり、非重複、足元、レイヤー再合成の画素一致を `validate_artifacts.py` で確認。追加Dも入力参照のハッシュと文字レイヤーの再合成を検証。比較HTMLはA〜F切替、文字表示切替、一覧、初期表示の仕上げDを実ブラウザで確認し、1280×900／390×844で横はみ出し・画像取得失敗0、観測したconsole error 0。縮小表示とスクリーンショットは `review/` に保存。

再組版はPillowを使い `python3 build_layouts.py`。制作参照の再生成はリポジトリ内で `python3 build_references.py`。組版フォントにmacOSのヒラギノ明朝ProNとTimes New Romanが必要ですが、納品PNGとHTMLの閲覧には不要です。

## 予約とGit

WORKER: `codex-ch1-white-walk-20261013-aa5ec922` / ISSUE: #385 / BRANCH: `codex/ch1-white-walk-385-20261013`。
claim成功run: `38278913936`（`CLAIMED_ISSUE=385`）、status成功run: `38279080725`（`CLAIM_VALIDATED_ISSUE=385`）。今回の変更予定パスについて開始時のopen PR 11件との衝突なし。Git Safety成功、`.githooks` 有効、独立した新規checkoutの `shisha.canonicalRoot` 一致を確認。

文字修正の継続時、#385が完了扱いで閉じられていたため、継続依頼に合わせて再開。同じworkerの予約をstatus run `38283582659` で再検証し成功。最新mainを作業ブランチへ取り込み、PR #462の本人性と画像を保ったまま文字レイヤーを更新しています。

開始時の `tools/agent_quota_guard.py check codex` は既存SyntaxErrorで実行不能。成功扱いにはしていません。公式Codex利用枠ツールで利用可能を確認しました。ゲームデータと本編コードを変更していないため、ゲーム進行のテストは対象外です。

採用画像の確定パスとSHA256は [5章の採用記録](../ch2-5-style-studies-385-20261013/type-polish/adoption.json)。他の候補と旧版は保全。
