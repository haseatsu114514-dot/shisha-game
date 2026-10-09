# 本編に入れた3つのトランジション：実際のゲームの録画（2026-10-09）

オーナー「再開して　あとモーショングラフィックス実際にみてみたいです」（CI102）。[場面ごとの提案](../scene-plan-20261009/README.md)で最初に作る候補にした3か所を `remake/` に組み込み、実際のゲームをヘッドレスのChromiumで動かして録画した。各動画は前半が実際の速さ、後半が同じ場面の0.5倍速。音は入っていない。

| 動画 | 場面 | 動き |
|---|---|---|
| [1_map_to_place.mp4](1_map_to_place.mp4) | DAY3 昼、大須マップで tonari のピンを押す | 押したピンの位置から紫の円が広がって覆い、中央の葉の形の窓が開いて店の中が出る |
| [2_night_to_morning.mp4](2_night_to_morning.mp4) | DAY3 夜、家に帰って寝る → DAY4 の朝（雨） | 夜の紫が上から降り、DAY 3→4・あと11日→10日がめくれ、地平線が下から昇って朝の部屋が出る。雨の日は雨筋 |
| [3_venue_entrance.mp4](3_venue_entrance.mp4) | DAY14、大会会場へ入る | 逆向きのリボン2本が交差して画面を覆い、「SMOKE CROWN CUP」を打ち込む。覆っている間にロビーの絵と待機BGMへ替える |
| [4_round_1.mp4](4_round_1.mp4) | ROUND 1 の見出し | 同じ交差で「ROUND 1／組み立て」。ラウンドごとにリボンの色が変わる（1＝紫、2＝ピンク、3＝水色） |

## 実装

- `remake/js/core/transitions.js`: 開口（`pinCurtain`）、夜明け（`nightToMorning`）、交差（`crossCut`）。画像を使わずSVGとCSSの図形で描く
- マップで行き先を決めると `cueTransition("pin", 位置)` で次の背景切り替えだけがピンから開く。3秒以上たった予約は使わない
- 就寝は DAY13 まで夜明けの幕。DAY14 の大会当日は従来の暗転と当日のDAYカードのまま。夜明けでDAYを見せた朝は、同じ日のDAYカードを重ねない。熱っぽい朝はカードが揺れ、「……熱っぽい」を同じ幕で出す
- `ui.roundCut()` を交差に置き換え、旧ROUNDの横帯のCSSを撤去。会場入りは `ui.crossWipe()`
- 覆っている間はEnter・Spaceを受け付けない。動きを減らす設定ではフェードだけ。ほかの背景切り替えは従来の幕のまま

## 確認

- `remake/test/playthrough.mjs` PASS（13回の日付の切り替え、大会の敗北→再挑戦→第1章クリアを含む）
- `remake/test/illness.mjs` PASS。main の時点で新しい依存（invitations.js ほか）のスタブが不足して起動できなかったため、スタブを追加した。初回・再発の発病の朝を夜明けの幕で通す
- 録画中のブラウザエラーはこの変更によるもの0件。大会の制作画面で `ui_craft_panel.webp`・`ui_craft_button.webp` の404が出るが、main の既存の不具合（CSS変数の相対URLが `remake/css/` 基準で解決される）で、この変更とは別
