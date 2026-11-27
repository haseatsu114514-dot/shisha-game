# あげは「うわっ…私のシーシャ、軽すぎ…？」パロディバナー

有名な求人バナー「うわっ…私の年収、低すぎ…？」のパロディ。ゲーム本編では使わない、SNS・ネタ用の画像。

- 完成画像: `ageha_shisha_karusugi.png`（1160×960）
- 写真枠: `photo-pose.png`。元ネタと同じ「両手で口元を覆う」ポーズを、OpenAI 画像API（images/edits）で描き直した `pose-candidates/pose-01.png` を切り出したもの
  - 参照画像は `photo.png`（既存の立ち絵 `chr_ageha_surprise.png` を、ぼかした MELTY PUFF の店内背景に重ねたもの）と通常立ち絵 `chr_ageha_normal.png`
  - `pose-02.png` は同じ指示で出した不採用の候補
- 見出しは元ネタに寄せて「私の」（オーナー指定。キャラ設定上の一人称は「うち」）
- シーシャ器具は写していない

## 作り直し

```sh
cd asset_sources/parody/ageha-karusugi-banner
python3 make_photo.py          # 参照用の photo.png を作る
python3 generate_pose.py 03    # ポーズを描き直した候補を pose-candidates/pose-03.png に出す（OPENAI_API_KEY か、クラウド環境のネットワークシークレットが要る）
# 採用した候補を 520x508 に切り出して photo-pose.png にする
node shot.js "$PWD/banner.html" "$PWD/ageha_shisha_karusugi.png"
```

文言は `banner.html` を直接書き換える。フォントは Google Fonts（Noto Sans JP / Noto Serif）を読むため、書き出し時に通信が要る。
