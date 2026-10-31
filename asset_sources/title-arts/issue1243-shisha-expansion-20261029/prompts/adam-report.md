# アダム タイトルアート候補 6–8 生成報告

## 生成方法と参照

- 使用ツール：組み込み image_gen（CLI/API フォールバック不使用）。各場面につき独立した新規生成1回。
- 参照：このフォルダの `sprite_normal.webp` を全3回に画像入力。`titleart_ref.webp` は存在しないため未使用。
- 参照から維持した特徴：画面左が赤、右が緑の中央分けの短髪、切れ長の琥珀色系の目、強い眉と角張った成人男性の顔立ち、黒いヘンリーシャツ、まくった袖、黒い腰エプロン。
- 全候補：PNG、1024 × 1536、縦横比2:3。サイズ変更・トリミング・画像加工は行っていない。
- 保存後に各画像を目視確認。再生成が必要な明らかな顔・手指の破綻、別人化、文字混入は確認されなかった。
- `INSTRUCTIONS.md`、`prompts.md`、参照画像は変更していない。

## 候補別記録

自己評価は5が最高。

| 保存ファイル | 方法 | 生成・保存サイズ | バイト数 | 再生成 | キャラの一貫性 | 場面の再現度 |
|---|---|---|---:|---|---|---|
| cand_6.png | 新規生成（立ち絵参照） | 1024 × 1536 | 2,449,896 | なし（初回採用） | 5/5 | 4/5 |
| cand_7.png | 新規生成（立ち絵参照） | 1024 × 1536 | 2,292,085 | なし（初回採用） | 5/5 | 4/5 |
| cand_8.png | 新規生成（立ち絵参照） | 1024 × 1536 | 2,428,700 | なし（初回採用） | 5/5 | 4/5 |

### cand_6.png の目視所見

顔・手指の明らかな破綻、別人化、文字混入なし。浅い弧のシーシャ用ボウルは10個。手前に別途、材料用の浅い小皿がある。腕の広がりは比較的控えめ。右端の器具は外周が一部画面端にかかる。

### cand_7.png の目視所見

顔・手指の明らかな破綻、別人化、文字混入なし。閉眼、口元の接続マウスピース、台上の器具、透明ベースの水・煙・泡を確認。吐煙は指定の「かすかな一筋」より多め。ベースは胸の真横より低めの位置。

### cand_8.png の目視所見

顔・見えている手指の明らかな破綻、別人化、文字混入なし。腕組み、椅子、画面左の赤と右の緑の器具を確認。器具の主要構成は描写されているが、外周・トレイやホースの一部が左右の画面端にかかる。

## 使用したプロンプト

各候補の本文は `prompts.md` の同番号の英語プロンプト全文を省略せず使用した。生成時には下記の共通指定を前置し、候補6のみ末尾に個数確認の指定を追加した。画像入力は全て `sprite_normal.webp` の1枚。

共通前置（候補7では閉眼の場面のため「amber brown narrow eyes, 」のみ省略）：

```text
Use case: illustration-story. Create a NEW title-screen illustration, portrait 1024x1536, using the attached sprite ONLY as the character identity and clothing reference. Match his angular adult face, amber brown narrow eyes, strong brows, swept short center-part hair, athletic proportions, rolled black Henley sleeves and tied black waist apron. Do not reuse sprite pose or blank background. Follow this scene specification in full:
```

候補6の追加末尾：

```text
Count exactly TEN bowls across a SINGLE shallow arc; ensure every one is distinct and countable. The full hookah is additional to these ten bowls. No lettering anywhere.
```
