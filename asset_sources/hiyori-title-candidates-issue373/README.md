# ひよりのランダムタイトル原画3場面（候補）

作業者E `codex-e-visual-20261011-01`。Issue #373予約成功 [38199919533](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38199919533)。基準main `134b1a5a327cf25ddab94b6ab4ed18d604735bbf`。

**オーナー未承認・本編未登録。** 正式立ち絵、顔アイコン、既存タイトル18枚は維持。3場面は夕暮れの帰路・静かな窓際で一服・雨上がりの街角。原画と実際の生成指示をこのフォルダへ保存する。窓際の初版は先端チップの描き分けを再修正中。

本人の正本は `assets/sprites/characters/hiyori/chr_hiyori_normal.png` と `assets/ui/face_icons/face_hiyori.png`、25歳・現在のポニーテール／白〜アイボリーの立ち襟フレンチスリーブのレースブラウス・黒パンツ。生成ツールへ実物の正式画像を添付した。既存keyvisualは質感だけ参照。表の静かな姿を描き、素顔と演技のネタバレ・回想の学生衣装を追加しない。

既存素材の調査：現在の6表情と顔アイコンは採用済み。`asset_sources/character-intros/hiyori-senkou-v1/source.png` は人物なしの1672×941導入背景で、本編の一度限りのカットインで使用中。ランダムタイトルの縦原画へ流用しない。Issueにある別チャットの草案3場面は、正式な独立3PNG・承認・本編登録が未完了と記録され、checkoutに当該原画もない。別人素材や横長背景で穴埋めしない。

採用後の接続：承認されたPNGだけ `assets/ui/title_arts/` に配置し、`python3 remake/tools/build_manifest.py --title-only` で表示WebPとmanifestを生成。既存のキャラ均等・同キャラ連続回避・1枚先読み・フォールバック・セーブ不変を維持する。全3枚採用なら7人21枚となり既存テストの期待値をその時点で更新する。採用前の仮登録はしない。
