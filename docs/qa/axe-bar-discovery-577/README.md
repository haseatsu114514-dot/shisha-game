# #577 BARの発見・匿名目撃・正式初対面のQA

PR #657。承認済み限定案2を実装。worker `codex-577-limited-20261018-3a8c921e`、claim [39079097054](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/39079097054) SUCCESS、[bot台帳](https://github.com/haseatsu114514-dot/shisha-game/issues/577#issuecomment-6243068724)のowner/run一致を確認。

基準main: `bac72b40c38ac0d4b6982da7d2eeb517ce746cdb`（#580・#654統合後）。
実装SHA: `1d9f1aa2cd71c1391ecf626c199315a0f7ad33fc`。
テスト補正SHA: `13e019b5dc452cca1a986072c2f8915f19746732`（VM読込先・旧保存期待値・シフト完了待ちのみ）。両SHAの`remake/js`・`data`は同一。

- `remake/js` tree: `b8534c3863cda6bb642fed2794ba2c28f25f0238`
- `data` tree: `741e739ad590c80e7f4e094b90870529abe9a54f`
- 環境: Linux、Node 24、隔離Chromium `/usr/bin/chromium`、本番preview `http://127.0.0.1:8817/remake/`。
- PC 1280×720、タッチ相当844×390。物理端末/Safari・公開URLへの反映は未検証。

## 再現手順と受入結果

1. NEW GAMEからtonariへ行き、客席・バイト・スミとの会話の既存入口で噂を完読する。噂前はBARが未発見、完読後は夜の地図から入れる。
2. BARに実来店し、無名の女性の険しい表情と巧みな斧投げを短く読む。名前・立ち絵・本心表示・正式な紹介は出ない。目撃を完読して無料で帰る。有料ソロ/レッスンは完走しなくても記録される。
3. 同日は正式初対面の予定が出ず、直接呼出しでも初対面しない。翌日以降、共通予定が示すシーシャ店で正式初対面し、「どこかで見たような」程度の一言を読む。従来の紹介・連絡先・以後のイベント順を保持する。
4. 噂・目撃だけでは料金、体力、行動枠、能力、面識、連絡先、好感度、物語、記念品、通常交流日付、正式読了を変更しない。目撃完読は無料帰還・手動SAVE/LOAD・オートセーブ再LOAD後にも保持する。
5. 噂/目撃の完読前に中断する。目撃中の別セーブLOAD、日・時間帯・章変更、画面離脱、pagehideでも完了・目撃日を付けず、旧stateから現在の保存へ書き戻さない。
6. 所持金0でも目撃は読め、ソロは押せず、無料帰還できる。次の日に再入店しても目撃は再生せず日付も更新しない。
7. schema 7/13/14/15の未訪問/訪問済み×未対面/対面済みをLOADする。BAR利用を保持し、旧未対面はBAR抜きで初対面できる。移行だけで噂・目撃・面識・報酬を補わない。再保存/再LOADでも互換許可を保持。対面済みには目撃を後付けしない。

| 検証 | 結果・証拠 |
|---|---|
| 判定、schema移行、実リソース保持、再保存、台本境界 | 20/20 PASS: [core.txt](core.txt) |
| 実VN・入口・SAVE/LOAD、PC通常/タッチSKIP/AUTO、7種中断、所持金0、旧対面 | 12/12 PASS: [discovery.json](discovery.json)、検証refは実装SHA |
| 既存好感度保留/救済・LIME・有料行動・保存、PC/タッチ | 4/4 PASS: [hiyori-gate.json](hiyori-gate.json)、実装SHA |
| 共通予定・シルエット・旧保存・複数ゲスト・営業時間、PC/タッチ | 4/4 PASS: [map-guests.json](map-guests.json)、実装SHA |
| 旧ルートの店舗/前提/有料地図/遭遇SAVE/LOAD/LIME拒否再送/再会/期限/衣装 | [初回結果](legacy-encounters-initial.json)は7/8 PASS。シフトケースだけは下記の待機補正後に単独PASS。料金・関係assertは維持 |
| 客席/バイトからスミ連絡 | [sumi-shift.json](sumi-shift.json)、テスト補正SHAでPASS |
| 正式初対面の名前紹介・表示 | 既存`hiyori_intro.mjs` PC/mobile/reduced-motion [3/3 PASS](hiyori-intro.json) |
| 既存ひより台本・交流・告白/友人・プレビュー保存隔離 | 既存`hiyori.mjs` [9ケースPASS](hiyori-foundation.json) |
| 既存店舗の料金/記録/SAVE/LOAD・20種の完走/中断/旧施設 | [20/20 PASS](play-spots.json) |
| 既存日常・休養・体力/制作・TRPG旧保存 | [VMテストPASS](vm-regressions.txt)（43種不正TRPGのauto/manual LOADを含む） |
| データ/台本 | JSON78ファイル、619台本のリンク検査PASS。データ読込37件・同時最大4・異常/timeout PASS。台詞lint ERROR0/WARN327（既存warning数を維持） |

初回CIでVMテストが新規coreモジュールを同名dailyモジュールとして読み込む失敗と、TRPGテストのschema15固定値/移行フラグ期待値不足を検出。対象テストの読込先と期待値を補正した。ブラウザのシフトケースは10秒で全接客・配達・演出の完了前にタイムアウトしたため、シフト後メニュー出現の上限だけ30秒とした。ゲームの速度、台本、assertは変更していない。

## NEW GAME通し

既存`hiyori_axe_natural.mjs`を新しい順序に追随。種だけ固定し、進行フラグ・好感度・資金は注入しない。噂/目撃/ひより台本は通常のクリック/タップで進め、他台本は既存turbo、制作は既存autoを利用する自動QA。既存の有料訪問、♥3保留・救済、LIME、斧の後払い/行動枠assertと8分制限を保持。

PCはDAY9・好感度59・救済1で正式な斧イベントまでPASS。[natural-pc.json](natural-pc.json)は元JSONのまま保管（開始時は未commit、後に実装SHAとして保存した同じruntime/runner内容。元runnerにref欄はないため、SHA取得済みの上記専用suite結果と区別する）。

タッチもDAY9・好感度59・救済1で正式な斧イベントまでPASS。[natural-touch.json](natural-touch.json)は実装SHAで開始し、実行中のテスト補正SHAによるruntime変更はない。両条件とも噂DAY2→目撃DAY3→初対面DAY4→正式斧DAY9を確認。

`ref`がnull/未実装の既存runner記録は開始時の同じ実装内容に対応し、取得済みのrefを持つ専用suite記録とは区別する。画像/JSONはfresh contextのQAデータのみ。

## 画面

[PC:噂](pc-rumor.webp) / [PC:匿名目撃](pc-sighting.webp) / [PC:正式対面](pc-meeting.webp) / [タッチ:匿名目撃](touch-sighting.webp)

## 担当境界と再実行

#540/#578の旧予約・ブランチ・成果は保持。旧環境の停止・差分なし・成果保全完了は未確認。後から旧成果が見つかれば保全して照合する。#574/#579の地図描画・ロゴ/CSS、他3施設、#644全体口調、投擲/相手/報酬へ広げていない。家の葉消費は#655の作者の範囲として変更していない。

```sh
python3 remake/tools/serve_preview.py --port 8817
# 別shellから（Playwright/Chromiumは既存環境を利用）
export BASE_URL=http://127.0.0.1:8817/remake/
export CHROME_EXECUTABLE_PATH=/usr/bin/chromium
export TEST_REF=$(git rev-parse HEAD)
export ARTIFACT_DIR=.codex/artifacts/remake-browser/axe-bar-discovery
node remake/test/axe_bar_discovery.mjs
node remake/test/browser/axe_bar_discovery.mjs
node remake/test/browser/hiyori_gate.mjs
node remake/test/browser/map_guests.mjs
node remake/test/hiyori_encounters.mjs
node remake/test/browser/play_spots.mjs
ONLY_DEVICE=pc node remake/test/browser/hiyori_axe_natural.mjs
ONLY_DEVICE=mobile node remake/test/browser/hiyori_axe_natural.mjs
```

## PR657 営業時間CIの前提補正

旧HEAD `9b6544069ce7f71ac17dfa016cac0859989218cd`の[venues失敗run39080567032](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/39080567032/job/117536545558)は、営業時間テストが新規状態のBARを解禁済みとみなしていたため、昼の理由が「夜」ではなく`locked`になり、夜も店頭UIへ進めない4ケースで失敗した。ソロ等20ケースは同じCIでPASS。

修正は営業時間専用fixtureへ噂・実目撃の完読記録/実日付を設定するだけ。runtime・営業時間/料金/保存assert・新規の発見条件回帰は変更していない。修正SHA `df11d0e3`で実ブラウザPC/タッチ計10/10 PASS: [元結果JSON](venue-hours-ci-fix.json)。`node remake/test/venue_hours.mjs`の20assertもPASS。既存Chromiumと素材キャッシュのみ使用。

## 再CIで検出したTRPG表示停止テストの同期

[preview job117544980599](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/39083442763/job/117544980599)で、CSS一時停止直後の時刻比較が1フレーム（約16.7ms）ずれる失敗を検出。対象previewのruntime/testはmainと同じ内容で、#577の施設解放判定はこのstandalone表示に関与しない。既存Chromiumと素材キャッシュのshark 3ケースに絞った未修正実行でも、同じ停止時刻の差を再現した。

CSSによる停止の反映前に時刻を記録していたため、Web Animationsの`Animation.ready`を待ってから基準時刻を取るようテストだけを補正。固定sleep追加・timeout延長・許容誤差への変更はなく、100ms後の時刻完全一致、判定/資源不変、保存隔離、操作/表示assertは維持。TRPG本体/CSS/データは変更していない。

修正後はordinary 3/3・shark 3/3 PASS（PC操作・横持ちタッチ・縦持ち・reduced-motionを含む）。[修正前の失敗と修正後の元結果、検証SHA](trpg-paused-effects-ci-fix.json)。本件はPR657のCIテスト補正で、#556のrunner・claim・Issueは変更していない。
