# 限定フレーバー3種（#896 A5）

NIGHTSIDEアールグレイ試作、アフサールのカルダモン、アルファーヘブンのラベンダーを生成。原画PNG・実プロンプト・参照とSHA256（sources.json）を保存した。2026-10-23の依頼に基づく初稿。正式採用・公開・台帳全体の完了は未実施。

| NIGHTSIDE / EARL GREY | AFSAHR / CARDAMOM | Alpha Heaven / LAVENDER |
| --- | --- | --- |
| ![](nightside_earlgrey.png) | ![](cardamom.png) | ![](lavender.png) |

NIGHTSIDEは黒地・鮮やかなベルガモットと琥珀色の紅茶。台帳に記されたMANGO LASSIの配色・構成指定を用いたが、添付参考写真そのものは取得していない。味はマンゴーに変更していない。カルダモンは既存rose.webpの太陽ロゴ・斜め帯・幾何学図案を参照。ラベンダーはmint.webpの白い翼と輪、筆跡、植物画を参照。メーカー名、入手条件、価格、試香専用・非売品制限、物語上の「一袋」は変更していない。

生成後に3枚を目視。箱の閉じた薄型形状、上面・右側面、素材の種類、透過を確認。ブランドロゴは参照を再描画したもので画素一致ではない。原画は無加工で保持し、tools/build_limited_flavor_art.pyで512×512 WebPへ縮小・圧縮。新規3枚合計80,636 bytes。実bboxから既存windowArtの同倍率・余白で描画する。原画と既存18箱を置換しない。

表示登録はremake/js/daily/shop-art-limited.js。既存フレーバー箱と同じ直接URL方式のため、CG用manifestには追加しない。shop.jsのflavorPackageArtだけへ追加mappingを接続し、店頭販売18種のリストには追加しない。

## 検証と残件

- build_limited_flavor_art.py / --check成功。PNG全decode、SHA256、RGBA、透過、枠内bbox、WebP再現性を確認（validation.json）。
- 実Chromiumで新規ブラウザcontextのstateに5種を設定し、実newSession('drill')→openBench→stepMixを表示。PC 1280×720、横タッチ844×390、DS 1280×720で3種と既存2種の512px decode成功。画像errorイベントで既存「フレーバー」fallbackへ戻り、state不変（browser-qa.json）。自然な贈与からの通しプレイではなく表示fixture。
- qa-pc.png / qa-touch.png / qa-ds.pngを目視。PCで既存2箱と新規3箱が同じ倍率で表示されることを確認。横タッチは一覧スクロールで各画像へ到達。
- **DSの配合欄の右端切れは未解決。** 変更前shop.jsをブラウザrouteで供給し、同じfixture・viewportで再現（qa-ds-base.png、browser-baseline-qa.json）。パネル幅760、右端1418、viewport1280。画像のdecode成功を画面全体の受入合格とは扱わない。修正は別途必要。
- node --experimental-vm-modules remake/test/shop_display_775.mjs成功。初回はVMフラグ無しで起動して失敗、正規フラグで再実行。JS構文、git diff --check、Git Safety成功。
- 全章通し、実機Safari、自然な入手・試香・大会経路、CI、独立レビューは未実施。Draft PRで保存し未マージ。

予約申請comment6365523043にbot応答なし。ユーザーがこのチャットで「今回の3種は進めてよい」と明示した例外承認の範囲で進めた。worker: codex-896-flavors-20261023-a。予約成功とは記録しない。他項目の予約を取得したとは扱わない。

NEXT: 3種の採用確認、DSレイアウト残件の処理、PRの必要CI・レビューを完了して統合。A1〜A4/A6以降は今回未着手。

## 採用・DS再確認（2026-10-23追記）

ユーザーが3種を了承し「ゲームに反映」と指示。予約run39958116924もsuccess、CLAIMED_ISSUE=896と最新bot owner/run一致を確認。

前回のDS右端切れは、game-ds.cssが座標式工程共通の760px幅と横スクロールを意図しているため、画像追加による操作不能ではなかった。実ブラウザでラベンダーの追加ボタンをclickすると横スクロールで到達し、mix.lavender=1を確認。パネル右端は1255（viewport1280）へ移動。qa-ds-scroll.pngとbrowser-ds-scroll-qa.jsonを追加。前回の静止画像だけから未解決不具合と扱った判断を訂正する。CSSは変更しない。CI完了と統合はPRの最新状態を参照。
