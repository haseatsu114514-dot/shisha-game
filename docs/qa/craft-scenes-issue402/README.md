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

## オーナー追加指示（2026-10-12、修正中）

1. フレーバー選択のタッパー数を減らし、所持フレーバー数/種類に左右されない構図へ。固定の葉の種類や在庫数の描写を避ける。
2. はじめの眉・目元を自然に緩め、怖さを減らす。強制的な笑顔にはしない。
3. アルミ穴あけは入力に合わせて手元の数コマを再生し、実際の穴が増えていく表示にする。判定/穴テンプレ/温度/進行は変更しない。
4. 追加写真のように、容器本体の長い前面を広く覆う横長の白シールへ。小さい低位置の札とは異なる。蓋や密閉縁は跨がない。商品名は模写しない。

この訂正後の素材/実装/QAはまだ進行中。上の初稿PASSを修正版のPASSとみなさない。#355は別worker予約中で完全除外、#360の背景/#356の弾幕処理へは着手しない。
