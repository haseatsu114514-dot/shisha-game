# あげはの新版の作り直し（#3331）

オーナー決定（2026-11-11）: 新版のあげはは、旧版（`assets/sprites/characters/ageha/`）を本人の正本にして可愛く作り直す（Draft #2810 の候補は不採用）。

## G1 通常（採用）

Codex が #3331 の G1 の依頼文で3案（A・B・C）を作り、オーナーが **A を採用**した。

> #3331の比較A。丸くて可愛い顔を基準に、残りの表情も揃えて

| ファイル | 中身 |
|---|---|
| `normal-untouched.png` | 採用した A の原画（無加工）。1084×1451・RGBA。SHA-256 `d02f63ec34452381f771446d222dda14b280ff3459ee22ae75cb29357661d92c` |
| `normal-prompt.txt` | Codex が入力した英文（#3331 の G1 と同じ） |

参照に渡した画像: ① 旧版 `assets/sprites/characters/ageha/chr_ageha_normal.png`（本人・顔・衣装・ポーズ）② 新版つむぎの通常 ③ 新版サメちゃんの通常（②③は画風だけ）。

Codex の検品メモ（原画は無加工のまま）:

- 人物の高さ 1431px（不透明度128以上）。四隅は透明。
- 外縁まで極薄の孤立した透明度の点が残っている。上下の余白も薄い。
- → **ゲームに入れるときに**、透明度の低い孤立点を消し、新版のキャンバス（896×1200）へ縮小・配置する（#3326 と同じ方法）。原画は変えない。

不採用の B・C（1024×1536）は保存していない。SHA-256 は B `e76fa379139d8b4f2941f096e75bd5e2888d2b56555030921ce227701bf2c483`、C `9acbdd3bdbc6d40aebaf7984af16c178c095b8ecf96d4d677bcbad6c32347512`。

## G2〜G5 表情（採用）

smile・surprise・serious・sad は、この A を基準に Codex が作った（#3355）。原画は同じフォルダの `<face>-untouched.png`、生成の記録は [`expressions-README.md`](expressions-README.md)。オーナーが 2026-11-12（日本時間）に **4表情とも採用**した。

## 組み込み（済み）

通常と4表情をまとめて新版のあげはに入れた（今の新版の normal と、#3326 で入れた sad も置き換え）。

- 位置合わせ: 通常Aは置き換え前の新版の通常と、頭頂〜足元の高さ・足元の下端・頭の横位置を同じにして縮小・配置。4表情は配置した通常Aに同じ方法で合わせた。人物から離れた極薄の点だけ消した（描き直し・色の調整なし）。倍率と位置は [`integration.json`](integration.json)。
- 置き換え前の新版の通常・悲しみは `previous-runtime/` に残した。
- `data/portrait_metrics.json` の `styles.new.ageha` を測り直した（5.88頭身・規格内）。顔アイコン（`assets/ui/face_icons/new/face_ageha.png`）とコンティニュー画面の顔の枠も作り直した。
