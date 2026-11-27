# あげは「うわっ…うちのシーシャ、軽すぎ…？」パロディバナー

有名な求人バナー「うわっ…私の年収、低すぎ…？」のパロディ。ゲーム本編では使わない、SNS・ネタ用の画像。

- 完成画像: `ageha_shisha_karusugi.png`（1160×960）
- 写真枠: 既存の立ち絵 `chr_ageha_surprise.png` を、ぼかした MELTY PUFF の店内背景に重ねたもの（新規生成の絵は使っていない）
- 一人称はキャラ設定（`data/characters.json` の `voice.first_person`）に合わせて「うち」
- シーシャ器具は写していない

## 作り直し

```sh
cd asset_sources/parody/ageha-karusugi-banner
python3 make_photo.py          # photo.png を作る
node shot.js "$PWD/banner.html" "$PWD/ageha_shisha_karusugi.png"
```

文言は `banner.html` を直接書き換える。フォントは Google Fonts（Noto Sans JP / Noto Serif）を読むため、書き出し時に通信が要る。
