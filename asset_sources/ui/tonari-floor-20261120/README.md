# tonari フロア営業の画像素材 ── Codex への依頼（2026-11-20・TFL06）

オーナー「バイトパートを龍が如く0や極2にあるキャバクラ経営ゲームみたいにしようと思ってます。……画像生成はコーデックスに依頼して見た目も良くして」（2026-11-20）。

遊びの仕様は [docs/spec/tonari_floor.md](../../../docs/spec/tonari_floor.md)。画面は `remake/js/daily/tonari-floor-view.js`・`remake/css/tonari-floor.css`。

## いまの画面は何で描いているか

2026-11-20 の時点で、この環境の OpenAI 画像 API は残高切れ（`credit_balance_exhausted`）で、1枚も生成できなかった。そこで次の形で先に遊べるようにした。

| 画面の物 | いま | 届いたら |
|---|---|---|
| 店内 | 採用済みの会話用の背景 `bg_tonari_inside_*`（昼・夜・曇り）をそのまま敷く。卓4つ＋カウンターを五つの席として使う | フロア専用の店内画（下の B）に替え、`tonari-floor-view.js` の `SPOTS`（卓の位置）と `LAMPS`（灯りの位置）を絵に合わせる |
| 客 | コードで描いた影絵（顔のない胸像。`tonari-floor-art.js` の `bust()`） | 客の絵（下の A）を `remake/img/ui/tonari-floor/guest-<種類>.webp` に置き、`GUEST_ART` に登録する。コードは変えずに差し替わる |
| 板・ボタン・紙 | ゲーム共通の絵（`remake/img/ui/lounge/panel.webp`、`craft-paper/board.webp`・`button-paper.webp`・`button-amber.webp`）を九分割 | 専用の部品（下の D）が届いたら CSS の画像を替える |
| 記号（注文・配膳・合図など） | コードの線画（`tonari-floor-art.js` の `GLYPHS`） | 記号の絵（下の D）に替える |
| 卓の上のシーシャ台 | 置いていない（提供中の卓は、番号札から煙が立つ） | 透過の一台（下の C）を番号札の位置に置く |

数字・名前・時計・満足の輪・吹き出しの文字・煙の動き・灯りの明滅はコードが描く。素材には焼き込まない。

Codex への依頼は Issue にまとめる（オーナー「コーデックスへの依頼はイシューにまとめて」）。原画はこのフォルダの `originals/` に置いて push してもらう。届いたら大きさ・透過をそろえ、`remake/img/ui/tonari-floor/` の WebP にして組み込む。

## 方針

- **店は今の tonari と同じ店**。緑の布のソファ・木の低い卓・モザイクランプ・窓の外の街・右手の木のカウンター。別の店に見える模様替えをしない。
- **客は名もない客**。本編の登場人物（つむぎ・ひより・鉄仮面さん・サイの店の常連など）に似せない。常連帳は作らないので、決まった個人に見える強い特徴（派手な髪色・傷・目立つ装飾）を付けない。
- **客の絵にシーシャ機材を描かない**（ホース・台・炭を持たせない）。機材の必須手順（`docs/shisha_reference.md` §4）が要るのは C の一台だけ。
- 画風は、客＝[立ち絵の規格](../../../docs/portrait_standard.md) 3節、店内＝[背景の規格](../../../docs/background_standard.md) 2節。AIっぽさ（テカり・グロー・エアブラシ・量産型の顔・擬似文字）を避ける（[素材規約](../../../docs/asset_ai_guidance.md)）。

## 一覧（A を先に。A が届けば画面の印象がいちばん変わる）

### A. 客の絵（10枚）

1回の生成で1枚。**1024×1024・背景は単色マゼンタ（#FF00FF）**。胸から上。頭のてっぺんから胸までが画面の高さの 70〜80%、左右は中央。丸く切り抜いて使うので、頭と肩が画面の内接円に収まること。二人組は二人を一枚に並べて描く（肩が少し重なってよい。二人とも顔が内接円に入る）。表情は、店でくつろぐ前の普通の顔（口を閉じた穏やかな顔）。

| ID | ファイル名 | 客 | 中身 |
|---|---|---|---|
| TFL-G01 | `guest-first.png` | 初めての方（1人） | 20代前半の女性。肩までのボブ。薄い色のニット。少し緊張して、店内を見回した後の顔 |
| TFL-G02 | `guest-worker.png` | 仕事帰りの方（1人） | 30代の男性。短い髪。ネクタイをゆるめたワイシャツ。疲れているが穏やか |
| TFL-G03 | `guest-train.png` | 終電前の二人 | 20代の二人。キャップの男性と、長い髪の女性。上着を着たまま。時計を気にしている様子は描かない（顔だけ） |
| TFL-G04 | `guest-reader.png` | 読書の方（1人） | 20〜30代。細い縁の眼鏡。落ち着いた色のカーディガン。文庫本を胸の前に持つ（表紙に文字を描かない） |
| TFL-G05 | `guest-walkers.png` | 散歩帰りの二人 | 30代の二人。ポニーテールの女性と短い髪の男性。薄手の上着。外を歩いてきた後のゆるい顔 |
| TFL-G06 | `guest-nose.png` | 香り好きの方（1人） | 30代の女性。髪を上でまとめたお団子。襟のあるシャツ。香りを確かめるような、少し真剣な目 |
| TFL-G07 | `guest-students.png` | 学生の二人 | 20歳前後の二人。くせ毛の男性とキャップの男性。パーカー。楽しそう |
| TFL-G08 | `guest-talkers.png` | 話し込む二人 | 20代後半の女性二人。長い髪とボブ。互いのほうへ少し体を向けている |
| TFL-G09 | `guest-elder.png` | 年配の方（1人） | 60代の男性。つばのある帽子。襟付きの上着。背すじが伸びている |
| TFL-G10 | `guest-friends.png` | 友だち同士の二人 | 20代の女性二人。お団子とポニーテール。明るい色の服。笑っている |

### B. フロア専用の店内画（2枚）

**1920×1080・不透過（生成は 2048×1152 以上）**。今の tonari と同じ店を、営業の画面用に少し高い位置（床から約2m）から見下ろす。人物・シーシャ機材・グラス・文字は描かない（卓の上は空。ゲームが札・客・一台・煙を重ねる）。

| ID | ファイル名 | 中身 |
|---|---|---|
| TFL-BG01 | `bg_tonari_floor_day.png` | 昼。窓からの外光が主な光 |
| TFL-BG02 | `bg_tonari_floor_night.png` | 同じ構図の夜。モザイクランプの灯りが主な光。真っ黒にしない（暗さはゲームが重ねる） |

構図（1920×1080 での目安。ゲームが重ねる物の場所）:
- **五つの席**（どれも「緑のソファ1つ＋木の低い卓1つ」）を、互いに重ならず全部見えるように置く。奥の壁ぎわに3席（卓の中心が x≈26%・50%・74%、y≈45%）、手前の左右に2席（卓の中心が x≈30%・70%、y≈68%）。真ん中は通路で、敷物を一枚。
- **各席の上（卓の中心から上へ画面の高さの約18%）は静かな面**にする（ゲームが丸い客の札と吹き出しを置く）。強い灯り・細かい模様・額を置かない。
- **左の端 0〜10%**: 入口の戸（ゲームが「入口」の札を置く）。
- **右の端 88〜100%**: 木のカウンターと棚（ゲームが「作業台・受渡棚」の札を置く）。
- **上 0〜14%・下 86〜100%**: 灯りと床だけにして、細かい描き込みを控える（ゲームが帯を置く）。
- モザイクランプは上の端に並べる（ゲームがチルタイムの時だけ灯りを強める。絵に光のにじみを描かない）。

### C. 卓の上の一台（1枚・透過）

`shisha_tonari_table.png`・**1024×1536・背景完全透過**。完成して提供済みの一台。煙は描かない（ゲームが描く）。採用済みの `assets/ui/scene_props/shisha_c_station.png`（原画 `asset_sources/hookah-overlays-20261112/`）と同じ構造・同じ縮尺で、色だけ tonari に合わせる（銀のステム、透明なガラスのベース、ホースは緑のソファに合う深い緑）。`docs/shisha_reference.md` §4 の「生成前に決める8行」を埋め、「プロンプトに貼る文」を入れ、出力後に §4.4 のチェックを通す。

### D. UI の部品（透過。文字・数字を描かない）

| ID | ファイル名 | サイズ | 中身 |
|---|---|---|---|
| TFL-UI01 | `slip.png` | 768×512（九分割・角 40px） | 注文の伝票の紙。生成りの紙に、上の端だけミシン目。薄い罫線。角は少し丸い |
| TFL-UI02 | `plate.png` | 640×240（九分割・角 60px） | 上の帯・入口・作業台に使う木の札。濃い胡桃色の板に真鍮の角金具。中は平らで暗い |
| TFL-UI03 | `button.png`・`button-primary.png` | 512×200（九分割・角 40px） | 伝票の上で押す紙のボタン（生成り）と、決定のボタン（琥珀色）。縁は真鍮色の細い線 |
| TFL-UI04 | `bubble.png` | 480×200 | 卓の上の吹き出し。生成りの丸い札。下に小さなしっぽ |
| TFL-UI05 | `lamp-off.png`・`lamp-on.png` | 512×768 | チルタイムの灯り。tonari のモザイクランプを一つ、正面から。消えた状態と灯った状態（光のにじみは描かない） |
| TFL-UI06 | `icons.png` | 2048×1024（8列×4行・1コマ 256×256） | 記号20種を同じ画風で（下の順）。太い線・少ない色・32px でも見分けがつく形。文字・数字・通貨記号を描かない |
| TFL-UI07 | `medal.png` | 512×512 | 客の絵を入れる丸い枠（真鍮の縁・中は透明） |

記号の順（左上から右へ）: 案内（戸と矢印）／注文（伝票）／仕込み（葉を入れた器）／配膳（盆）／煙が薄い（細い煙）／喉にくる（強い火）／グラスが空（氷だけのグラス）／聞きたそう（吹き出しに「？」の形）／夢中（開いた本）／トップ替え（回る矢印と葉）／相談（吹き出しに点3つ）／会計（レシート）／片付け（布ときらめき）／合図（「！」の形）／炭を替える（角炭と足し印）／炭を下ろす（角炭と引き印）／飲み物（グラス）／ひと声（吹き出し）／そっとしておく（三日月）／灯り（ランプ）。

## Codex へ渡す文

```
--- A 共通（guest-*.png・1回の生成で1枚）---
shisha-game の「tonari フロア営業」で、卓の丸い札に入れる客の絵を1枚描いてください。
参照画像（リポジトリのファイルを渡す。役割も書く）:
 ① 画風の目標: assets/sprites/characters/minto/chr_minto_normal.png と assets/sprites/characters/ageha/chr_ageha_normal.png（線・塗り・影の段数だけを真似る。顔・髪・衣装は写さない）
 ② 頭身と顔の大きさの目標: 男性は assets/sprites/characters/sui/chr_sui_normal.png（千須）、女性は assets/sprites/characters/rio/chr_rio_normal.png（凛想）（頭身の目標だけ。顔・髪・体格・衣装は写さない）
描くもの: <上の表の「中身」をそのまま入れる>。名もない客で、本編の登場人物の誰にも似せない。
構図: 胸から上。頭のてっぺんから胸までが画面の高さの70〜80%、左右は中央。頭と肩が画面の内接円に収まる（丸く切り抜いて使う）。二人組は二人を一枚に並べ、二人とも顔が内接円に入る。体はやや斜め、目線はこちらか少し下。
表情: 口を閉じた穏やかな顔。
描かないもの: シーシャの台・ホース・炭・煙、グラス、文字・ロゴ・数字、背景、影、床。
出力: 1024×1024 PNG。背景は単色マゼンタ（#FF00FF）で塗りつぶす。
保存先: asset_sources/ui/tonari-floor-20261120/originals/<ファイル名>
STYLE STANDARD (shisha-game cast): draw this character in the same artist's hand as the approved Minto, Ageha and Rio sprites. Japanese 2D visual-novel game art; confident dark outlines, slightly heavier on the outer silhouette and thinner inside; flat local colors with two to three clearly shaped cel-shadow steps; highlights only as a few deliberate bands on the hair and small catchlights in the eyes. No skin gloss, no airbrush gradients, no rim light or glow, no photographic texture, no pore or fabric micro-detail, no dense ornamental noise, no hundreds of thin hair strands. Limited palette: hair and skin plus three or four main colors. Keep this character's own eye, brow, nose and mouth shapes and natural age and gender differences; do not drift toward a generic AI pretty face.

--- B 1/2: bg_tonari_floor_day.png ---
shisha-game の「tonari フロア営業」の店内画を描いてください。会話用の背景ではなく、五つの席を見渡す営業の画面の下絵です。
参照画像:
 ① 場所と画風: assets/backgrounds/bg_tonari_inside_day.png（同じ店。ソファ・卓・モザイクランプ・窓・カウンター・配色・塗りを真似る。構図は真似しない）
場面: 日本のシーシャバー tonari の店内。昼。窓からの外光が主な光。床から約2mの少し高い位置から、店の中央を正面に見下ろす（俯瞰しすぎない。見下ろす角度は15〜20度）。
構図: 五つの席（どれも緑の布のソファ1つ＋木の低い卓1つ）を、互いに重ならず全部見えるように置く。奥の壁ぎわに3席（卓の中心が画面の横26%・50%・74%、縦45%）、手前の左右に2席（卓の中心が横30%・70%、縦68%）。真ん中は通路で、敷物を一枚。各席の上（卓の中心から上へ画面の高さの約18%）は、強い灯り・細かい模様・額を置かない静かな面にする。左の端0〜10%に入口の戸。右の端88〜100%に木のカウンターと棚。上0〜14%と下86〜100%は、灯りと床だけにして描き込みを控える。モザイクランプは上の端に並べる。
卓の上は空にする。人物・シーシャの台・ホース・炭・グラス・皿・文字・看板の字・ロゴ・UI を描かない（ゲームが重ねる）。光のにじみ・レンズフレア・光の筋を描かない。
出力: 2048×1152 以上・16:9・PNG。保存先: asset_sources/ui/tonari-floor-20261120/originals/bg_tonari_floor_day.png
STYLE STANDARD (shisha-game backgrounds): anime visual novel background, detailed digital painting with painterly brushwork, in the same hand as the approved shisha-game backgrounds attached as style references. Realistic perspective and material textures, one clear light source, forms built from painted planes rather than outlines, warm lighting by default. No people, no text, no logos, no signboard lettering, no watermark, no UI. Keep night scenes readable: shadows still show detail, never a solid black area (the game adds its own night tint). Base interiors and equipment on present-day Japanese shisha bars. Output 2048x1152 or larger, 16:9.

--- B 2/2: bg_tonari_floor_night.png ---
1/2 で採用した bg_tonari_floor_day.png を参照に渡し、同じ構図・同じ家具の位置のまま夜にしてください（窓の外は夜の街。モザイクランプの灯りが主な光。影の中も形が読める明るさ）。家具・卓・ソファの位置を1画素もずらさないつもりで。ほかの条件と STYLE STANDARD は 1/2 と同じ。
保存先: asset_sources/ui/tonari-floor-20261120/originals/bg_tonari_floor_night.png

--- C: shisha_tonari_table.png ---
採用済みの assets/ui/scene_props/shisha_c_station.png を参照に渡し、同じ構造・同じ縮尺・同じ向きのまま、色だけ替えてください: 銀のステム（紺の帯は無地の銀へ）、透明なガラスのベース、ホースは深い緑。HMD・炭2個・受け皿・パージ弁・ホースの経路（側面のポートから1本、手元の硬いハンドルまで分岐なし）は参照のまま変えない。煙・文字・背景は描かない。
docs/shisha_reference.md §4.2 の「プロンプトに貼る文」を足し、§4.3 の8行を制作記録に残し、出力後に §4.4 のチェックを通してください。
出力: 1024×1536 PNG・背景完全透過。保存先: asset_sources/ui/tonari-floor-20261120/originals/shisha_tonari_table.png

--- D 共通（UI の部品）---
shisha-game の「tonari フロア営業」の画面の部品を描いてください。tonari は木と布と真鍮とモザイクガラスの、あたたかい店です。
参照画像: assets/backgrounds/bg_tonari_inside_day.png（店の色と素材）、remake/img/ui/craft-paper/board.webp（紙の質感）
画風: 手で描いた水彩〜ガッシュ調のゲームUI。写真・3D・光沢・グローにしない。面は平らで、上に文字を重ねても読める。
描くもの: <上の表の「中身」をそのまま入れる>
描かないもの: 文字・数字・通貨記号・ロゴ・透かし。
出力: 表のサイズの PNG・背景完全透過。九分割で使う板とボタンは、角の飾りを表の「角」の幅に収め、辺と中は一様にする。
保存先: asset_sources/ui/tonari-floor-20261120/originals/<ファイル名>
```

## 届いた後の組み込み（受け取った担当がやること）

1. 原画を `originals/` に置く（LFS。`git lfs ls-files` で確認）。マゼンタの背景は透過にし、端のにじみを消す。
2. 客: 512×512 の WebP にして `remake/img/ui/tonari-floor/guest-<種類>.webp`。`remake/js/daily/tonari-floor-art.js` の `GUEST_ART` に `種類: "../../img/ui/tonari-floor/guest-<種類>.webp"` を足す。
3. 店内: `assets/backgrounds/` に置いて `python3 tools/background_catalog.py sync`・`python3 remake/tools/build_manifest.py`。`tonari.js` の `serveFloorOrder` が渡す `art` をこの絵にし、`tonari-floor-view.js` の `SPOTS`・`LAMPS` を絵に合わせて測り直す。
4. 部品・記号: `remake/img/ui/tonari-floor/` に WebP で置き、`remake/css/tonari-floor.css` の `border-image` と `tonari-floor-art.js` の `glyph()` を替える。
5. `node remake/test/browser/tonari_floor.mjs` と、PC 1280×720・横持ち 844×390 の実画面で確認する。
