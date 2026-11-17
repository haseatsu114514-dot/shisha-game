# くじ限定の特注台3種「自室に置いたときの絵」生成記録（#3418・KJ10）

自室の背景に重ねる台の絵3枚。編集元の自室版の特注台と同じ形・位置・ホースのまま、色・仕上げ・刻印だけを変えた。
デザインは先に商品写真風の見本でオーナーが選定した（2026-11-17）: メルティは当初案のレオパード柄が不採用になり「ピンクゴールド＋無地の淡いピンクガラス」に変更、名入れは「マットブラック＋金の逢縁」に変更。トウスは銅色の金属＋橙と琥珀の渦ガラスで採用。
組み込み（2026-11-17）: 原画を `assets/ui/scene_props/` へコピーし、`build_manifest.py --scene-props-only` で配信用 WebP と目録を追加。`assets/` 側のコピーだけ、薄いアルファのごみ（輪郭から離れた α=1 の点が各数千px）があったため α16以下を0にする処理をした（Issue #3418 §6.2 の指定どおり）。原画は無加工。

## 生成前に決めた8行（3枚共通）

```
人物      : なし（自室に置く台だけの透過の絵）
場面      : 準備中（ボウル未装着）。先端は小さな凸型の金属ポスト
台の型    : 採用済みの職人仕立ての特注台（自室版）と同じ。細いステム、手吹きガラスの丸いベース、上部の受け皿。ステムはベースの口に黒いゴムのパッキンで真っ直ぐ差さる
HMD       : なし（ボウル未装着）
炭        : なし
ホース    : 1本。ステム右側のホースポート → 重力でたわむ → 左下の硬いハンドル。通り道と色は編集元と同じ。左の小さな金具はパージ弁で、ホースをつながない
吸い口    : なし（ハンドルの先は金属の先端だけ。チップ・マイチップなし）
構図      : 1024×1536・透過・3/4斜め上。編集元と同じ位置と大きさ（ステムの軸 x≈448、ポストの上端 y≈74、受け皿 x 220〜679、ベース x 200〜697、ガラスの底 y≈1250）。人物・部屋なし
差分      : melty＝金属すべてピンクゴールド、ガラスは無地の淡いピンク（柄・斑点・文字なし）／tosu＝金属は銅色、ガラスだけ橙と琥珀の渦／engraved＝金属すべてマットブラック、ガラスはスモーク、ステム前面に「逢縁」2字を縦に金で刻む
```

## 渡した画像

| 役割 | ファイル | SHA-256 |
|---|---|---|
| 編集元（形・位置・ホース・画風の正本） | `assets/ui/scene_props/shisha_home_stand_custom.png` | `1e62c0c31c2fe2fc762700a4707dd2700b574582b72dce78cf48389fdad80ca3` |
| melty の仕上げ見本（オーナー採用） | 商品写真風の候補（Codex 生成・第3版候補1） | `e291d7ce85427f542fedbdb668f5276469595cfb2e99cc9eb174b519b2dee037` |
| tosu の仕上げ見本（オーナー採用） | 商品写真風の候補（Codex 生成・第2版候補1） | `a297799253a654ca3bf31f1d8f2ae06c77cf6a2e8cf71e86d5ff2d3e776ea6e4` |
| engraved の仕上げ見本（オーナー採用） | 商品写真風の候補（Codex 生成・第2版候補1） | `d57c3f424c66bfccc775b96e8c659567a6c8392218f697611b47444eaca79f5a` |

## 原画

| ファイル | bytes | SHA-256 | α>16 外接枠 | 四隅α |
|---|---|---|---|---|
| `shisha_home_stand_custom_melty.png` | 1,637,040 | `3fd49d1b878f29143e3eef42660f1b16152ea08756a49c73e1a26b601a71f3f5` | (197, 70, 996, 1416) | 0,0,0,0 |
| `shisha_home_stand_custom_tosu.png` | 1,618,742 | `360f8a76d8b1c8afb33b07a4c9cf06fed334158bbedadcfe488ff98fff27a7ae` | (201, 73, 999, 1416) | 0,0,0,0 |
| `shisha_home_stand_custom_engraved.png` | 1,388,957 | `2db1d170e8b8a5e94760d0f0c6afbfe3faf197265df4565480d65c56836982a4` | (200, 72, 997, 1417) | 0,0,0,0 |

基準（編集元）: 外接枠 (200, 74, 996, 1416)。3枚とも ±12px 以内。
比較図は `comparison.jpg`（元の自室版と3枚を暗背景・明背景で並べたもの）。

## チェック結果（受け取り側で原寸確認）

- 数値: 3枚とも (1024, 1536)・RGBA・四隅アルファ0。外接枠は基準 ±12px 以内。
- 輪郭: 編集元とのアルファ輪郭 IoU は melty 0.968／tosu 0.976／engraved 0.972。ステム・受け皿・ポスト・ベース・ホース・ハンドルの位置は一致し、変わったのは色・仕上げ・刻印だけ。
- 透過のふち: 暗背景・明背景の両方で確認し、白いふちなし。輪郭から離れた α=1 のごみは `assets/` 側コピーで α≤16→0 の処理済み（上記）。
- 積み順: ベース→ステム→受け皿→先端ポスト（ボウル未装着）。ステムはベースの口に真っ直ぐ。ボウル・HMD・炭・アルミ・煙なし。
- ホース: ポート→ハンドルで1本、分岐・途切れ・大回りの輪なし。パージ弁からは出ていない。
- 文字: engraved の「逢縁」だけ。拡大確認で逢（上）・縁（下）とも正しい字、金色・縦書き・ステム幅以内。他の2枚に文字・ロゴ・透かしなし。
- melty: 金属がピンクゴールド、ガラスは無地の淡いピンクで透け、水とダウンステムが見える。柄・斑点・マークなし。
- tosu: ガラスが橙と琥珀の渦で透け（塗りつぶしでない）、ダウンステムと水位が見える。

## 使ったプロンプト

各台とも [A] ＋ その台の [FINISH] ＋ [B] の順。[A] と [B] は Issue #3418 §4 の文面どおり（[A] の image 2 の役割は「採用デザイン見本」に合わせてある）。[FINISH] は採用デザインに合わせて書き換えたもの:

[A]
Create ONE transparent game prop: a limited-edition version of the hookah stand in image 1, as it stands in the player's room. EDIT image 1 (home_stand_original.png). Keep exactly: the same canvas (1024x1536 portrait), the same position and size of the stand on the canvas, the same 3/4 view from slightly above, the same silhouette and proportions of the stem, the wide ash tray, the small convex bare metal post on top, the black rubber grommet at the mouth of the base, the straight downstem inside the hand-blown glass base, the hose port on the right side, the separate small purge valve on the left, and exactly the same single black hose path and rigid handle with its metal tip. Keep the same polished painted rendering and soft lighting. True alpha background with all four corners fully transparent; no floor, no cast shadow, no room, no person, no hand. Do not move, resize, re-pose or redesign anything; change only the finish described below. Image 2 is the owner-approved design reference of this limited stand: copy only its colors and finish, not its framing, angle, background or missing hose.

[FINISH] melty
FINISH: MELTY limited colorway, the same as image 2. ALL metal parts — the tray, the stem, the collar above the mouth of the base, the hose port, the purge valve, the connector rims and the metal tip of the handle — are polished PINK GOLD (rose gold). The hand-blown glass base is a very pale blush pink and completely PLAIN: no pattern, no spots, no rosettes, no marks, no text anywhere. It still reads clearly as transparent glass, with water only in its lower part and the downstem visible through it. The hose and the handle stay black, exactly as in image 1. No shop name, logo or text.

[FINISH] tosu
FINISH: Tosu limited colorway, the same as image 2. The metal parts take the warm copper-bronze tone of image 2. Only the hand-blown glass base changes otherwise: rich translucent orange and amber swirls melted inside the glass itself. It stays transparent glass, not opaque paint: the downstem and the low water level remain visible. The black grommet, the hose and the handle stay exactly as in image 1. No pattern, label or text.

[FINISH] engraved
FINISH: Engraved limited colorway, the same as image 2. ALL metal parts are matte black. The hand-blown glass base is smoky near-black translucent glass; the downstem remains faintly visible through it, with water only in its lower part. On the front face of the long upper part of the stem, below the tray, engrave exactly the two Japanese characters 「逢縁」 arranged vertically, 逢 above 縁, in GOLD, thin and discreet, no wider than the stem. The two characters must be correct when zoomed in. The hose and the handle stay black, exactly as in image 1. No other text, logo or ornament anywhere.

[B]
（Issue #3418 §4 の [B] と同一文。構造・縮尺の一般規則＋ボウル未装着の指定）

## 2026-11-18 ホースなし版への差し替え（オーナー指示）

オーナー指示「基本はホースつけないで置いておきたい」を受け、3枚ともホースとハンドルを取り除いた版へ差し替えた（Codex A で生成、接続口は開いたまま残す）。デザイン・色・刻印（「逢縁」）は不変。あわせて自室の表示は「いちばん後に手に入れた1台だけ」に変更（全台横断、`remake/js/core/scene-art.js`）。ホース付きの旧原画は git 履歴（PR #3729 時点）で参照できる。

| ファイル | bytes | SHA-256 |
|---|---|---|
| `shisha_home_stand_custom_melty.png` | 1,345,000 | （差し替え後の原画。以後の正本はこちら） |
| `shisha_home_stand_custom_tosu.png` | 1,416,850 | 同上 |
| `shisha_home_stand_custom_engraved.png` | 1,131,595 | 同上 |
