# 第3章・ましろがハンドルを差し出すCG

`ch3_double_apple_incident` が呼び出していた未収録CGを制作し、本編へ接続する。
2026-10-26の依頼「詰まったところはCGとか制作しながら遊んでいって欲しい」に対応。

## 使用先と原画

- 正常な表示順は、ホースを差し出す地の文 → `show_cg` → 「はい。ダブルアップル。シンプルなやつ」→ `hide_cg` → はじめの内心。台詞・選択・進行・報酬は変更しない。
- `source.png` は採用改稿の無加工原画（1672×941、RGB、不透明）。`assets/cgs/cg_mashiro_double_apple.png` は同一bytes。
- `initial-not-adopted.png` は頭上の見切れと右下の余分なホースがあった初稿。採用・参照基準に戻さない。
- `prompt.txt` と `revision-prompt.txt` は実際に画像生成へ渡した全文。
- 配信は `remake/img/cgs/cg_mashiro_double_apple.webp`。`python3 remake/tools/build_manifest.py --cgs-only cg_mashiro_double_apple.png` で、他素材の目録を保持して生成する。

## 参照と構成

本人は `assets/sprites/characters/mashiro/chr_mashiro_normal.png`、質感は `assets/ui/title_arts/title_art_keyvisual_01.png`、店は `remake/img/backgrounds/bg_mukai_shop.webp` を実見して添付した。ハンドルの構造はオーナー提供写真の既存一覧 `asset_sources/shisha-hardware-reference/handles-extra-20261009.webp` を参照。写真のロゴ・背景は転用せず、ゲーム用のオリジナル意匠とする。構造図・早見表は生成へ添付していない。

```text
人物      : ましろ、22歳。灰金の二本編み、半目の金茶の瞳、白ブラウスとベージュのカーディガン
場面      : 完成した一台のハンドルを渡す瞬間。誰も吸っておらず煙なし
台の型    : 本体は画角右の外。近景へ無理に台を追加しない
HMD       : 完成台のHMDは画角外。可視部品・モデルの混成なし
炭        : 画角外。手元に炭・HMDを追加しない
ホース    : 硬いハンドル根元→一本の柔軟なホース→卓の裏へ遮蔽。台側は画角外
吸い口    : ハンドル先端の小さな半透明チップ。首掛けマイチップなし
構図      : 閉店後mukaiの一人称近景。顔・先端・握り手を会話枠より上へ
```

缶・ラベル・果物を置かず、グレープの種明かしを先取りしない。ましろを勝ち誇る顔や特別な治療者にせず、普段の眠たげな顔と小さなためらいで描く。

## 原画の目視検品

- 正規立ち絵の顔・髪・服とmukaiの青灰壁、オリーブ席、珈琲カウンターを照合。
- 改稿で頭の見切れと右下の余分なホースを解消。親指と四指の握りを確認。
- 先端チップ→硬いハンドル→金属根元→一本のホースを両方向に追跡。分岐・第三の端なし。卓の裏での遮蔽は自然。
- 台側ポート・ハガル・HMD・炭は画角外のため、原画から確認済みとは扱わない。
- 文字・ロゴ・UI・植物・不要な首掛け品・煙なし。

## 本編表示の検証

- PC 1280×720／横持ちタッチ844×390の2ケース成功。`qa-pc.png`、`qa-touch.png`、`qa-results.json` を保存。
- 第2章終了条件から3章へ進めた検証用セーブを事件前のstage5へ置き、本番のLOAD・再開処理から起動。第1章からの手操作通しではない。
- 通常のEnter送り（`vnTest.turbo=false`、文字速度4）でCGを表示。配信WebP1672×941を正常デコードし、顔・吸い口・握り手と会話枠の重なりを目視確認。
- 表示前は未解放、表示後にCGの既読を記録。Enterで消去して次の地の文へ進み、事件読了後にMENU→タイトル→GALLERYから同じ画像を閲覧できた。
- ブラウザ例外、HTTP失敗、取消以外のリクエスト失敗なし。
- `node tools/ci/run.mjs --kind quick` の10スイート、`node --experimental-vm-modules remake/test/gallery.mjs` 成功。

原画・採用PNGのSHA-256は同一。配信WebPだけを既存ビルダーで圧縮しており、写真や既存原画は加工・再配布していない。
