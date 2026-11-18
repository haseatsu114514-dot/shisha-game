# 龍の煙（TMG53・Issue #3413）

第4章 前夜祭（`ch4_wang_reception`）で王煙楼が龍のような煙を立ち上らせる瞬間の一枚絵。

- 採用: 候補1（オーナー決定 2026-11-18）
- 原画: `raw/dragon-smoke.png`（1672×941・不透明RGB・無加工）
- SHA-256: `c19b585b13eeb6d68652c288ecc8800b0f0e41bc42650d21689b3b9254205e2b`
- 生成: Codex A（gpt-6-sol）の image_gen。参照は Issue #3413 の指定どおり（王煙楼の立ち絵／会場背景／キービジュアル）。実際のプロンプト全文は生成単元の記録（work/codex-a-3413retry-1118/out/PROMPTS.md 候補1）に保存。
- 検品（ミューズ実施）: カウンター4台が同寸・一列／人物の縮尺が自然（顔 約50px）／ホースは1本で連続／龍は煙のみで形成（目・鱗・爪・炎なし）／他のカウンターは空／下部は観客シルエット。合格。
- ゲーム側: `remake/img/cgs/cg_ch4_dragon_smoke.webp` に変換し、`remake/js/motions/moments.js` の `dragonSmoke` を全画面表示＋ゆっくり寄る演出に作り直した。
