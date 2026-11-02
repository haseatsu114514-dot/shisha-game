2026-11-02注記: 下表の神崎（39歳・黒い撫で付け髪・刺青）とREI（左右の赤黒塗り分け）は**旧デザイン**。現行の見た目は `data/characters.json` と `asset_sources/portraits/style-unify-20261026/` を正とし、このフォルダのプロンプトを新しい生成に使わない。

2026-10-13追加訂正: ヴォルクは第3章で登場。制作済みnormalは保存するが、第2章の出演導線から外した。

# 第2章・未制作3人の初回normal立ち絵

Issue #514 / 2026-10-13 JST。既存採用立ち絵のリマスターではなく、画像が存在しなかった神崎竜二・零-REI-・ヴォルクの初めての通常立ち絵を制作した。正本は `data/characters.json` と `brand/character_profiles.md`。あげはの正規立ち絵は継続使用する。

| ID | 設定と目視確認 | 原画 |
| --- | --- | --- |
| kumicho | 39歳の日本人、広い体格、黒い撫で付け髪、小さい傷、開襟のスーツ、胸元と前腕の刺青。威圧感のある顔と静かな手。武器・組織の記章は描かない | [normal-source.png](kumicho/normal-source.png) |
| rei | 25歳、非対称の赤と黒の髪、首と手の刺青、黒赤の刺繍コート、控えめな銀金具。舞台衣装の華やかさと内向的な通常姿勢 | [normal-source.png](rei/normal-source.png) |
| volk | 37歳のロシア人、短い明るい金髪、成人の鋭い顔、黒タートルと炭色コート。民間の職人として描き、軍歴を衣装で開示しない | [normal-source.png](volk/normal-source.png) |

生成は `image_gen.imagegen` の新規生成、`transparent_background: true`。既存画像の添付・別キャラの流用はない。実際の全文指示は各ディレクトリの `normal-prompt.txt`。生成PNGを変更せず原画として保存し、寸法・SHA256・配布画像・実測したframingを [metadata.json](metadata.json) に記録した。原画は神崎とREIが1086×1448、ヴォルクが887×1774。画像の全身・顔・衣服・両手・靴・透明余白を実際に目視した。器具を持たない通常姿のため、シーシャ・ホースの描写は対象外。

配布PNGは `assets/sprites/characters/<id>/chr_<id>_normal.png`。ImageMagickで縦横比を維持して896×1200内へ縮小し、透明な896×1200キャンバスの中央へ配置。描き足し・背景除去・人物の切り取り・体型変更はしていない。`remake/img/` には同じ画像のlossless WebPを保存した。

`remake/tools/build_manifest.py --portraits-only kumicho rei volk` で画像のalpha本体と足元アンカーを計測し、今回3人のnormalと可逆WebP参照のみを目録へ追加。既存人物の計測値・紹介絵・顔アイコンは維持。試遊の名乗る前は「？？？」、名乗り後は正本の表示名。神崎の試遊紹介だけ「静かな手の店主」とし、DAY14の素性公開を先取りする「組長」の紹介を避けた。REIとヴォルクは正本の紹介文言を使う。

```sh
python3 remake/tools/build_manifest.py --portraits-only kumicho rei volk
python3 asset_sources/ch2-characters/validate.py
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/ch2_preview.mjs
```

画像QAは [validation.json](validation.json)、人物を店内に重ねた実画面は [試遊QA](../../docs/qa/ch2-preview/README.md)。今回完成したのは**通常1枚ずつ**で、別表情は未制作。engine既存のnormalフォールバックを使用する。表情差分は今回の本人原画を基準にし、顔と服を別人へ変えない。専用紹介背景や顔アイコンも後続制作。本編の日常・県大会の接続とは分ける。
