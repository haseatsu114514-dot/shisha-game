# 制作画面・シンプルなキッチンタイマー（2026-10-08）

オーナーのGP18〜26。制作に集中できる画面、見守る人物、顔で伝える体調、10秒単位のタイマー、弾幕中の温度と吸い出しの難易度を実装する。

## 採用タイマー

![実際のボタンと7セグ表示](timer-tutorial-desktop.png)

- 採用原画: [assets/ui/making/kitchen_timer.png](../../../assets/ui/making/kitchen_timer.png)。1536×1024の透過PNG。最終生成画像をそのまま保存
- 実行時: [remake/img/ui/making/kitchen_timer.webp](../../../remake/img/ui/making/kitchen_timer.webp)。`python3 remake/tools/build_manifest.py`で可逆WebPと透過領域の境界を生成
- 生成指示: [kitchen-timer-final-prompt.txt](kitchen-timer-final-prompt.txt)。100均にあるような白い本体と灰緑の液晶、下段4ボタン。スタート＆ストップだけ幅広の薄緑。数字・文字は原画へ焼き込まない
- 配線: `remake/js/craft/timer.js`・`digital-clock.js`。520×348の本体枠の液晶へ7セグ数字を重ね、ボタンの中心は横15%／34%／60%／85%、縦75%。文字とクリック範囲も同じ位置に置く
- 分は1分ずつ、秒は10秒ずつ増える。分は99→00、秒は50→00へ戻る。リセットで00:00にし、0秒では開始できない。弾幕に移った後もストップ／スタートで時間・温度・弾幕を中断・再開できる

最初の飾り付き案と4つの等幅ボタン案は、依頼の追加指定で不採用。[装飾付き原画](kitchen-timer-decorated-superseded.png)・[等幅4ボタン原画](kitchen-timer-four-equal-buttons-superseded.png)と各プロンプトは生成履歴としてのみ保存し、実行時に読み込まない。

## 制作と見守る人物

![成功を見守るスミさん](sumi-heat-desktop.png)

![大会の実際の審査員](judges-heat-desktop.png)

左側ははじめと台を収める広い作業風景。練習のスミさん、大会の南雲・前園・チャコール博士が下段で見守る。顔は既存の立ち絵差分で、成功やミスに反応する。南雲は静かに考える表情にとどめ、人物名の開放・票・好感度を変えない。体調は名前の横の顔アイコンを押すと説明が開く。

動画は読み込まない。`.bench-worker-stage`と`data-step`を残し、今後ここへ作業演出を接続する。

## 温度・操作の表示確認

![PCの温度計と移動パッド](steam-desktop.png)

![スマホ横向き](steam-mobile.png)

![スマホ縦向き](steam-portrait.png)

弾幕と吸い出しは同じ温度計・適温帯。温度は蒸らしの経過時間で上がり、被弾では下がらない。最後の温度を次工程へ引き継ぐ。弾幕で集中できたほど、吸い出しの成功帯が広く、針の移動がゆっくりになる。

`remake/test/craft_focus.mjs`で実ボタン・7セグ・停止と再開・温度上昇・引継ぎ・成功帯と針速度・表情・体調アイコンを確認。1280×720、844×390、591×1280で左枠・見守る人物・温度計・弾幕・パッド・実況欄が重ならないことを確認する。
