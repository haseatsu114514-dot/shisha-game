# 配送便の地図アイコン（Issue #3022）

- 採用: D案（銀箱＋水色キャブの現代風トラック）。オーナーが 2026-11-10 に採用
- 生成: 仕事用 Grok Bot（fleet）による生成（プロンプト・候補4案は Bot 側の対応表に記録）。元の生成物は source-grok-D.jpg（1024px・白背景）
- 清書: ミューズが元の JPG から再マット（白さキー＋距離場で輪郭を滑らかに）。マスターは master-matte.png（透過）。Bot の自動透過版は輪郭が荒かったため不採用
- 組み込み先: assets/ui/map-facilities-delivery-truck.webp（384×334）→ remake/js/daily/facility-icons.js の delivery_truck（第5章「東京へ（配送便）」ch5_to_tokyo と「地元へ帰る（配送便）」ch5_tokyo_home のピン）
- 縁取り（クリーム白 #fff3df のシール風アウトライン）は画像に焼き込まず、ゲーム側の sticker フィルタが表示時に付ける
