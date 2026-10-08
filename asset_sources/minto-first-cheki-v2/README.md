# みんとの縦型チェキ（PF70・PF71）

2026-10-08のオーナー指定で、横型の2ショットを縦型・みんと一人・落書き付きへ変更した。背景の実参照は現行の `assets/backgrounds/peppermint.png`。近くのみんとにフラッシュが当たり、店内はかなり暗く写る。

`original.png` は内蔵 `image_gen.imagegen` の無加工の最終原画。`portrait-before-background-edit.png` は縦型へ変更した最初の生成結果で、背景差し替え時の実参照。`prompts.txt` は2回の生成指示、`generation.json` は実参照とハッシュ。従来の横型原画は `../minto-first-cheki/original.png` に保存したままにする。

ゲーム内のCG ID／所持品IDは維持する。既に購入・ギャラリー登録したセーブでも新画像が表示される。白い縁や落書きを見せるため、会話では台詞ボックスの上に全体を収め、ギャラリーのサムネイルも切り抜かない。手書き文字とアルファを保つため表示用WebPは可逆圧縮する。

追加のプレイ検証・回帰テストはオーナー指示で省略。画像・manifestの生成とGitHubの公開結果は別に記録する。
