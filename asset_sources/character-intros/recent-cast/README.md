# 新しい登場カットイン

久世・スティーブ・ヴォルク・ましろ・斧崎マキ・六角サイ・路上占い師を、既存の専用イラスト背景・白い斜め帯・極太ゴシックの紹介へ追加した。人物は採用済み `assets/sprites/characters/` の透過PNGをそのまま使い、配置と拡縮のみを行う。ヴォルクは2026-10-26採用版、ましろは現行の通常立ち絵。未制作の人物を描き足していない。

- 久世：味カード・手帳・茶の香り。勝負の策・幼なじみの事情は紹介に書かない。
- スティーブ：シリアル・ポップコーン・タイマー。橙・キャラメル色。
- ヴォルク：`../ch3-v1/backgrounds/volk.png` の精密な目盛り・ノギス・ミント。現行立ち絵を再計測。
- ましろ：`../ch3-v1/backgrounds/mashiro.png` のお茶・リネン。正体は伏せる。
- マキ：斧投げの的・木目・銅色。既存プロフィールの口癖を使用。
- サイ：六面ダイス・六角タイル・ルールブック。親切な店長として扱う。
- 占い師：タロット・紫布・月。既存の初対面台詞から一言を採る。

背景5枚は `image_gen.imagegen` による新規生成で、人物・文字・シーシャ機材を含まない。生成原画は `backgrounds/`、生成ID・制作要件・SHA-256は `characters.json`。外部画像の転載はない。フォントは既存のNoto Sans JP（SIL OFL、`remake/fonts/OFL-NotoSansJP.txt`）を正本文字で再サブセット化した。

文言の正本は `data/characters.json`。背景・人物・帯・文字を本編の `vn/intro-art.js` で別々に動かす。表示3.6秒＋退場0.28秒、クリック・Enter・SKIPで短縮せず、動きを減らす設定では静止。既読は既存の `_intro_<id>` を使い、新しい保存形式は増やさない。久世・スティーブ・ヴォルク・ましろ・占い師は既存の会話紹介経路へ接続。マキとサイはVNを経由しない案内役なので、それぞれ斧投げBarとボドゲカフェの初回入店へ追加した。面識・好感度・料金・時間には追加の変更をしない。

[7人の一覧](comparison.png)

確認ページ：`/remake/character-intros-preview.html`。7人を切り替え・連続再生でき、ゲームの保存データには書き込まない。

再構築：

```sh
python3 remake/tools/build_manifest.py --intros-only kuze steve volk mashiro maki sai uranaishi
python3 remake/tools/build_intro_font.py
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/recent_intros.mjs
```

必要な背景原画・現行立ち絵のLFS実体を個別取得してから実行する。上記の限定ビルドは他の採用画像を変更しない。
