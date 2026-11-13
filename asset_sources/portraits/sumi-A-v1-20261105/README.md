# スミさん A基準の5表情

ユーザーが選定したAを通常絵の正本に固定。現行の全5表情（通常・笑顔・真剣・驚き・思案）と使用場面を実見し、年齢・感情と意味のある腕の仕草を保って再制作。帽子・眼鏡・髭・服・小物のデザイン変更はなし。新規デザイン変更がない人物は確認を待たず進める最新指示に基づく登録。旧絵は保持し、設定の新立ち絵で選択する。身長設定182cm・倍率1.05は変更しない。

`*-untouched.png` は正規画像生成の未加工原画。`generation-conditions.json` は役割別参照と全生成条件、`current-expression-usage.json` は現行の使用例、`normalization-review.json` は承認済み通常絵を基準とする全表情共通のLANCZOS縮小・配置の記録。表情・腕は生成ツールで制作し、顔の合成や後からの色調補正はしていない。最終足元の差は約1px以内。

ゲーム用896×1200 RGBAは `assets/sprites/character_variants/new/sumi/`。`python3 remake/tools/build_manifest.py --portrait-variants-only sumi` で旧版を保持しながら独立した余白・足元・WebPを更新する。
