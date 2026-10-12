# Issue #382: 恋人デートの導線監査

対象main: `a98636f84ada6a2d8637b8d65f2eb9d38ea4f152`。worker `codex-priority-20261012-01a12f11`、claim run `38219404533` SUCCESS。PR #275のデートを再制作せず、PR #379が編集するLIME/calendar/map/invitationsを変更しない。

## 検証の境界

`lover_date_route.mjs` は**恋人になったセーブを準備したUI検証**である。新規ゲームから交際までを通した証拠ではない。PCは1280×720のクリック、スマホ横持ちは844×390のChromiumタッチエミュレーションでtapする。実機スマートフォンでは未検証。

6人それぞれ、セーブから本番`resumeGame()`を再開し、本番カレンダーで朝の招待を受信する。HUDのLIME→トーク→画面で承諾→予約→昼に家で休む→仕事後のデート→画面で選択→報酬→翌朝のオートセーブを通す。デート関数を直接呼ばない。PCはA、タッチはBを選ぶ。表示待ちと選択肢の収まりを確認し、デートが一度だけ起き、予約が消費され、報酬・lastDateが保存されることを検査する。ましろはschema5から移行し、タイトルのロード操作でも再開する。

周辺会話はテスト用turbo、デートはturboを解除し、瞬時文字表示設定でクリック/tapして進める。ミニゲームはテスト用自動解決を利用する。日付・報酬・既読・予約を導線の途中で書き換えない。計測フックは本番フックへ委譲し、イベント回数と台詞を記録する。

保留→トーク再開→辞退はLIME画面操作。期限切れ、古い予約、同じ朝の重複配信、未定義ID、固定イベント日の回避、定休日の午後、MAX後の5日間隔は**状態を準備したAPI境界検証**として扱う。未定義IDでは全状態・会話ログが不変で、エラー1件だけになることを確認する。

現行の成長仕様は`paidAction()`と`invitationGrowth()`による「招待は主能力1つへ2P」。主能力のあるキャラはその能力を優先し、主能力のないましろ等はデートの選択肢が能力候補になる。旧台本のstatを全員そのまま+2する期待値を使わない。好感度の代わりに私的な恋人絆が増えることも検査する。

## 再現

```sh
python3 remake/tools/serve_preview.py --port 8123
node remake/test/lover_dates.mjs
node remake/test/browser/lover_date_route.mjs
```

Playwrightは`remake/test/browser/package-lock.json`に固定。ローカルChromeは`CHROME_EXECUTABLE_PATH`、公開版は`BASE_URL=https://haseatsu114514-dot.github.io/shisha-game/remake/`で指定する。`TEST_CASES=mashiro`でましろのPC/タッチだけを選べる。

結果JSONと画面は`.codex/artifacts/remake-browser/`、CIは`remake-browser-results` artifactに保存する。検証結果・公開版の結果は本IssueのコメントとPRに記録する。

## 実行結果

ローカルの最終14ケースはすべてPASS（6人のUI×PC/タッチ=12、境界検証×PC/タッチ=2）。[結果JSON](local-results.json)。ブラウザ例外・失敗リソースは0件。データ6人、JSON64件、会話リンク422件もPASS。会話リンクの既存重複ID警告は1件。

公開版でもましろのPC/タッチ2ケースがPASS。[公開版結果JSON](public-results.json)。公開ゲームのセーブを開かず、独立ブラウザcontextのfixtureで実施した。

| 公開版の操作 | PC 1280×720 | 横持ちタッチ 844×390 |
| --- | --- | --- |
| 招待を読む・返信ボタン | [画像](screenshots/pc-invitation.png) | [画像](screenshots/touch-invitation.png) |
| デートの選択肢 | [画像](screenshots/pc-date-choice.png) | [画像](screenshots/touch-date-choice.png) |

画像を目視し、文字・返信・選択肢が画面内に収まり、ましろの立ち絵と場面が表示されることを確認した。CI/マージの最終状態はPR #413を参照する。

## 口調・人格の照合

`brand/character_profiles.md`のましろは第3章mukaiの同僚。22歳でゆるい同期の距離感、一人称「僕」、呼称「はじめくん」、おっとりした口調、重い葉の好みを持つ。`dates.mashiro`は一緒に座って過ごす穏やかなデートで、煙の好みと本人と過ごす時間を両方選べる。能力や味から魂・人格を判定する描写ではない。既存6人のデータ検査と実際に表示したましろの台詞の検査で呼称・一人称を確認する。

## 未完: 新規ゲームからましろとの交際

現在の`remake/js/chapters`の本編は第1章のみ。`core/data.js`の読み込みにも`ch3_mashiro`がなく、`VISIT_SEQ`と`BOND_FINALES`にもましろが登録されていない。READMEは第2章以降を未接続と明記する。ましろの第3章の共有台本が存在することは、現在のゲームから読めることを意味しない。

従って**通常の新規ゲームからましろと恋人になる経路は未接続**。この監査で新章・人物設定・恋愛ゲートを推測追加しない。保存済み恋人からの導線と回帰が通っても、Issue #382全体はopenを維持する。次の担当は第3章の本編接続後、新規ゲームからの初対面→交際→デートを追加検証する。
