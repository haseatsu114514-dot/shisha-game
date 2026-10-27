# 画像バッチ再開checkpoint

今回：**5call成功、5枚新規保存。既存4枚を保全し、合計9候補。** 全体の未制作queueは残る。

## 新規保存

|対象|保存先|QA上の不足|
|---|---|---|
|追加：ムカイA・ジャケット|[candidates/portraits/mukai-master/v1/direction-A.png](candidates/portraits/mukai-master/v1/direction-A.png)|余白/微細alpha縁/保存表示|
|追加：ムカイB・長いカーディガン|[candidates/portraits/mukai-master/v1/direction-B.png](candidates/portraits/mukai-master/v1/direction-B.png)|余白/微細alpha縁/保存表示|
|追加：機械A・二足型|[candidates/portraits/deus-robot/v1/direction-A.png](candidates/portraits/deus-robot/v1/direction-A.png)|切抜き/ぼかし/余白/保存表示|
|追加：機械B・据置型|[candidates/portraits/deus-robot/v1/direction-B.png](candidates/portraits/deus-robot/v1/direction-B.png)|切抜き/ぼかし/余白/保存表示|
|追加：Dubai市場端の日陰|[candidates/backgrounds/v1/dubai-market-shade.png](candidates/backgrounds/v1/dubai-market-shade.png)|保存表示/ゲーム合成未検証|

## 確認できたことと未確認

- 生成時inlineは実目視。ムカイ：深い帽子/髭/落ち着いた人物、ジャケットと長いカーディガンの差。robot：クローム/紫/左右センサー、二足と据置の差。Dubai：市場端/日陰/二脚の椅子/落ちた紙コップ/無人。
- 5保存PNGは元builtin出力とbytes一致、SHA256・画素読込・寸法・alpha統計を記録。透過4枚はRGBAだが、alphaがあるだけで綺麗な切抜き合格とはしない。
- 保存ファイルview_imageはMukai/robotで黒い像、Dubaiで不完全な小像に見え、生成inlineと異なる。原因未特定。保存画像表示PASSとしない。元出力とのbytes/SHA一致とPNG画素読込は別途確認。ブラウザ/別profileでの迂回なし。
- 各立ち絵の10%余白未達。ロボットは紫の場が見え、尖ったパネルも残る。採用には輪郭/余白/印象の判断が必要。修正生成・加工はしていない。
- ムカイの年齢印象と既存スミからの識別性、B手の重なり、robotの細部機構、実ゲーム縮小・台詞合成は未検証。
- 現mainのタイトルWebPと手元原画のGitblob一致を確認し実view。タイトル用機械をSHISHA-9000の採用立ち絵と同一視しない。全身の形は今回のお任せデザイン候補で新canon設定ではない。

## 次queueと必要入力

- 未制作flavor：他46件は明示個別mappingがないという一覧で、46枚が未制作確定ではない。dragonfruit/kiwi等を選ぶ前にシート/旧候補を照合する。
- Mukai/3章spot背景：具体scene・場所/時間・既存候補確認が次。ムカイ本人2案/猫2案を再生成しない。
- 機内/他Dubai：空港到着1・市場端1は候補あり。機内は正確な台本sceneが今回の限定読取範囲で未特定、勝手な渡航会話を追加しない。
- 3章以降不足人物：nandi/steve/master_hookah/emil/sheikh/da_silva等はmanifest gap候補。各人物の役割/章/実参照/未公開候補の確認を経て2方向ずつ。SHISHA-9000は今回robotを自動充当しない。
- Rei別3案/TLS参照、Amaburst base未確定は別保留。Ch2still/プリクラ/TRPG/斧手元は新提案のまま生成しない。

実際の上限/ツール拒否・追加課金要求はなし。古い9%をblockerにしていない。今回は保存・QA不足を明示した自然checkpoint。残制作を完了扱いにはしない。

## 成果

本人Macで開く比較HTML：`asset_sources/repair-handoff-20261027/archive/dots-dispatch/c-image-asset-batch-1250/comparison.html`。ローカル参照9枚の実在を検証、外部network依存なし。ブラウザ起動なし。

原画・実送信prompt・ref path/bytes/SHA/用途/送信先・tool結果・QAはGENERATION-RECORDS/各UNIT/TOOL-RESULTSへ保存。空港Libraryは既存IDのまま、今回upload0。本編・manifest・SAVE・外部公開・PR/merge変更0。
