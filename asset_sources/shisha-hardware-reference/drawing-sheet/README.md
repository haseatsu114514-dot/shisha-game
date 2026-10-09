# シーシャ描写リファレンス（早見表と、プロンプトに貼るルール）

シーシャ台・ホース・炭が写る画像を生成する前に、まずこの1枚を見る。

> **これは仕組みを理解し、生成後に検品するための資料。図や早見表を生成ツールに添付しない**（平板な図解の見た目が絵に移るため）。生成するときは、下の「添付する画像」のとおり実物の写真を見て、写真を添付する。
このフォルダの親にある13の資料と37写真・構造図・NG実例の**要点だけ**をまとめた早見表。
細かい根拠・出典・例外は各資料が正本（末尾の一覧）。食い違ったら正本とオーナーの最新指示を優先する。

| ファイル | 用途 |
|---|---|
| [shisha-drawing-reference.png](shisha-drawing-reference.png) | 人が読む早見表（構造・縮尺・場面・ホース・吸い口・穴・NG実例・チェックリスト・写真索引） |
| [shisha-structure-diagram.png](shisha-structure-diagram.png) | 構造図だけを切り出した資料（部品の積み順・ホース経路・比率）。検品のときに見比べる。**生成ツールには添付しない** |
| [shisha-drawing-reference.html](shisha-drawing-reference.html) | 上2枚の元データ。直したら下のコマンドで書き出し直す |

```bash
node tools/render_html_png.mjs \
  asset_sources/shisha-hardware-reference/drawing-sheet/shisha-drawing-reference.html \
  asset_sources/shisha-hardware-reference/drawing-sheet/shisha-drawing-reference.png \
  --select "#anatomy" asset_sources/shisha-hardware-reference/drawing-sheet/shisha-structure-diagram.png
```

---

## 1. 生成前に決める（1枚ごとに書き出す）

生成ツールに頼む前に、次の8行を埋めて制作記録に残す。空欄のまま頼まない。

```
人物      : （キャラID。正規立ち絵 assets/sprites/characters/<id>/chr_<id>_normal.png を添付）
場面      : 準備中（ボウル未装着）／詰める・アルミ／炭を置く／完成・喫煙／携帯 のどれか1つ
台の型    : 伝統の金属／木製ステム／角型モダン／透明・低重心 など。色・装飾は自由
HMD       : 完成・喫煙なら必須。具体的な1モデル（例：ONMO型の蓋なし低容器）。蓋の有無も
炭        : 小さな角炭○個（HMD内、または制作工程なら外周三角3個）
ホース    : 本体の側面ポート → ホース → 硬いハンドル →（チップ）→ 口。画面のどこを通すか
吸い口    : なし／使い捨てチップ／首掛けマイチップ（携帯中）／マイチップをハンドルに装着
構図      : カメラ距離・人物と台の奥行き（手持ちなら同じ奥行き）・場所と時間帯
```

### 添付する画像（写真を見る）

役割を分けてプロンプトに書く。**図解（このフォルダの画像）は添付しない。**

- **本人**：正規立ち絵 `assets/sprites/characters/<id>/chr_<id>_normal.png`
- **質感**：`assets/ui/title_arts/title_art_keyvisual_01.png`
- **機材**：実物の写真。オーナー提供の元写真（[台9種](../README.md)・[喫煙と熱管理](../smoking-and-heat-management-20261009.md)・[アルミ・HMD・炭の近接](../heat-management-closeups-20261009.md)・[ホースとチップ](../hose-and-mouthpieces-20261009.md) 等の各資料に番号つきで記録）と、選んだHMDモデルを**ボウルに装着した実写**、手で持つ場面なら**掌・指が写る実写**（出典は[装着時と手持ちの縮尺](../installed-and-handheld-scale-20261009.md)）
- リポジトリにある写真の一覧画像は縮小版。生成に使うときは元の写真か出典から取り直す

## 2. プロンプトに貼る文

日本語・英語のどちらかを、場面の指定の後ろに貼る。生成ツールが英語の方が安定するなら英語版を使う。

### 日本語

> シーシャ（水たばこ）の構造を守って描く。上から順に「小さな角炭 → 炭を収めるHMD（熱管理器具。ボウルの口に載る別部品） → フレーバーを詰めたハガル（器と細い脚） → 灰の受け皿 → 縦のステム → 水の入ったガラスのベース」。ベースの水面は下の方で、ステムを水槽にしない。ホースは1本だけで、本体側面のホースポートから出て、重力でたわみ、手で持つ硬いハンドルの根元につながる。ホースを分岐・途切れ・浮遊させず、パージ弁・ボウル・受け皿・ベースの底から生やさない。人物を囲む大きな輪にしない。完成・喫煙状態ではアルミに炭を直接置かず、HMDの中に炭を置く。HMDは1つのモデルとして成立させ、別の型の蓋・煙突・取手を混ぜない。ハガルの口とHMDは大人の掌の幅くらい、炭は指先ほどの大きさ。受け皿はHMDの2.5倍前後。煙は人物の口元から出し、HMD・ホース根元からは出さない。首掛けのマイマウスピースを描く場合はチェーンだけでなく小さな吸い口本体を付ける。台の形・色・装飾は自由にデザインし、実在製品・ロゴ・文字は描かない。

### English

> Draw the hookah with correct structure. From top to bottom: a few small cube charcoals (about fingertip size, grey ash with a little red glow, no flames) → a heat management device (HMD), a separate low metal cup sitting on the bowl's rim, holding the coals → the ceramic tobacco bowl (a cup on a slim neck) → a wide ash tray → a vertical stem → a glass base with water only in its lower part. Exactly one hose: it starts at the hose port on the side of the stem above the base, sags naturally with gravity, and connects to the base of a rigid handle held in the hand. The hose never forks, breaks, floats, loops around the character, or comes out of the purge valve, bowl, tray or base bottom. In a finished/smoking setup, coals sit inside the HMD, never directly on foil. Use one coherent HMD model; do not mix lids, chimneys or handles from different models. The bowl mouth and HMD are about the width of an adult palm; the tray is about 2.5× the HMD width. Smoke comes from the character's mouth, not from the HMD or hose. If a neck-worn personal mouthpiece is shown, draw a real small mouthpiece body on the chain, not just a chain. Hookah shape, colors and ornaments are free; no real brands, logos or text.

### 場面別に足す一文

- **ボウル未装着の制作画面**：台の先端は小さな凸型の金属ポスト。ボウル・HMD・炭は描かない。
- **詰める・アルミ・穴あけ**：ハガル＋アルミだけ。炭とHMDはまだ載せない。アルミは口に平らに張り、縁で折り込む。
- **炭を置く（制作工程）**：トングで小さな角炭を扱う。外周の三角に3個。
- **手でハガル／HMDを持つ**：手と同じ奥行きで、片手で持てる大きさ。カメラに突き出さない。脚を短く潰さない。

## 3. 生成後チェック（原寸で見る。1つでもNGなら直すか再生成）

- [ ] 人物は正規の立ち絵と同一人物（顔・髪・衣装・年齢感）
- [ ] 積み順が成立：ベース→ステム→受け皿→ハガル→HMD→炭
- [ ] 完成・喫煙の台はHMD付き。直炭になっていない
- [ ] HMDの蓋・取手・通気口が同じ1モデルの組
- [ ] ハガル・HMD・炭・手・受け皿の縮尺が自然。ハガルの脚が潰れていない
- [ ] ホースをポート→手元、手元→ポートの両方向になぞって1本。分岐・3つ目の端・途切れなし
- [ ] ホースは側面ポートから。パージ・ボウル・皿・ベース底から生えていない
- [ ] 人物を囲む輪・不自然な大回りがない
- [ ] マイチップ：吸い口本体がある／使用中はハンドル先端に付いている
- [ ] 煙は口元から。HMD・ホース根元・チェーンから出ていない
- [ ] 文字・ロゴ・透かし・UIが焼き込まれていない

不採用の実例は [ng-examples/README.md](../ng-examples/README.md)（ホースのY字分岐・ハガルが短い・足元を囲む大回り）。

## 4. 詳しい正本

| 知りたいこと | 資料 |
|---|---|
| 台の型・材質（実物9点） | [README.md](../README.md) |
| 37写真を横断した誤描写の一覧 | [ai-generation-structural-pitfalls.md](../ai-generation-structural-pitfalls.md) |
| ヒロインの日常・タイトルCG（HMD必須・具体モデルと寸法・背景の変化） | [heroine-title-cg-rules-20261009.md](../heroine-title-cg-rules-20261009.md) |
| 首掛けマイチップ・ホース接続の検品 | [visual-qa-necklace-hose-20261009.md](../visual-qa-necklace-hose-20261009.md) |
| 装着時・手持ちの縮尺の実写と出典 | [installed-and-handheld-scale-20261009.md](../installed-and-handheld-scale-20261009.md) |
| 部品名・空気の通り道・パージ | [anatomy-diagrams-20261009.md](../anatomy-diagrams-20261009.md) |
| ハガル内部の穴・アルミの穴あけ・炭の配置・HMDの種類 | [bowl-interiors-foil-coal-placement-20261009.md](../bowl-interiors-foil-coal-placement-20261009.md) |
| アルミ直置きとHMDの近接写真 | [heat-management-closeups-20261009.md](../heat-management-closeups-20261009.md) |
| 喫煙姿勢・煙の出方 | [smoking-and-heat-management-20261009.md](../smoking-and-heat-management-20261009.md) |
| 設置場所・構図 | [usage-and-installation-20261009.md](../usage-and-installation-20261009.md) |
| ホース・チップの部品 | [hose-and-mouthpieces-20261009.md](../hose-and-mouthpieces-20261009.md)、[mouthpiece-handle-skins-20261009.md](../mouthpiece-handle-skins-20261009.md) |

この早見表は描写の約束をまとめたもので、ゲームの制作工程（穴あけテンプレ・基本3炭・採点）や機材の仕様は変えない。
