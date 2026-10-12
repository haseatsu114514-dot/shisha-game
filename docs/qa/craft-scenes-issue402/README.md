# 工程別制作演出 #402 のQA

開始main eca6a3d。WORKER codex-craft402-20261012-6be8a561d8 / claim38258703042・status38258875454 SUCCESS。PR #432（未マージ）。

## 初稿の確認（後続のオーナー訂正より前）

- 新規worker_scenesのPC/実タッチ・工程/表情・吸引/泡・通信待ち・表示Imageのdecode待ち・破損・15秒超過後の遅着・既存蒸らし素材の破損・decode無しブラウザ・reduced motion、11ケースPASS。
- 既存steam_forecastのPC/実タッチ/二本指/精密操作/リフレッシュ/予測/固定温度計PASS。
- craft_progress 4ケースPASS（成功/失敗・既存2回care・固定ヘッダー）。ch1_tournament 8ケースPASS（素材待ち/SKIP/炭/2回care/結果PC・横・縦）。
- mix_temperatureの64フレーバーと768境界PASS。steam_temperature 11,340サンプルPASS。
- Git Safety・JS構文・diff check・check_agent_docs PASS。manifest差分はmaking6枚/そのbbox/WebP/生成時刻だけ。背景/タイトル18枚/正規立ち絵/未採用候補の登録は不変更。
- foil_holes.mjsはVM fixtureが存在しないcraft/data.jsを読むためFAIL。同じmain eca6a3dの独立した許可worktreeでも同じENOENTを確認。穴あけのゲーム仕様を変更して直した扱いにはしていない。

画面は[screens/](screens/)。1280×720 PC、844×390 Chromiumタッチエミュレーションであり実機スマホではない。公開版は未マージのため本変更を検証できていない。

## オーナー追加指示（2026-10-12、反映済み）

1. フレーバー選択のタッパー数を減らし、所持フレーバー数/種類に左右されない構図へ。固定の葉の種類や在庫数の描写を避ける。
2. はじめの眉・目元を自然に緩め、怖さを減らす。強制的な笑顔にはしない。
3. アルミ穴あけは入力に合わせて手元の数コマを再生し、実際の穴が増えていく表示にする。判定/穴テンプレ/温度/進行は変更しない。
4. 追加写真を参照した後の「長い側面までシールがあるのが違和感」という訂正を優先。mix-v3/pack-v3は短い端面の1枚だけへ修正し、角をまたがず長い側面/蓋は無ラベル。商品名は模写しない。

## 修正版の確認

- worker_scenes **19ケースPASS**。[生の結果](worker-scenes.json)と[screens/](screens/)を保存。PC/実タッチ入力/縦向きの既存回転案内→横向きの実タッチ/全工程と精神・疲労顔/実吸引と泡/実穴と針先/連打・重ね打ち/3コマ・24穴の表示/やり直し/低速回線/表示Imageのdecode待ち/手の1枚だけ破損/全体破損/15秒超過後の遅着/既存蒸らし素材破損/decode無し/reduced motionを確認。
- `foil_holes.mjs` PASS。VM fixtureに欠けていた温度モデルのDB参照stubを追加し、既存の全テンプレ・正確な24/0/0と12/12/0・完成条件・時間切れ継続・熱応答assertを実行。表示通知の実穴数/重ね打ち/無効入力も検証。ゲームの判定/熱モデルを直してPASSにしたものではない。
- `steam_attack_growth.mjs` PC/実タッチ・reduced motion PASS。新しい作業台の画像待ち中に未生成ボタンを参照していた再開fixtureだけをnull-safeな待ちへ修正。弾幕/斬撃/リフレッシュの本番処理は不変更。
- 修正版の`steam_forecast.mjs` PC/実タッチ/二本指/精密操作/タイマー/温度予測/リフレッシュ/固定温度計PASS、`craft_progress.mjs`の4ケースPASS。初稿だけの結果を流用せず、9レイヤー実装後に再実行した。
- manifestの差分はmaking9枚/そのbbox/WebP/生成時刻だけ。背景・正規立ち絵・タイトル・未採用候補は不変更。9枚の配信WebP合計1,015,624bytes。原寸・全実プロンプト・参照順・旧稿/不採用理由・SHA256は[素材記録](../../../asset_sources/craft-scenes-issue402/README.md)。
- 初稿f41052dのGitHub CIでは、泡のフェード開始直後を即座に検査するタイミングと、上記未生成ボタン参照の2件でFAIL。前者はフェード中の表示を待って検査、後者は未生成を待つfixtureへ修正。修正版CIの実行結果はPR #432へ記録する。

実行コマンド:

```sh
node remake/test/browser/worker_scenes.mjs
node --experimental-vm-modules remake/test/foil_holes.mjs
NODE_PATH=remake/test/browser/node_modules CHROME_EXECUTABLE_PATH=<Chromium> node remake/test/steam_attack_growth.mjs
NODE_PATH=remake/test/browser/node_modules CHROME_EXECUTABLE_PATH=<Chromium> node remake/test/steam_forecast.mjs
node remake/test/browser/craft_progress.mjs
```

残る確認: 物理スマホ/Safari、公開版（未マージなので変更なし）、選択装備全種類の手元画像差分。葉詰めは代表的ファンネルを描く。#355は別worker予約中で完全除外、#360の背景/#356の本番弾幕処理に変更なし。追加確認した他workerのOpen PR #435/#436/#438を取り込まない。
