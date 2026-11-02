# 5人の不足表情（Issue #2218）

2026-11-02 に Codex built-in imagegen を用い、各人1回・1表情を生成。生成機能のモデル ID は公開されていない。透過背景を指定した。各 `prompt.txt` は実際に渡した全文。原画 `*-source.png` は生成結果を無加工でコピーした。ゲーム用は 896×1200 RGBA に縮小配置し、normal の足元・横重心へ合わせた。太陽のみ normal の挙手で人物全体の bbox が伸びるため、頭から足までの大きさで倍率を調整した。

| 人物・表情 | 参照1 normal SHA-256 | 参照2 表情 SHA-256 | 原画 SHA-256 |
|---|---|---|---|
| rei / sad | `ab89bd5277249c637273f406b48ab7dc9876cfb219ca5e3fb99e2380b17b674f` | serious `5c4dbb9e96450bb18d319e9d8e1de4c23d2306e8ddedbf5e4e615b972b1b8b13` | `5d9acd8bfb249973cf0c85be3fe921b2c30a19480c487d9efef665fe85dee215` |
| steve / sad | `6053510bfa3b52e3fe66dde0071af133fdae931410ad919eb47323a6b5d89735` | serious `18a1d3dda7f35bcf3517424fa7fe6a69543b04ad2dd0c34ccb98c7fcf349d722` | `cd6f77dd8eeb2b8b77becaed291ba90a16c60d07a65542b5d483f5a53225cedb` |
| volk / sad | `d27c36f36b074daadb9a860255c4a6cc04c11059d336f198867736630a681533` | serious `3580c802ee352860fa18043ac588ee333f065d7956ebb570ee0b79524faa7719` | `b60517f635e5e3c9956e4a61e4b5bcf2ed7117f011affe92fabab9a06b3722cf` |
| sheikh / surprise | `96cce4308d9a6c72c66276a637fa1ece92439875d8d013ce9434e04bb9236ebd` | smile `f0f69d09b193910aece821e4bfdaeedf2d426611ebb586956823546caaf84b98` | `d09135c03658c299b086abdc3528e933285954fd43d1534464bdb5b2b0ff72cb` |
| da_silva / serious | `138df18ab350103ee433a7cf3c688753f0a17b502cff899e7cc078aa3f95f0c7` | smile `b103a4a4862a15ec82b7a894b8796ffb4f351f5812f834a5922aab6426fae951` | `f088d30e681d854af4762673bf08107c8a3b90e3ade989c2d440f97a771d8f24` |

ゲーム用 PNG と lossless WebP を追加し、`remake/data/manifest.json` の `portraits` と `webp` に登録した。既存台本は変更していない。太陽の serious 指定行は既存の `data/dialogue/growth_lessons.json` にある。
