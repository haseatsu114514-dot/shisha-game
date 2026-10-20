# 初回のなる・アダムとのLIME交換（#705 / #701 元6・30）

BASE: main `97dba200e6b62ecde73ea69bc66183f96be86211`。
WORKER: `codex-701-holes-20261019-01`。オーナーが今回限りの未予約・他担当非重複作業の予約省略を明示許可。予約取得済みとは扱わない。

## ゲームでの変更

なる・アダムの初回固有会話の最後に、既存の交換台詞とLIME交換演出を接続する。なるは「LIME交換しとこうぜ」の軽い誘い、アダムはリンゴと求道者の人物像を保つ。顔・名前と「連絡先がつながった」を表示する既存演出を再利用し、二重の交換UIを作らない。

なるの2回目とアダムの従来の交換回は、未交換の旧セーブだけで交換する互換経路として残す。既に連絡先がある旧セーブは訪問開始時に既存フラグへ同期し、再交換の台詞・演出を出さない。訪問回数のしきい値を下げて既読だけから新しい交換を捏造しない。レシピの取得回・好感度・能力・訪問費用・時間・他人物の交換時期は変更しない。

## 検証

- `early_contacts_705.mjs`: PC/844×390タッチの8/8ケースPASS。両人物の本番 `visitChar` と本番台本を使い、新規の初回交換、旧セーブの未交換経路、contactsのみを持つ旧セーブ、SAVE/LOAD、後日の重複抑止と一人一件を確認。
- 同じ8ケース内で、本番の初回台本に入れた交換分岐を手動キー/実タップで送り、既存演出の名前・顔・文言を目視確認。全会話の通常送り通しではなく、交換部分の実操作と演出の隔離検証。
- `node --experimental-vm-modules remake/test/lime_consistency.mjs`: PASS。
- `node remake/test/text_wrap.mjs`: 全6537テキストPASS。台本リンタは両ファイルERROR 0。WARNは既存箇所のみ。`tidy_dialogue_text.py --dry-run`: 変更対象0行。
- Git Safety / agent docs / diff check: PASS。

交換部分のスクリーンショット: [PCなる](early-contacts-705/pc-naru.webp) / [PCアダム](early-contacts-705/pc-adam.webp) / [タッチなる](early-contacts-705/touch-naru.webp) / [タッチアダム](early-contacts-705/touch-adam.webp)。

未実施: 実機Safari、公開版、NEW GAMEから配達までの自然到達通し。通常の交換演出を実操作で確認したが、全台本の実時間AUTO/SKIP通しは未実施。CI/レビューはPRへ記録する。
