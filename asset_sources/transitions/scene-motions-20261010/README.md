# 場面ごとのモーショングラフィックス6つ：実際のゲームの録画（2026-10-10）

オーナー「作って欲しいのはチェキ、占い、贈り物、バイト、サメちゃん、スケッチあたり」（CI107）。[アイデアの一覧](../move-variants-20261010/README.md)から6場面を本編に組み込み、実際のゲームを動かして録画した。各動画は前半が実際の速さ、後半が同じ場面の0.5倍速。音は入っていない（ゲームでは既存の効果音を鳴らす）。

| 動画 | 場面（本編で出るところ） | 動き | 長さ |
|---|---|---|---|
| [1_cheki.mp4](1_cheki.mp4) | PEPPERMINT 初来店でチェキを撮る（`ch1_minto_first` の `cheki_taken`） | ファインダーの四隅がみんとに寄り、シャッターの羽根が閉じてフラッシュ。下からフィルムが出てきて、白っぽいところから色が出て現像される。現像し終えた写真がそのまま会話のCGになる | 約3.3秒 |
| [2_tarot.mp4](2_tarot.mp4) | 路上占いの結果（`remake_fortune_result`「カードを三枚、布の上に滑らせる」の直後） | 3枚の札が並び、真ん中の1枚が浮いてくるっと裏返る。占った相手の顔と名前の「縁」の札が光とともに出る | 約3.3秒 |
| [3_gift.mp4](3_gift.mp4) | 締めくくりの会話のあと、専用ハガルを受け取る前（`bonds.playFinale`） | 贈り主の色のリボンの箱が落ちてきて弾み、リボンがほどけ、ふたが跳ねて光の中からハガルが出る。贈り主と品名を表示 | 約4.1秒 |
| [4_shift_close.mp4](4_shift_close.mp4) | バイトのシフト終了の前（`tonari.js` の `baitoShift`） | 吊り札の OPEN と時計が出て、時計が早回り。札が CLOSED に裏返る | 約2.9秒 |
| [5_shark.mp4](5_shark.mp4) | サメちゃんとの夜道の出会い（`samechan.js` の `playSamechanEncounter`） | 水が満ちて画面が水中になり、泡の中をサメが横切る。水が引くと SHISHARK の店先 | 約2.4秒 |
| [6_sketch.mp4](6_sketch.mp4) | DAY12夜「閉店間際のtonari」のつむぎのスケッチ（`ch1.js` の `sketchScene`） | 方眼の紙に鉛筆が走り、店の絵が線画で描かれていく。紙と線が透けて色の付いた店になり、会話へ | 約3.1秒 |

長さには背景の読み込み待ちを含む。どれも一度きり、または章に数回の場面。

## 試し方

ブラウザのコンソールで `__remake.dev.motion("cheki")`（`tarot`・`gift`・`shift`・`shark`・`sketch`）。本来の背景と会話つきで再生する。今のセーブを上書きするので、試すときはセーブしてから。

## 実装

- `remake/js/core/scene-motions.js`: 6つの動き。チェキの写真・ハガル・背景以外は図形で描く。スケッチの線画は背景の絵からSVGフィルタで輪郭を取り出して作る
- `remake/css/motions.css`: 見た目
- 会話の中: `show_cg` に `"effect": "cheki"`、占いは新しい行 `{"type": "motion", "id": "tarot"}`（`vn/engine.js`）。台詞の正本は `ch1_minto.json` と `remake_ch1.json` の該当2行だけ変更
- 会話の外: `bonds.js`（贈り物）、`tonari.js`（バイト）、`samechan.js`（サメちゃん）、`ch1.js`（スケッチ）から呼ぶ。サメちゃんとスケッチは画面を覆っている間に次の背景へ替える
- SKIP中と動きを減らす設定では省く。会話の中の2つはテストの高速送りでも省く

## 確認

- 6つの動きをゲーム内で再生し、ブラウザエラー0
- `remake/test/playthrough.mjs` PASS（バイト・占い・DAY12の夜を含む第1章の通し）
- `remake/test/illness.mjs`・`remake/test/daily_consistency.mjs` PASS。`daily_consistency` は main の時点で新しい依存のスタブが不足して起動できなかったため、スタブを追加した
- `tools/lint_dialogue.py` ERROR 0（`ch1_minto` の WARN 9 は変更前から）
