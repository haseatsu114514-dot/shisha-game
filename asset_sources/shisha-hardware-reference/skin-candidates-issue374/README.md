# Issue #374：ハンドル2案・短いマウスピース2案

作業者E `codex-e-visual-20261011-01`。予約成功 [run 38179073060](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38179073060)。基準main `73cd85e0c2f40f18361a6174b9cb9c1064eaab56`。制作時点では未採用候補として保存。**2026-10-12、オーナーが4点すべてのデザインを採用。ゲームへの外観導入は別Issue [#437](https://github.com/haseatsu114514-dot/shisha-game/issues/437) で進める。本編・ショップ・所持品・manifestにはまだ登録していない。**

## 制作物と比較

![4候補・拡大率はカテゴリごとに異なる](comparisons/candidates-on-gray.jpg)

| 候補 | 原画 | 造形 |
| --- | --- | --- |
| 夜潮 | [PNG](handle-01-yoshio.png)・[指示](handle-01-yoshio.prompt.txt) | 墨黒の長い硬質管、わずかな紺の握り、銀の根元接続金具 |
| SHISHARKブルー | [PNG](handle-02-shishark-blue.png)・[指示](handle-02-shishark-blue.prompt.txt) | 銀の長い管、海青グリップと波の溝。文字・突き出たサメ装飾なし。サメちゃん専用とは未確定 |
| 水晶のしずく | [PNG](mouthpiece-01-crystal-drop.png)・[指示](mouthpiece-01-crystal-drop.prompt.txt) | 小さな半透明淡青の樹脂風チップ。中空の先端・短い差し込み部・止め段 |
| 星月のチャーム | [PNG](mouthpiece-02-starmoon-charm.png)・[指示](mouthpiece-02-starmoon-charm.prompt.txt) | 真鍮色の短い中空チップ、黒い弾性接続部、外側の携帯リング。星月の表面意匠、鎖は描かない |

全原画1536×1024のRGBA。原画と実際の生成指示、参照・ハッシュ・alpha・目視所見は [candidates.json](candidates.json) に保存。既存素材の置換はなく、比較前は「独立した装備外観アセットなし」。写真との構造比較は [既存実物4ハンドル＋3チップ](../mouthpiece-handle-skins-20261009.md) と [使用・着脱写真](../hose-and-mouthpieces-20261009.md) を使う。元写真の広告・人物・ロゴは生成しない。

[同じ想定縮尺での比較](comparisons/concept-relative-scale.jpg)では長いハンドルと短いチップを区別。ハンドル30cm／チップ4cmは**本候補の設計目安**であり、写真から測った実寸でも全製品の共通規格でもない。上の拡大一覧で両者が同じ大きさに見えても実使用で同じ縮尺にしない。

## 接続・検品

![接続仕様](connection-spec.svg)

- 単体なのでホースなし。ハンドル根元は柔らかいホースへ、先端の開口は1個の短いチップへ接続する構想。導入工程で差し込み方式・内外径・挿入量を組ごとに確定する。
- 原寸目視で単一軸・両端開口・分岐なしを確認。金属／墨黒／半透明樹脂の材質差あり。星月の携帯リングは側面の独立金具で、煙の経路にしない。
- 灰背景合成で大きな背景矩形や白縁なし。alphaは0〜254で完全不透明画素なし。配信用の仕上げでは濃淡背景での輪郭・alpha正規化を検討する。原画を勝手に加工して合格済みにしない。
- 実使用のホース装着・手の握り・口との寸法・首掛け携帯・チップ嵌合は未制作／未検証。単体原画を完成した装備切替と扱わない。
- トングは資料待ちで対象外。新規キャラ・衣装・能力・価格・解放・採点は変更しない。

## 現行実装と再利用範囲

| 箇所 | 実装状況／影響 |
| --- | --- |
| `data/equipment.json` | bowl／hms／charcoalが正本。価格・性能・gift等を持つ。handle／mouthpieceカテゴリなし |
| `remake/js/core/state.js:15,42` | 初期所持3点、equipはbowl／hms／charcoal、SCHEMA11。見た目保存欄なし |
| `remake/js/craft/steps.js:54` | 所持品から上記3装備を選びstate.equipへ戻す。能力装備の選択コードは存在するが外観切替ではない |
| `remake/js/daily/status.js:159` | 持ち物はownedとequipを一覧表示。外観を選ぶ操作はない |
| `remake/js/daily/shop.js:18` | 販売対象3カテゴリ。売買に新カテゴリを勝手に追加しない |
| `remake/js/craft/art.js:87` | 本体・ステム・皿・ボウル・炭を組み上げる描画。独立ハンドル／チップ描画層なし |
| `remake/js/craft/skin.js:4` | SKINSは制作UIのボタン・パネル。装備外観とは別 |
| `assets/ui/making/` と人物CG | 持ち方・ホースは工程絵やCGへ描き込み。独立4スキンの差替え画像は従来存在しない |

再利用できるのは既存の所持品表示や選択ダイアログのUI部品まで。**機能としての着せ替えはまだない**。採用済み4デザインの外観保存と描画層は、別実装Issue [#437](https://github.com/haseatsu114514-dot/shisha-game/issues/437) へ分離した。能力装備のequipへ直接追加すると旧セーブ・所持・売買・制作選択まで影響する。初期装備は維持し、旧セーブの既定外観／保存・復元／PC・スマホを確認してから接続する。

## 検証と残作業

Git Safety・diff check・4PNGデコード／透明角／ハッシュPASS。`assets/`・`data/`・`remake/`の差分なし。既存save_load.mjsは6ケースPASS（全枠・旧セーブ・不正JSON・PC・スマホ・縦回転）。結果は [save-load-results.json](save-load-results.json)。現行持ち物・ショップのPC／スマホ検品は [ui-results.json](ui-results.json) と [比較フォルダ](comparisons/) を参照。

上記のsave/load・現行UI証跡はPR #395の制作時点の検証で、外観切替を実装したテストではない。採用記録時点の基準mainは `eca6a3d12ec4bb8918ef8eb773f08bf816da16b5`。既存4PNGのハッシュ・寸法・RGBA・alphaを再検証し、原画・生成指示・比較画像に差分がないことを確認した。ゲーム実装には変更がない。

## 採用判断と導入への引き継ぎ

オーナー回答（2026-10-12、この作業セッション）：

> 4案とも採用し、ゲームへの外観導入は別Issueで進める

[判断の記録](https://github.com/haseatsu114514-dot/shisha-game/issues/374#issuecomment-6126516611)。夜潮・SHISHARKブルー・水晶のしずく・星月のチャームを既存原画のまま採用し、`candidates.json` の `approved` を全4点 `true` に更新した。承認範囲は**デザイン採用**。配信用素材の仕上げ完了・実機適合・ゲーム登録を表さない。制作時のworker・生成指示・元ハッシュは保持し、今回の採用worker／claim／statusは `adoption` に記録する。

[外観導入Issue #437](https://github.com/haseatsu114514-dot/shisha-game/issues/437) へ、次の3工程を引き継ぐ。

1. ハンドル／短いチップを別カテゴリで継続追加できる外観カタログ・描画契約と、配信用サイズ／アンカー／alpha仕上げ。実物参照で接続・嵌合・手持ち／口サイズも確認する。
2. 既定外観と4採用IDの選択・描画反映・保存／復元。能力装備と分け、旧セーブや未知IDは安全な既定値に戻す。初期3装備・価格・性能は維持する。
3. PC／スマホ／縦回転、明暗背景、ホース接続・装着時の縮尺、保存／読込／旧セーブの画面QAと証跡。

本採用記録では原画の加工・再生成・ゲーム導入を行っていない。トングは引き続き対象外。親 #374 は採用記録PRのレビュー・反映までopenとし、導入の未完は #437 で追跡する。
