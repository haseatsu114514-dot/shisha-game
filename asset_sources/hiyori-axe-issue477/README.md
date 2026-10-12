# ひよりの斧投げ素材（#477 / 旧 #342 A）

25歳・現在のポニーテール・茶色の目と採用済み人物像を維持し、OpenAI image_genで制作。原画は `raw/`、実指示は `prompts/`、元画像・サイズ・SHAは `generation.json` に保存。外部素材・実ロゴ・シーシャ機材を使用していない。

| 用途 | 本編のキー |
| --- | --- |
| キャップ/Tシャツ：通常・爆笑・大声 | `axe_normal`, `axe_laugh`, `axe_shout` |
| 採用済みレース衣装：真剣・恋愛の照れ | `serious`, `love_blush` |
| 専用夜背景：投擲レーンとラウンジ | `bg_axe_lounge_night` |

既存6表情と顔アイコンの13ファイルは `baseline.json` のSHAを維持。共通フレーミング `h/b/ax/aspect` は変更しない。`register.py` は機械的な透明キャンバス・足元合わせと既存WebPエンコーダによる登録だけを行う。新PNGは896×1200 RGBA、WebPはRGBAが完全一致する可逆圧縮。背景は生成原画そのままの1672×941、配信用WebPを追加する。

```sh
python3 asset_sources/hiyori-axe-issue477/register.py
python3 asset_sources/hiyori-axe-issue477/validate.py
node remake/test/browser/hiyori_axe_assets.mjs
node remake/test/browser/save_load.mjs
node --experimental-vm-modules remake/test/lime_consistency.mjs
```

QA：旧6＋新5の全11表情を実VNでPC・タッチ横持ちに表示（22画面）。欠落画像・ブラウザ例外・文字や操作ボタンの切れなし。表示前後でセーブ状態が一致。旧保存・手動/自動スロット・設定・PC/スマホ操作6ケースとLIME回帰も通過。顔・服・透明境界・表示縮尺・背景を実画面で目視確認した。代表画面と結果は `qa/`、全画面はCI artifactに保存する。

素材登録は正式台本の読了・素顔発覚・好感度・関係状態を変更しない。斧投げミニゲームは別Issue。旧 #342のランダム画像5パターン、他衣装と未使用表情は残作業であり、このPRで全体完了扱いにしない。
