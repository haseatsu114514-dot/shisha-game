# 凛（rin）v11の5表情と、Claude側への反映引き継ぎ

2026-10-04。**最新指示：通常v11のデザインを採用。Codexは残り4表情と立ち絵5枚を揃え、mainを取り込んだ指定ブランチへプッシュする。丸アイコン・台詞の表情・設定資料集・mainへのマージはClaude側。**

指定ブランチは `codex/rin-hair-texture-20261004`。PR #188のmain（`764211c`）を先に `b02ffc1` で取り込み、Claude側のアイコン・台詞・設定資料の変更を保持した。今回の要望はPRT26〜30。mainのPRT16〜25はそのまま残し、分岐中の旧8件はPRT31〜38へ番号を整理。

## 採用デザインと保存場所

[採用した通常v11](../.claude/skills/character-portrait-remaster/references/rin-style-v11.png)を再生成せず使用。青みの暗い髪、自然で控えめな毛束、胸下〜ウエスト上のロング、少し年上の半目とクールな微笑み、白シャツと黒スラックスを基準に、同じ本人と画風で残り4表情を制作した。

- [5表情の全身と顔の比較](../.claude/skills/character-portrait-remaster/references/rin-v11-five-review.png)
- [生成元・保存プロンプト・実参照とSHA-256](../.claude/skills/character-portrait-remaster/references/rin-v11-expressions-generation.json)
- [共通倍率・配置・PNG/WebPと表示の検証](../.claude/skills/character-portrait-remaster/references/rin-v11-integration.json)
- [通常v11の制作履歴](../.claude/skills/character-portrait-remaster/references/rin-style-v11-generation.json)
- [制作記録](../.claude/skills/character-portrait-remaster/references/review-status.md)

| 表情キー | 意味と仕草 |
|---|---|
| normal | クールな微笑み。保存済みv11を使用 |
| smile | 目を閉じて頬に手を添える、可愛いギャップの1枚 |
| serious | 指を一本立てて説明する |
| surprise | 控えめな「へえ」、胸元へ軽く手を添える |
| sad | 視線を少し落とし、袖を軽く握る静かな弱さ |

5枚を `assets/sprites/characters/rin/chr_rin_{normal,smile,serious,surprise,sad}.png` へ差し替え。896×1200 RGBA、共通倍率 `0.7137758743754461`、足元下端1173px、横差0.812px未満。通常PNGは保存済みv11確認用のRGBA画素と一致。画像全体の拡縮と直接RGBA配置だけを行い、顔の貼り替えやアルファの一括閾値処理なし。
表示用の凛5枚のlossless WebP、manifestと旧版データも再生成。PNG/WebPの全RGBA画素一致、実会話の全5表情で同一表示位置・頭の見切れなし・ブラウザエラー0、足元整列dry-run変更0、身長回帰を確認した。現行第1章の通しも、セーブ／ロード・初回4位で敗北→再挑戦1位100点でクリア・VN表示中の画面漏れ0で合格。詳細は配置・検証記録を参照。大容量の旧版配布HTMLはローカルでビルド確認し、追跡物へは含めずPages CIの再構築に任せる。

## Claude側で続ける作業

1. 指定ブランチの最新コミットと最新mainを確認し、別チャット側の変更を保って取り込む。Codex側ではmainへのマージを行わない。
2. `python3 tools/make_face_icons.py rin` で凛の丸アイコンをv11へ更新。現在の `TUNE` はv7の顔に合わせてあるので、他キャラと並べて拡大率・目線・顎の収まりを再確認する。他キャラのアイコンを再生成しない。
3. 凛の全台詞の `face` 指定を上の意味と照合する。mainのPRT18の振り分けを基準に、必要な箇所だけ調整し、外見の地の文も確認する。Codex側では台詞・表情指定を変更していない。
4. `python3 tools/build_setting_reference.py` で設定資料集を最新版の絵へ更新。Codex側では `docs/setting_reference.html` を変更していない。
5. 丸アイコンのLIME・マップ等の表示、5表情の会話、PNG/WebPとmanifestを確認し、必要な検証を終えてPRからmainへマージする。PRT25/PRT30へClaude側の完了を記録する。

以前の「後日のタイミング」保留（旧PRT19/20、番号整理後PRT34/35）は、この明示指示で立ち絵制作・指定ブランチへの差し替えを再開した。以前の「全て完了したらマージ」より、今回の「mainへのマージはClaude側」という担当分担を優先する。
v7はPR #187の採用履歴、v8〜v10は修正履歴。最新の本人参照はv11とその5表情で、旧画風へ戻さない。ましろの6表情は確認用として保持し、この凛の依頼をましろの採用回答には扱わない。
