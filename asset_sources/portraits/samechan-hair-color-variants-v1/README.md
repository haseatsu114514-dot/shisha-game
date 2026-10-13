# サメちゃん：濃い青インナー採用

オーナー「１個目の青インナーが濃いめなやつがいい感じ　これを採用しよう」により、①の黒髪＋濃い青インナーを採用デザインとして固定した。①の原画は再生成せず、そのまま使用。同じ配色を既に依頼された腹話術へ合わせた。

- [採用デザインの通常・腹話術](selected-comparison.png)
- [暗背景で確認](selected-comparison-dark.png)
- [髪色の比較履歴](comparison.png)

| 画像 | 元画像 | 全身確認 | 状態 |
|---|---|---|---|
| 通常 | [PNG](ocean-blue/source.png) | [PNG](ocean-blue/preview.png) | ユーザー採用の① |
| 腹話術 | [PNG](ocean-blue-ventriloquism/source.png) | [PNG](ocean-blue-ventriloquism/preview.png) | 採用配色へ統一。顔はコロちゃんで全て隠す |
| 青紫インナー | [PNG](blue-violet/source.png) | [PNG](blue-violet/preview.png) | 未選択の比較履歴 |
| 淡グレーインナー | [PNG](ash-gray/source.png) | [PNG](ash-gray/preview.png) | 採用回答前に実行済みだった生成の履歴 |

アッシュブラウン案は①採用により未実行。`ash-brown/prompt.txt` は未実行の計画で、生成記録ではない。[計画と結果](plan.json)。

衣装は指定画像の黒／チャコール＋淡い水色＋アイボリー。髪型・本人の青い半目・ギザ歯・通常の仕草・コロちゃんを保ち、髪の内側を青くしてフードや襟と分けた。各髪色案は同じ本人原画から独立して生成。腹話術は以前の顔を隠す姿勢を本人参照として配色だけ合わせた。生成に伴う微細な線の差はある。

[PR #206](https://github.com/haseatsu114514-dot/shisha-game/pull/206) の `9f913b9`、`selected-outfit-black-hair-v3/normal` が元の本人参照。[来歴とSHA-256](references/provenance.json)。腹話術の本人参照は同じPRの同じデザイン。全4回に採用済みみんと／あげはの実PNGを画質参照として添付。通常3案は [実参照一覧](references/generation-references.json)、腹話術は [実参照一覧](ocean-blue-ventriloquism/references.json)。

各フォルダの `source.png` は生成出力をバイト一致で保存。`prompt.txt`・`generation.json` に実行文・実参照・ハッシュ・共通倍率・足元配置を記録。ライブラリの原画は保持。全体の縮小・RGBA配置・原寸切り抜き・背景への確認用合成だけを行い、手作業の色変更・描画・顔合成・アルファ閾値加工はしていない。`build_review.py --archive <slug> <raw-path>` と `--assemble` で配置・髪色比較を再作成できる。

[検証記録](validation.json)：原画RGBA・バイト一致、端にalpha>=16なし、通常と腹話術の共通倍率と足元下端1174px、横アンカー差1px未満。顔の遮蔽、顔・髪・服・透過端を原寸、白／暗背景で確認。

採用した通常は[キャラ別アニメーションのモックアップ](../../character-intros/personality-v2/README.md)にもそのまま使用。今回の採用はデザインの確定で、ゲーム用5表情の置換・WebP・アイコン・manifest・台詞は未変更。

保存用PR：[#208](https://github.com/haseatsu114514-dot/shisha-game/pull/208)。ゲーム本体へは未反映。
