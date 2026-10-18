# 朝霧ひより・正式立ち絵（#664）

オーナーの「他キャラと身長同じぐらいになってればこれでいきたい」に合わせ、13表情を正式素材へ登録した。斧投げの4表情も普段と同じアイボリーのレースブラウス、黒スラックス、黒ローファー。投擲中だけバッグを画面外へ置き、構え・投擲・笑い・喜びの姿勢と表情でギャップを出す。`office_mukii` は普段着の可愛い怒り顔で、斧投げ成功時の喜びとは区別する。

## 原画と書き出し

- `raw/<face>-source.png`: image_gen原画13枚。初期案とジャージ案はGit履歴に残し、現在の4枚は普段着版。
- `generation.json`: 実生成指示、参照順、原画SHA-256、採用状態。
- `export.py`: 原画から896×1200透過PNGを出す手順。透明域のごく弱い残留アルファを除き、人物高1000px、足元y=1173へ合わせる。
- `runtime_export.json`: 各表情の原画・PNG・WebPのSHA-256と不透明部分の矩形。
- 再書き出し: `python3 asset_sources/portraits/hiyori-redesign-issue664/export.py --source-dir asset_sources/portraits/hiyori-redesign-issue664/raw --output-dir assets/sprites/characters/hiyori` → `python3 remake/tools/build_manifest.py --portraits-only hiyori` → `python3 tools/make_face_icons.py hiyori`。登場演出のフレームは`intro_art()`からひより分を再計測する。

## 縮尺

896×1200の元画像上で人物高は、凛1000px、アゲハ973px、みんと938px、旧ひより1152px。新ひよりは**全13表情で1000px**。会話画面の `spriteScale` は凛0.97、ひより0.94なので、実表示の人物高の差は約3%。同程度の大きさで表示される。登場演出の配置値も新画像から更新した。

## ゲームへの接続と確認

- 既存11表情のPNG／可逆WebPと顔アイコンを更新。`axe_throw`、`office_mukii`をmanifestへ追加。
- 斧投げ本編で`axe_throw`を投擲時、`axe_shout`を成功時、`office_mukii`を儚さを主張して爆発する台詞へ接続。キャップ・着替えの記述を普段着へ修正。
- `qa/hiyori-runtime-height.jpg`: 書き出した正式PNGを他キャラと実寸比較。`qa/hiyori-runtime-desktop.jpg`: PC会話画面の通常・投擲・爆発顔。`qa/hiyori-13-contact-v3.jpg`は全原画一覧。
- 13枚すべてで896×1200、アルファ矩形の高さ1000px、足元1173pxを確認。ブラウザでPC／タッチの全表情・背景・WebP読込・保存不変と、ひより斧投げシナリオを検証。
