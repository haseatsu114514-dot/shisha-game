# みんとの室内植物：CI97背景修正2案

Issue #375、worker `codex-visual-20261012-e492484f3b`。
基準main `eca6a3d12ec4bb8918ef8eb773f08bf816da16b5`。
[claim 38259990012](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38259990012) と
[開始gate 38260249119](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/38260249119) の成功後に制作した。

**2枚とも未採用・本編未登録。今回の範囲は原画・比較資料の保存。**
正式タイトルはひより追加後の7人21枚を維持する。アゲハ5修正案は選定保留を維持し、今回再制作しない。

| 原画 | 修正内容 | 指示と比較 |
| --- | --- | --- |
| [夜の一服](minto-night-ci97.png) | 遠景カウンターの小さな鉢植えを壁・カウンターへ変更。窓・ソファ・照明・人物・台の構図を維持 | [生成指示](minto-night-ci97.prompt.txt)／[前後](comparisons/minto-night-ci97-before-after.jpg)／[顔](comparisons/minto-night-ci97-face-detail.jpg)／[器具と手](comparisons/minto-night-ci97-hardware-detail.jpg) |
| [開店前の準備](minto-prep-ci97.png) | 窓と上部の室内蔦を除去し、青い窓・タイルへ変更。人物・縁を拭く手・冷たい別置きHMDを維持 | [生成指示](minto-prep-ci97.prompt.txt)／[前後](comparisons/minto-prep-ci97-before-after.jpg)／[顔](comparisons/minto-prep-ci97-face-detail.jpg)／[器具と手](comparisons/minto-prep-ci97-hardware-detail.jpg) |

元の未採用PNGは `../../minto/` に保持。両方とも画像生成機能で編集し、出力原寸1024×1536 RGBのPNGを同一バイトで保存した。
[candidates.json](candidates.json) に実際の生成元・指示・原画SHA256・参照出典・制約を記録する。
[composition.json](composition.json) は生成前の人物・場面・台・HMD・炭・ホース・吸い口・構図の設定。

## 検品と制約

- 正式normalを実際に開き、緑目・顔の輪郭・黒い長髪・角／蝙蝠・黒緑の営業衣装・ハート装飾を比較した。
- 夜の一服は、側面ポート→一つのたわみ→硬質ハンドル根元を両方向に追跡。第三の端・Y字分岐なし。小さいチップと通常のハート首飾りを区別する。口元の煙、HMD内の小角炭2個を維持。
- 準備は縁を拭く手と脚を保持する手、中央のファンネル穴、机上の冷たいONMOを比較。炭・煙・完成台・ホースは追加していない。
- ONMO単体と、Mozeのボウル縁清掃／ONMO装着の実写を再取得し、実際に開いて添付した。実写真本体は転載せず出典とSHA256だけを記録する。
- **生成編集は完全な局所画素差分ではない。** 顔・手・器具のROIには平均約5〜9/255のRGB差がある。差分数値を同一人物性の合格や無変更の証明にはしない。拡大比較でオーナーが判断する。
- 既存の台全体の装着写真はHTTP403で再取得できなかった。特定ボウルの型式・脚の実寸・全体の製品寸法一致は未確認のまま。夜原画の短い脚という既存確認点も、背景修正だけで解消済みとしない。
- 既存の前景容器を保った。透明タッパー保管の方針への追加修正は別の確認点として残る。

これは背景修正の比較用原画で、完全なCG品質合格・採用承認ではない。凛／つむぎの機材NG修正版、欠番原画、採用後の本編接続、旧セーブ・公開版の正式表示は別の残作業。

## PC／タッチ端末の仮表示

公開版の既存 `prepareTitleArt`／`showTitle` を使う使い捨てブラウザで確認する。候補PNGだけをブラウザ内リクエストへ差し込み、公開配信・manifest・抽選候補・プレイヤーの保存領域を変更しない。

```sh
BASE_URL=https://haseatsu114514-dot.github.io/shisha-game/remake/ \
TEST_REF=eca6a3d12ec4bb8918ef8eb773f08bf816da16b5 \
ARTIFACT_DIR=asset_sources/heroine-title-candidates-20261009/review-issue375/background-plants/qa \
node asset_sources/heroine-title-candidates-20261009/review-issue375/background-plants/preview.mjs

python3 asset_sources/heroine-title-candidates-20261009/review-issue375/background-plants/make_comparisons.py
```

仮表示結果は [qa/issue375-background-plants.json](qa/issue375-background-plants.json)。PC1280×720／横持ちタッチ844×390の各2枚について、PNGデコード・フォールバックなし・メニュー収容・ブラウザエラー・manifest21枚維持・local/sessionStorage不変を確認する。正式抽選や本編での採用表示の試験とは区別する。

ローカルの公開版renderer仮表示は4/4 PASS。PNGの生成元とのバイト一致、元原画ハッシュ、資料リンク、agent docs、JS構文もPASS。PRでは `.github/workflows/issue375-candidate-qa.yml` が同じ4ケースをPRのコード・素材でローカル配信して確認し、PNGの出典・未採用／未登録状態も検証する。CIの実行結果はPRへ記録する。

## 次の工程

個別選定と未確認の機材／容器QAを完了してから、採用PNG・配信WebP・manifestへの接続を小PRで行う。既存7人21枚を維持し、#373／#376の完了済み素材、#360の他worker予約、#341の公開QA資料を変更しない。
