# セットA：商店街の同一構図・昼夜と曇天

Issue #360。基準main `eca6a3d12ec4bb8918ef8eb773f08bf816da16b5`。
worker `codex-visual360-20261012-ac3264e05686`。旧workerの停止・push済み成果・PR #369のマージを管理者としてレビューし、Issueへ記録。旧release run `38258716702`、新claim `38258863589`、status `38258998656`はすべて成功。

## 制作・採用

組み込み画像生成機能 `image_gen.imagegen` で4枚を実生成。旧昼画像を街並みの基準に新しく描画し、その採用画像から夜・曇天差分を制作した。単純な拡大ではない。生成原寸1672×941を1920×1080へLanczosで正規化したため、ネイティブFHD生成とは区別する。

旧昼夜で店構えが別店舗（シーシャ店／パン屋・花屋）になっていた不一致を解消。建物、ドア、庇、看板、街灯、電柱、ケーブル、歩道を同じ位置に維持。看板は無文字の幾何学意匠。人物・UI・ロゴ・車・シーシャ機材を追加しない。暖かな土色と青い夜空、細かなピクセルの輪郭を本作へ合わせ、下部は会話枠用の静かな路面にした。

`generated/` は無加工の生成原寸、`previous/` は旧PNG/WebP、`prompts.json` は全生成指示と参照関係、`inventory.json` はサイズ・容量・SHA256。生成サービス側にも原画像を残した。

## 接続と容量

- `assets/backgrounds/bg_street_{day,night,overcast_day,overcast_night}.png`。
- 配信は対応する `remake/img/backgrounds/*.webp`（q62／method6）。背景限定ビルドでmanifestへ登録し、既存 `sceneBg()` が昼夜・天気を選択する。
- 曇りと雨は曇天画を共有。雨の日だけ既存の屋外34滴アニメーションを重ね、曇りの日には雨を描かない。
- 晴れ昼夜は旧384,740→新454,630 bytes（+18.2%）。4枚全体817,302 bytes、1枚175〜246KB。新しい一括先読みは追加せず、必要な差分を選択時に読む。
- 自宅・となり・マップ・タイトル・紹介絵・チェキの完成素材、台本、天気抽選、セーブスキーマは維持。旧パスを削除せず、曇天未制作の施設は既存のフォールバックを使う。

## 検証

PC1920×1080／スマホ横844×390・タッチ設定 × 晴れ／曇り／雨 × 昼夜の商店街12ケースを、既存の自宅・となり24ケースと合わせて検証する。縦390×844の回転案内と未制作施設フォールバックを含め全38ケース。実ゲームの会話エンジンと画像デコードを使用し、背景の選択・FHD寸法・雨の範囲・会話枠の収まり・永続セーブ不変・HTTP/ブラウザエラーを検査。これは条件を設定した表示QAであり、自然なイベント入口の検証とは分ける。

```sh
python3 remake/tools/build_manifest.py --backgrounds-only bg_street_day.png bg_street_night.png bg_street_overcast_day.png bg_street_overcast_night.png
python3 remake/tools/serve_preview.py --port 8360
NODE_PATH="$PWD/remake/test/browser/node_modules" BASE_URL=http://127.0.0.1:8360/remake/ ARTIFACT_DIR=asset_sources/ch1-visual-quality-issue360/set-a-street/review node remake/test/ch1_visual_quality.mjs
```

表示QAは38/38 PASS、データローダ35 JSONの並列上限・失敗・タイムアウト検査PASS。manifestは `generated`・`backgrounds`・`webp` 以外のフィールドが完全一致。VN画像待機／SKIPと第1章通し・セーブロードの最終結果は `validation.json` に記録する。PC・スマホの実画面は `review/`。

## 残作業

セットB（第1章で現行到達する他施設）、セットC（古い横長CGの本人性・構造確認と再制作）は別PRで継続。自宅・となりを再生成しない。BG01/HF08の未受領原本、未登録CG、未使用プレースホルダーを完了扱いにしない。レビュー前にmainへマージしない。
