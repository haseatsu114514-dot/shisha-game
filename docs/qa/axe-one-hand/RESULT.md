# 斧投げの片手構え（2026-11-21）

## 構成と差し替え

一人称の狙い画面は、`bg_axe_lane.webp` のレーンにSVGの的と得点表示を重ねる。変更前の `bg_axe_lane_aim.webp` は、レーンと両手で握った斧を一枚に描いた1280×720の画像だった。[axe.js](../../../remake/js/minigames/axe.js) の `HAND_SILHOUETTE` がそこから手と斧を切り抜き、`.axe-lane-aim` と `.axe-hand-front` で重ねていた。輪郭は表示用で、投擲・得点判定の座標とは独立している。

- [共有PNG](../../../assets/backgrounds/bg_axe_lane_aim.png) と [表示用WebP](../../../remake/img/backgrounds/bg_axe_lane_aim.webp) を1920×1080の片手版に差し替えた。どちらもGit LFSで管理する。
- `HAND_SILHOUETTE` を右手・右袖・斧の輪郭に合わせた。SVGの座標系と前景のレイヤー順を引き継いだ。
- 右上のスコア、左上の「ねらい」ラベル、左下の操作欄、右側のフリック操作面は、mainに入った #4115 の配置で確認した。

## 生成方法

生成前に作業フォルダ内で307,200バイトのコピーを行い、サイズとSHA-256の一致を確認した。Codex内蔵の画像編集ツールに変更前のWebPを渡し、支え手の左手と袖を消去し、床板・赤い線・隠れていた斧の柄を補うよう指示した。右手のハイライト、袖の質感、斧の角度、レーン・的・照明・画角を維持する指示も含めた。

[生成原画](../../../asset_sources/axe-one-hand-20261121/bg_axe_lane_aim.png) は1672×941。指定の1920×1080へLanczosでリサイズし、`python3 remake/tools/build_manifest.py --backgrounds-only bg_axe_lane_aim.png` でWebPを生成した。背景台帳は対象画像の実寸・輝度・Git blobを更新した。

<details>
<summary>生成時の指示全文</summary>

> Precisely retouch the supplied existing 16:9 video game first-person axe-lane artwork, as a localized inpaint. Erase the whole lower supporting LEFT hand (the lower grip in the center-bottom) and its entire connected charcoal sleeve entering from the bottom-left of center. There must be absolutely zero trace of the left hand or its sleeve. In the erased region restore the exact same brown wooden plank flooring, perspective, textures, shadows, and continuous horizontal red foul line naturally, and reconstruct the portion of the existing wooden axe handle that this left hand occluded so it is one smooth straight continuous wooden handle with the same orientation/length and rounded end. Keep the entire original upper RIGHT hand wrapped around that axe handle, its natural skin highlights, the charcoal cuff and single right sleeve entering from the bottom-right, and the original steel axe head as closely matching the reference in screen position, angle, and scale as possible. It should be one hand total and a single lower-right sleeve. Preserve all original framing, exact wide 16:9 aspect, the lane, target shape and position, floor, lights, contrast, materials, and camera perspective. Edit only the lower supporting hand/sleeve region and the bit of now exposed handle. Match the edges of the original image and keep the remaining scene in the same register so the edited area can be placed over the original.

</details>

## 実画面と重なりの再計測

Chromiumで、第1章6日目夜の斧投げBarの初回レッスンから横の照準を撮影した。比較前後とも #4115 の配置を使った。スマートフォンのサイズは横持ちのタッチエミュレーション。

| ビューポート | Before | After |
| --- | --- | --- |
| 1280×720 | [両手](before-1280x720.png) | [右手のみ](after-1280x720.png) |
| 844×390 | [両手](before-844x390.png) | [右手のみ](after-844x390.png) |

単体プレビューと本編の初回レッスンで、集中・構え直す・横／縦の停止ボタン・フリック操作面を照準の各段階で計測した。ボタンの矩形と画面座標に変換したSVG輪郭の交差を、アルファ値128以上のピクセルで数えた。二つの入口で同じ値になり、対象ボタンの中心でのポインター到達も全件確認できた。

| ビューポート | 横の照準の最大交差 | 縦の照準の最大交差 | フリック待ちの最大交差 | フリック操作面までの最短距離 Before → After |
| --- | ---: | ---: | ---: | ---: |
| 1280×720 | 0 px² | 0 px² | 0 px² | 18.50 → 16.81 CSS px |
| 844×390 | 0 px² | 0 px² | 0 px² | 6.19 → 6.19 CSS px |
| 740×320 | 0 px² | 0 px² | 0 px² | 5.53 → 5.53 CSS px |

## テスト

- `node --test remake/test/axe_*.mjs` は105件成功。
- `python3 tools/background_catalog.py check` は134枚の照合に成功。既存の `bg_smoke_lab.png` に寸法警告1件。
- `axe-throw` ブラウザスイートと `axe_bar_discovery.mjs` は検証中。

## Draft PR

PR作成後に番号を記録する。
