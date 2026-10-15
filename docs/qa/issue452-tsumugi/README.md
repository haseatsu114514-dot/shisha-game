# #452 B・つむぎの下描き回答と完成作

WORKER: `codex-tsumugi452-20261015-3d1c4d7902`
BRANCH: `codex/452-tsumugi-draft-response-20261015`
基準main: `507809c3685a76d0853a3ca3da8c4150fb4e9f8b`。クラウドLinuxのみで作業。

[claim 38697374168](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38697374168)・[status 38697755994](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38697755994)のmain/completed/success、実ログのCLAIMED_ISSUE / CLAIM_VALIDATED_ISSUE、ownerとclaim runの一致を読み取り検証した後に編集。[最新bot台帳](https://github.com/haseatsu114514-dot/shisha-game/issues/452#issuecomment-6186659359)も同じowner/run。再claim・releaseはしていない。

既存 `tsumugi_contest_draft` の二択を選んだ時だけ、章の既存onChoiceフックで回答flagsを排他的に保存する。途中で閉じても、回答保存を読了や応募完了とは扱わない。実際に選び直した場合は最新の回答に更新する。読了・訪問回数・好感度から回答を復元しない。

`ch1_tsumugi_sketch` の既存2行を回答別の2行へ差し替えた。窓辺なら煙と猫を残した話、手元ならカウンターを描き込んだ話で受け止める。未回答は既存の地の文と返答をそのまま使う。既存CG・応募・記憶・好感度保証・友情／恋愛の条件は共通のまま。新しい選択肢やCGはない。

実装前にOpen/Draft PR #481/#539/#550/#557/#558/#566の全変更ファイル（各55/29/11/3/3/1件）を照合し、今回の変更予定パスとの重複なし。`ch1_main.json` 内の変更場面はこの完成作だけ。下描きJSON、map.js、bonds.js、bonds.mjs、常連接客、A/C、全体添削#564は変更していない。

## 検証

Chromium 154.0.8037.57。PC 1280×720／横持ちタッチ844×390のエミュレーション。実VN・本番保存API／枠選択UI・実クリック／タップ／SKIPを使用。場面の準備は固定fixtureから行い、NEW GAMEからの全章通しとは区別する。

- 専用ブラウザ **8ケースPASS**。両回答／未回答 × 友情・恋愛・関係未回答 × 完成作既見・初見の18経路を含む。完成作の全ゲーム状態を基準JSONの場面と比較（保存時刻だけ除外、同じ♥2保証を適用）。CG解放・応募・記憶・報酬を含め一致し、再実行は状態不変・追加発話なし。
- 旧schema13で下描き読了・高好感度・多い訪問回数があっても、回答flagsを補わず中立文。両回答の実選択→保存枠→ブラウザ再読込→LOAD後も回答を区別。SKIPは二択で停止し、未選択の間は回答なし。選択直後のオートセーブは読了を前倒しせず、実際の再選択は反対側の回答を消す。
- PC／タッチの全6経路でクリック数を比較。回答台詞は既存CG表示中に収まり、PC・タッチの原寸スクリーンショットを目視確認。
- `relationship_memories.mjs`: 6人物の経路・分岐・再読・旧セーブ等PASS。
- `affinity_gates.mjs`: PC／タッチ **10ケースPASS**。♥3停止と実回答後の解放、友情／恋愛、応募前後の締めくくり、再加算防止を含む。
- `save_load.mjs`: **6ケースPASS**。全保存枠、旧セーブ、破損データ、PC／タッチの保存・再読込・再開UI、縦横回転。
- 既存 `issue508_theme.mjs` の6場面18経路比較PASS。回答直後の保存で変わる時刻だけを下描き場面に限って別途検証し、その他の全ゲーム状態の一致と他場面の検査は維持。
- 対象会話lint ERROR 0 / WARN 6（既存のみ）、JSON解析、JS構文、`check_agent_docs.py`、diff check、Git Safety PASS。`tidy_dialogue_text.py --dry-run` は対象外の既存oneesan台詞1行だけを提示し、今回の新規台詞に指摘なし。

初回計測は、CGをCSS背景ではなくimg要素と扱うテスト側の前提誤りを見つけて中断。修正後の専用8ケースを省略なしで再実行した結果が以下の記録。

既存の6場面比較も追加実行し、下描きの実回答を保存する処理による `savedAt` の更新だけで初回FAILを再現した。下描き場面のみ保存時刻が更新されることをassertし、時刻以外の全フィールド比較を維持して再実行PASS。[初回失敗](existing-theme-initial.txt)／[修正後の18経路比較](existing-theme-fixed.txt)。ゲーム状態・報酬のassertは削除していない。

### クリック数

文字速度「全表示」、AUTO/SKIPなしで計測。同じ準備状態・同じ回答を基準JSONと変更後で実行。基準JSONは上記mainの2場面の原文で、同一の現行VNレンダラーを使用。1ページ送りを1回とし、選択・保存UIの操作は分離する。

| 端末 | 下描き回答 | 下描き送り 前→後 | 選択 前→後 | 完成作送り 前→後 |
| --- | --- | --- | --- | --- |
| PC | 窓辺の煙と猫 | 28→28 | 1→1 | 26→26 |
| PC | カウンターの手元 | 28→28 | 1→1 | 26→26 |
| PC | 未回答旧セーブ | 読了済みのため再生なし | 0→0 | 26→26 |
| タッチ | 窓辺の煙と猫 | 28→28 | 1→1 | 26→26 |
| タッチ | カウンターの手元 | 28→28 | 1→1 | 26→26 |
| タッチ | 未回答旧セーブ | 読了済みのため再生なし | 0→0 | 26→26 |

場面を増やしていないため、既読の再訪圧縮やマップ滞在時間は今回の変更対象外。壁時計によるプレイ時間、全14日手動通し、実機スマートフォン／Safari、公開版QAは未実施。`bonds.mjs` は変更・実行せず、並行PR #566の範囲を保持した。マージ・公開・Issue終了は行わない。

## 記録と再実行

[基準2場面](baseline-scenes.json)・[専用8ケース結果](tsumugi-draft-response.json)・[ブラウザ計測ログ](browser.txt)・[関連回帰ログ](regressions.txt)。

| 回答 | PC | タッチ |
| --- | --- | --- |
| 窓辺の煙と猫 | [原寸](pc-tsumugi-answer-0.png) | [原寸](touch-tsumugi-answer-0.png) |
| カウンターの手元 | [原寸](pc-tsumugi-answer-1.png) | [原寸](touch-tsumugi-answer-1.png) |
| 未回答 | [原寸](pc-tsumugi-answer-null.png) | [原寸](touch-tsumugi-answer-null.png) |

```sh
python3 remake/tools/serve_preview.py --port 8123
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/tsumugi_draft_response.mjs
CHROME_EXECUTABLE_PATH=/usr/bin/chromium NODE_PATH=./remake/test/browser/node_modules node remake/test/relationship_memories.mjs
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/affinity_gates.mjs
CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/save_load.mjs
CHROME_EXECUTABLE_PATH=/usr/bin/chromium CASE_FILTER=six-scenes-branches-old-save-and-state-effects node remake/test/browser/issue508_theme.mjs
python3 tools/lint_dialogue.py ch1_main
python3 tools/tidy_dialogue_text.py --dry-run
python3 tools/check_agent_docs.py
```

NEXT: Draft PRで対象差分と実headのCIを確認し、オーナーのレビューを待つ。予約は保持する。
