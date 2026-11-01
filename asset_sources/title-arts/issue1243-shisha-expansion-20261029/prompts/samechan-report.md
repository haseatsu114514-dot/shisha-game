# 生成レポート：サメちゃん（候補6〜8）

- 作成日：2026-10-28
- 生成ツール：内蔵 image_gen（CLI/API フォールバック不使用）
- 生成方法：3枚とも参照画像付き新規生成。参照画像そのものの部分編集ではなく、各指定場面を新しく構成。
- 参照画像：sprite_normal.webp（容姿の主参照）、titleart_ref.webp（顔・配色・店内の雰囲気の補助参照）。
- 3枚とも PNG、1024 × 1536 px、縦横比 2:3。サイズ変更・切り抜き・形式変換なし。
- 入力の INSTRUCTIONS.md、prompts.md、参照画像2枚は変更していない。
- 自己評価：5が最高。評価は生成後の目視によるもので、厳密な同一性を保証するものではない。

| 候補 | 場面 | 生成方法 | サイズ | 保存バイト数 | 再生成 | 明らかな破綻 | キャラの一貫性 | 場面の再現度 |
| --- | --- | --- | --- | ---: | --- | --- | --- | --- |
| cand_6.png | korochan_duet_rings | 参照付き新規生成 | 1024×1536 | 2457334 | なし（生成1回） | 顔崩れ・明確な指の異常・別人化・文字混入は見当たらない | 5/5 | 4/5 |
| cand_7.png | blue_base_supervision | 参照付き新規生成 | 1024×1536 | 2776628 | なし（生成1回） | 顔崩れ・明確な指の異常・別人化・文字混入は見当たらない | 5/5 | 4/5 |
| cand_8.png | tide_scepter_declaration | 参照付き新規生成 | 1024×1536 | 2381100 | なし（生成1回） | 顔崩れ・明確な指の異常・別人化・文字混入は見当たらない | 5/5 | 4/5 |

## cand_6.png の確認

黒髪の青い差し色、青い瞳、小さな牙、サメ型ヘアピン、フードと銀色の装飾を維持。解剖学的な右手は王冠と星リボン付きの布製コロちゃんの内部、左手はマウスピースを持つ。小さな煙の輪が本人とパペットの口の近くに2個並び、顔は遮られていない。素焼きのハガル、ステム、青い水のガラスベース、ホースが見える。暗色の長ズボンと靴も確認できる。

留意点：マウスピースは口元から下げられているが、腰ではなく胸の高さ。シーシャは画面右端に寄り、ベースの右側が一部切れている。ホースの途中が器具の背後へ回るため、接続経路全体は追いにくい。全身の占有率は指定の60〜80%より大きめ。

## cand_7.png の確認

キャラの顔と髪・フードの特徴を維持。右手のパペットと左手のピッチャーが明確に分かれる。水流、氷入りガラスベース、滑り止めマット、外したステム、巻いたホース、素焼きのハガルが前景に揃い、シーシャの仕込みとして読める。人の追加や文字の混入は見当たらない。

留意点：構図は指定のやや見下ろしより、正面寄りの三四分角度。パペットはベースのすぐ隣より、本人の胸に近い高さ。カウンターが下半身を隠しており、長ズボンと靴の全体は確認できない。腰周りには参照衣装に近いプリーツ状の意匠が残る。

## cand_8.png の確認

キャラの顔と髪・フードの特徴を維持し、暗色の長ズボンを着用。右手のコロちゃんを掲げ、左手でシーシャの低いステムを握る。素焼きのハガル1個とガラスベース1個を備え、台座がベースを支持。ボウル下の装飾は三叉を連想させる。低い視点、顔への暖色光、青い反射光、前景の波状の煙を確認。煙の輪・玉座・追加人物はない。

留意点：足元は煙と画面端で一部隠れ、両足を踏ん張る姿勢は完全には読めない。キャラの画面占有率は指定より大きめで、パペットの掲げ位置も肩よりやや低い。フードは参照に合わせた黒寄りのスレート色。

## 使用プロンプト

各画像には prompts.md 内の対応する番号（6・7・8）の英語プロンプト全文を変更せず使用し、その前に以下の共通指定を付加した。参照の座り構図とピクセル風の質感を流用せず、容姿と小物の識別要素を引き継ぐための指定である。

```text
Use case: illustration-story. Generate a new title-screen key visual, not a copy of the reference composition. Both supplied images are CHARACTER IDENTITY REFERENCES, not edit targets. Match the SAME adult woman's recognizable face: vivid blue eyes, soft half-lidded gaze, small cute fang, black shoulder-length hair with strong cobalt-blue streaks and blue ends, turquoise small shark hair clip. Retain recognizable black/slate shark hood with white brim, blue fin, blue trim and silver accessories, adapted to the requested oversized shark hoodie and modest dark full-length trousers. The hand puppet is the reference's blue-and-white shark with gold crown and blue bow with gold star, adapted to a fabric hand puppet fully covering her anatomical RIGHT hand (viewer left when front-facing); do not show a bare hand holding a plush. Her anatomical LEFT hand is the only exposed working hand. Reference 1 sprite_normal.webp is the primary appearance reference, reference 2 titleart_ref.webp supports identity and warm cozy shop mood; do NOT copy the seated pose or pixel texture. Follow the scene specification below exactly. Output one portrait 1024x1536 PNG. No lettering anywhere.
```

各生成で参照画像2枚を指定し、transparent_background=false とした。

