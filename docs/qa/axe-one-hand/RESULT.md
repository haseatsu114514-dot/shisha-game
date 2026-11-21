# 斧投げの片手構え（2026-11-21）

## 通常構えと引き構えの切り替え

右手で柄尻を握ったまま、通常時は刃を的へ向ける。フリック待ちで操作面や的を押している間、または Space を保持している間は、右肩側へ引いた現行の絵へ切り替わる。離すか取り消すと通常の構えに戻り、投擲中は飛ぶ斧へ引き継ぐ。

レーン背景と的は共通で、[通常構えのWebP](../../../remake/img/backgrounds/bg_axe_lane_aim_ready.webp) と[引き構えのWebP](../../../remake/img/backgrounds/bg_axe_lane_aim.webp) から、それぞれのSVG輪郭で右手・袖・斧を抜き出す。操作受付前に両画像をデコードし、レーン側と前景側の表示を同時に切り替える。

Codex内蔵の画像編集を開始する前に、作業フォルダ内にコピーした現行WebPが278,134バイト、1920×1080で、PRの現行ファイルとバイト単位で一致することを確認した。[生成原画](../../../asset_sources/axe-one-hand-20261121/bg_axe_lane_aim_ready.png) は1672×941。引き構えの素材と同じ寸法にそろえるため、[共有PNG](../../../assets/backgrounds/bg_axe_lane_aim_ready.png) をLanczosで1920×1080に変換し、既存の画像ビルド手順で表示用WebPを作成した。

<details>
<summary>通常構えの生成指示</summary>

> Use case: precise-object-edit. Create a NEW companion 16:9 game bitmap from the attached approved first-person recreational axe-throwing lane image. Preserve the identical camera, framing, round wood target, lattice dividers, red floor line, floorboards, amber lighting, hand skin, charcoal sleeve fabric, short wooden axe handle and compact black steel axe. Redraw only the one right forearm, hand and held axe in its forward READY pose: the arm reaches forward at chest height from the lower-right edge, the wrist is in front of the body, the axe head is one compact hand-span above and to the LEFT of the knuckles, at mid-upper height, with the bright curved cutting edge visibly on the LEFT side facing the round wood target. The handle slopes up-left toward the target and head, contrasting clearly with the reference's up-right backward pose. Right fist grips the absolute bottom end of the handle, with the pinky against the rounded widened wooden pommel and just a small end cap below the fist. One natural hand only. Preserve the entire round target and an open right-side UI gutter. As composition anchors in full-frame coordinates, place the axe head roughly at x=64–68%, y=31–40%, and the right fist around x=69%, y=51%; keep the outer edge of the compact fist and sleeve near or left of x=73% down to y=67%. Below that level the sleeve broadens gradually toward the bottom edge without touching the right edge. Realistic, warm painted game artwork matching the supplied reference. Render at 2048×1152 or larger exact 16:9 if supported. No text, logos, UI, second hand or people. Keep the rest of the background fixed and fill the previous arm area with the lane behind it.

</details>

### 実画面

Chromiumで第1章6日目夜の斧投げBarの初回レッスンを開き、フリック待ちと操作中を同じ段階で撮影した。1280×720はマウス、844×390は横持ちのタッチエミュレーション。

| ビューポート | 通常構え | 引き構え |
| --- | --- | --- |
| 1280×720 | [入力前](pose-ready-1280x720.png) | [ドラッグ中](pose-windup-1280x720.png) |
| 844×390 | [入力前](pose-ready-844x390.png) | [タッチ操作中](pose-windup-844x390.png) |

### 重なりと回帰テスト

本編の初回レッスンで、画面座標に投影したSVG輪郭と、表示中の操作ボタンの矩形との交差を計測した。全サイズでボタン中央にポインターが届き、入力の取り消しで通常構えに戻り、続けてフリックで投げられた。

| ビューポート | 通常構え・横／縦／フリック待ちの最大交差 | 引き構え・操作中の最大交差 | フリック操作面との最短距離（通常／引き） |
| --- | ---: | ---: | ---: |
| 1280×720 | 0 px² | 0 px² | 14.50／3.54 CSS px |
| 844×390 | 0 px² | 0 px² | 7.42／1.80 CSS px |
| 740×320 | 0 px² | 0 px² | 6.28／1.53 CSS px |

- `axe_tap_pull.mjs` の3サイズ回帰に、保持中の引き構えとボタンの重なり、マウスを離した後とタッチを取り消した後の通常構えへの復帰を追加した。
- `node --test remake/test/axe_*.mjs` は105件成功。背景台帳は135枚の照合に成功し、既存の `bg_smoke_lab.png` の寸法警告が1件あった。

## オーナー指摘後の修正

右手の小指が柄尻の膨らみに掛かる位置で握り、右肩側へ引いた片手構えにした。濃色の袖が右下から入り、斧頭は画面右上寄りで刃が上を向く。ゲーム画面は既存のレーン背景とSVGの的を使い、再調整した `HAND_SILHOUETTE` で手元だけを重ねる。的の板全体と右上の得点表示が見えるよう、手元の表示範囲を調整した。

内蔵画像編集の開始前に、作業フォルダ内の現行WebPのコピーが305,948バイト、1920×1080で、表示用ファイルとバイト単位で一致することを `cmp` で確認した。現行の原画PNGとWebPから構えを編集し、レーン・的・床・照明・画角を引き継いだ。[採用原画](../../../asset_sources/axe-one-hand-20261121/bg_axe_lane_aim_windup.png) は1671×941。[共有PNG](../../../assets/backgrounds/bg_axe_lane_aim.png) にLanczosで1920×1080へ変換し、既存の `build_images.encode` で[表示用WebP](../../../remake/img/backgrounds/bg_axe_lane_aim.webp) を作成した。WebPは278,134バイト。背景台帳の平均輝度とLFSポインタのGit blobを更新した。

<details>
<summary>採用画像の生成指示</summary>

入力1は柄尻を握る構えに直した候補、入力2は前の片手版の表示用WebP。

> Use case: precise-object-edit. Full 16:9 in-game fixed camera at a recreational axe-throwing lane. Edit image 1, using image 2 to retain the same room, centered round target, floor lines, dark lattice, lighting, camera and crop. The single dark-sleeved right arm is drawn back at the right shoulder for a one-handed throw. Preserve the visually distinct windup in image 1: fist grips the absolute end just at the widened pommel, the short wood handle slopes gently toward the upper right and the steel blade's curved cutting edge is uppermost toward the ceiling. Important production framing change: shrink the axe and the fist modestly and use a slender forward profile rather than a sprawling large arm. Seen from behind the fingers, the fist should be compact and more edge-on with less palm visible, the pinky right above the end cap. Position the fist centered around 69% of image width, 44% of height. The rear-facing head and handle are an upper-right silhouette between 68% and 80% of width, with the highest cutting edge about 16–20% of image height, and the lower end of the steel above 34% of image height. Local space to preserve the game touchscreen controls: from y=39% to y=65%, leave the part of the right side beyond x=73% completely empty room, so the hand and upper charcoal sleeve must fit in a narrow visual band from x=67% to x=73% during those rows. From about 66% of the image height down, the dark sleeve angles and flares naturally toward the bottom-right corner close to the viewer, connected to the same right wrist. Leave the target fully unobscured and show the full upturned axe blade with room above and to the right. Realistic small sports hatchet, believable adult wrist anatomy, dark charcoal sleeve, existing warm material appearance. No overlay, text, or graphic.

</details>

### 修正前後の実画面

Chromiumで第1章6日目夜の斧投げBarの初回レッスンを開き、横の照準を撮影した。844×390は横持ちタッチのエミュレーション。

| ビューポート | 修正前（片手版 `9729ad615a`） | 修正後 |
| --- | --- | --- |
| 1280×720 | [Before](windup-before-1280x720.png) | [After](windup-after-1280x720.png) |
| 844×390 | [Before](windup-before-844x390.png) | [After](windup-after-844x390.png) |

単体プレビューと本編の初回レッスンを #4115 と同じ方法で計測した。操作ボタンの矩形と画面座標に変換したSVG輪郭の交差を数え、ボタン中央へのポインター到達と、フリックで先へ進めることを確認した。

| ビューポート | 横の照準 | 縦の照準 | フリック待ち | フリック操作面までの最短距離 |
| --- | ---: | ---: | ---: | ---: |
| 1280×720 | 0 px² | 0 px² | 0 px² | 3.54 CSS px |
| 844×390 | 0 px² | 0 px² | 0 px² | 1.80 CSS px |
| 740×320 | 0 px² | 0 px² | 0 px² | 1.53 CSS px |

### 修正後のテスト

- `node --test remake/test/axe_*.mjs` は105件成功。
- `python3 tools/background_catalog.py check` はCIと同じくGitの登録内容から134枚を照合。既存の `bg_smoke_lab.png` の寸法警告が1件。
- [Draft PR #4124](https://github.com/haseatsu114514-dot/shisha-game/pull/4124) の同じブランチで確認。ブラウザスイートの実行結果はPR本文に記録する。

## 初回の片手化

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
- ローカルChromiumで `axe_tap_pull.mjs` 17件（#4115の3サイズ回帰を含む）、`axe_lesson.mjs` 7件、`axe_bar_discovery.mjs` 12件が成功。途中で止まった実行は、環境を整えて残りのケースを再実行した。
- GitHub Actionsで `tools/ci/suites.json` の `axe-throw` スイートを実行し、`axe_tap_pull`・`axe_throw`・`axe_versus`・`axe_polish`・`axe_lesson`・`axe_menu_decor`・`axe_bgm_788`・`axe_audio_performance` の8本が成功。quickと `CI / result` も成功。[実行ログ（実装コミット `67dc6915b6`）](https://github.com/haseatsu114514-dot/shisha-game/actions/runs/44889025520)

## Draft PR

[Draft PR #4124](https://github.com/haseatsu114514-dot/shisha-game/pull/4124)（`codex/axe-one-hand`）。
