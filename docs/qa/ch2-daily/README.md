# 第2章DAY2〜3の日常 QA

Issue #514 / PR #524 / 2026-10-13 JST。初日終了の「翌日へ」からDAY2〜3の自由行動を追加する。DAY4の朝で制作境界へ止める。独立試遊には日常を混ぜない。

## 再現

```sh
python3 remake/tools/serve_preview.py --port 8123
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/ch2_daily.mjs
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/ch2_main.mjs
node remake/test/ch2_progress.mjs
node --experimental-vm-modules remake/test/lime_consistency.mjs
```

本編の通常保存・本番ボタンを使い、専用の初日完了fixtureから試す。物理スマホ・Safari・第1章14日間の再完走とは分ける。ゲーム内の章内日と、大会までの日数を表示し、保存・来店日・交際開始日は通算日を保つ。旧手動保存の章内日による交際時計は互換を残す。

## 接続する内容

- 地元・隣町の地図切替、昼夜の2行動。切替だけでは料金・体力・行動・成長を消費しない。
- 地元は既存のtonari、ライバル店、仕入れ、休養、施設、SHISHARK・TRPGを共通calendarで使う。既存の料金・根性による体力補正・成長枠・スロット・就寝・LIME予約を維持する。
- 新しい4店は通常訪問料3,000円、体力消費の基準-16（既存の根性補正後の値を使う）。初回相談と再訪を分け、通常の成長上限2能力各1Pの中で処理する。未面識の名乗りは先に読み、元の固有会話カウンターを未読のまま進めない。
- あげはのLIMEは初回相談の読了後に交換し、翌朝に新しいメッセージを配信。未面識・未交換・第1章には出さない。
- 正史のDAY3夜は `ch2_naru_warm`。読了旗を残して二重再生せず、固定イベントとして料金・能力・スロットを増やさない。

## 検証状況

最終結果と画面は検証後に追記する。開発時に新テストの固定値が根性★2の体力上限110・消耗の補正と食い違っていたため既存ルールへ合わせた。分岐内の成長候補は会話エンジンの既存apply行として記録し、単なる台詞フィールドへ書かない。地図プレビューはCSS背景なので、画像要素を探す検査ではなく実際の背景URLと画像decodeを検査する。
