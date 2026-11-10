# 第2章バイト接客イベントの条件修正結果（2026-11-10）

基準: `origin/main` `a150c7f813a02c60b37b582ad0a5977459b365d2`。作業ブランチ: `codex/baito-fixes-1110`。`data/baito_events.json` の条件のみを変更し、台詞・選択肢・結果文は変更していない。

| 状態 | 修正前 | 修正後 |
| --- | --- | --- |
| 第2章、「残る匂い」既読、食事回未読 | 次のシフトで優先選出 | 同じく優先選出 |
| 食事回を読了し、`usedBaito` に記録されたセーブ | 未読の通常回があればそれを選出。食事回自体は適格候補に残る | 食事回は適格候補から除外 |
| 食事回と通常回がともに既読で、未読候補が枯渇 | 食事回が再選出され得る | 通常回だけが再選出可能 |
| 食事回だけが候補で、食事回は既読 | 食事回が再選出され得る | 定型接客にフォールバック |
| 第2章 DAY1、試煙会前の苺回 | 抽選対象 | 抽選対象外 |
| DAY9 試煙会読了、試供品受領前の苺回 | 抽選対象 | 抽選対象外 |
| 試供品受領場面 `ch2_strawberry_sample` 読了後の苺回 | 抽選対象 | 抽選対象（一度のみ） |

食事回は `once: true` を追加し、既存の `usedBaito` による除外を適用した。苺回は `trigger_flag: _ch2_read_ch2_strawberry_sample` を追加した。このフラグは DAY9 の試供品受領場面の再生完了後に立ち、同じ処理で試供品も付与される。追加した `daily_consistency.mjs` の回帰テストは、実際の `tonari.js` のシフト選出経路で上記の境界を検証する。

## 検証

- `node --experimental-vm-modules remake/test/daily_consistency.mjs`: PASS
- `node --experimental-vm-modules remake/test/ch2_strawberry_trial.mjs`: PASS
- `node remake/test/ch2_ageha_story.mjs`: PASS
- `node tools/ci/run.mjs --kind quick --suites data-smoke`: PASS（1.8分、1/1 suite、retry なし）。`audit_dialogue_art.py` の参照 WARN は助言で、スイートは成功。
- `git diff --check`: PASS

保護 PR #742 #736 #1103 #1098 の変更は行っていない。PR は Ready for review とし、マージしない。
