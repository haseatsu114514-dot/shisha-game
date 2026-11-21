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

## フェーズ3 — サイズ感と一人称目線（2026-11-21）

オーナー指摘（19:47〜19:49）に合わせ、通常構えと引き構えの2枚をCodex内蔵画像編集で作り直した。同じ右腕、濃色の袖、木の柄、鋼の斧頭、琥珀色の照明でそろえた。斧頭は背と上縁が見える向きにし、刃は的の方向へ向けた。通常構えは低く前に出し、引き構えは斧頭を右上に上げた。

編集前にフェーズ2の両原画と生成記録を読み、作業フォルダ内で307,200バイトのランダムデータをコピーした。コピー元とコピー先は `cmp` とSHA-256で一致した。

- [通常原画](../../../asset_sources/axe-one-hand-20261121/bg_axe_lane_aim_ready.png) は1671×941。[共有PNG](../../../assets/backgrounds/bg_axe_lane_aim_ready.png) と[表示用WebP](../../../remake/img/backgrounds/bg_axe_lane_aim_ready.webp) は1920×1080。WebPは283,398バイト。
- [引き構え原画](../../../asset_sources/axe-one-hand-20261121/bg_axe_lane_aim_windup.png) は1670×941。[共有PNG](../../../assets/backgrounds/bg_axe_lane_aim.png) と[表示用WebP](../../../remake/img/backgrounds/bg_axe_lane_aim.webp) は1920×1080。WebPは297,996バイト。
- 共有PNGはLanczosで変換し、既存の `build_images.encode` でWebPを生成した。新しい手元画像に合わせて `HAND_SILHOUETTE` と各画像の表示座標を更新し、背景台帳の平均輝度とLFSポインタのGit blobを合わせた。

<details>
<summary>内蔵画像編集への指示</summary>

通常構えはフェーズ2の通常・引き構え原画を参照した。

> Use case: precise-object-edit. Asset: pose A, a static first-person background bitmap for an original recreational target-lane video game. Image 1 is the exact room/camera/pose-A edit target. Image 2 shows the alternate pose and the same adult's skin, dark charcoal sleeve and warm lighting. Preserve the room, perspective, 16:9 composition, whole round target, red line, wood boards, mesh, and amber spotlights exactly. Redraw only the one right forearm, hand and axe. It is seen directly with the player's own eyes, looking along the room. The axe is held low and out in front on the right; the long wooden haft recedes from the foreground grip toward the head and target, with distinct perspective foreshortening. The head sits to the right of the board around x=62–66%, y=33–46%, large in physical scale and visually substantial dark forged steel. Critical: rotate the axe around the wooden shaft so the broad flat cheeks are edge-on to the eye. The camera sees the blunt flat rectangular poll at the near end and a narrow upper ridge of steel receding into depth toward the wooden target. The thin cutting bit is at the distant end aimed away at the board, mostly occluded by the near end in projection. Do not show the broad crescent profile, flat side or a bright curved silver cutting edge facing camera. The head should look like the rear of an axe, with the haft seated through its eye and no extra protrusions. Grip the very bottom of the solid hardwood handle, fingers naturally wrapping one end, a small rounded heel just below the little finger. Give the adult forearm real girth and foreshorten its length, charcoal sleeve entering from bottom-right. Warm light on knuckles, cuff and rear of steel matching the reference. Keep the fist at approximately x=68%, y=56%, its entire silhouette at x<73% down to y=67%, then let the forearm broaden toward the bottom-right; leave the board fully visible. Maintain the visual style of the input. No added lettering, graphics, GUI, people, logos or a second hand.

引き構えの初回版はフェーズ2の引き構え原画と今回の通常構えを参照した。計測で斧頭の一部がフリック操作面にかかった。

> Use case: precise-object-edit. Asset: pose B, the alternate static hand bitmap for a recreational target-lane video game. Image 1 is the precise room and raised-pose edit target; image 2 is approved pose A supplying the exact enlarged long-handled axe, adult hand, skin, charcoal sleeve and amber light. Keep the same exact fixed eye-level camera, complete round board and single amber-lit lane with red floor line. Redraw only the one right arm and held axe, now drawn up near the player's own right shoulder. View from the player's own eyes. The substantial dark forged steel head is up at the right, around x=72–78%, y=13–30%. Its rectangular blunt rear poll and narrow upper ridge are the surfaces the eye sees. The ridge recedes diagonally away and slightly up-left toward the lane to a thin cutting edge at the far end; the edge aims forward into the range. Treat the broad cheeks as nearly edge-on, so the apparent shape of the head is narrow in the width of the screen but has strong depth, with no side-profile crescent or silver curved stripe aimed at the camera. Match the specific rear-facing poll, worn warm highlights, realistic long hardwood haft and dark steel of image 2. Angle that shaft up-right from the grasp to the head as the hand comes in closer to the right shoulder. Preserve a natural right-hand grip at the exact base with the rounded heel just beyond the little finger. The adult fist around x=68%, y=40% and closer, visibly thicker adult forearm feel foreshortened from this eye position. Keep the right outline of the fist and forearm at x<72% between y=37% and y=65% for game controls; below y=66% the sleeve can flare and connect to the viewer off the bottom-right. Stay clear of the target and leave an unobstructed right margin beside the hand. Match the render style of the references. Exact wide 16:9, no UI, text, extra people, second hand, or changes to the room.

引き構えの採用版では初回版と今回の通常構えを参照し、斧頭と柄を手首に近い縦の位置に収めた。

> Use case: precise-object-edit. Revise only the foreground hand, sleeve and axe of image 1, a static still for a recreational target-lane game. Use image 2 to match the exact same adult's hand, long hardwood handle, edge-on forged steel axe, charcoal sleeve and amber lighting. Keep the image 1 camera and detailed room fixed, same 16:9 wide framing and unblocked round board. This is the raised pose near the viewer's right shoulder. Bring the axe head screen-left so it is vertically aligned over the right wrist, with the head between x=66% and 73%, tip at y=12–16%, and the lower rim of the steel above y=32%. Show the blunt back and upper ridge from the player's eyes, with the cutting edge far away and foreshortened into depth. Conceal the broad flat cheeks as before. Change the haft angle in screen space so it rises steeply from the hand with only slight rightward lean, while angled away from the camera in depth. A long shaft with the same wood and width as image 2. Keep the dark charcoal sleeve and a natural sturdy adult hand. Close all fingers around the end of the haft, with the little finger directly against the slight flare and a short heel below it, as in image 2. The grip should be centered near x=68%, y=47%, spanning x=63.5–73% at most. Composition constraint for UI: keep all foreground subject pixels to the left of x=73.5% above y=64%; keep the subject entirely to the right of x=63% at all heights. The sleeve continues into and off the lower-right edge, with its rightward flare mostly below y=69%. Keep the wrist and forearm naturally broad and foreshortened. Preserve the current warm painted game-art appearance. No UI or lettering.

</details>

### 画面と操作の計測

Chromiumで第1章6日目夜の斧投げBarの初回レッスンを再生した。1280×720はマウス、844×390と740×320は横持ちタッチのエミュレーションを使った。既存手順に従い、画面座標へ投影したSVG輪郭と操作ボタンの交差をアルファ値128以上の画素で数えた。的の板と得点欄の矩形でも交差0を確認した。縦照準の横線の右端から引き構えの輪郭までは、1280×720で1.25、844×390で1.03、740×320で0.17 CSS pxの余白があった。

| ビューポート | 横の照準 | 縦の照準 | フリック待ち | フリック保持中 | 操作面までの最短距離（通常／引き） |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1280×720 | 0 px² | 0 px² | 0 px² | 0 px² | 7.91／3.50 CSS px |
| 844×390 | 0 px² | 0 px² | 0 px² | 0 px² | 4.01／1.75 CSS px |
| 740×320 | 0 px² | 0 px² | 0 px² | 0 px² | 3.38／1.50 CSS px |

| ビューポート | 通常構え | 引き構え |
| --- | --- | --- |
| 1280×720 | [入力前](pose-ready-1280x720.png) | [ドラッグ中](pose-windup-1280x720.png) |
| 844×390 | [入力前](pose-ready-844x390.png) | [タッチ操作中](pose-windup-844x390.png) |

### テストと保存

- `node --test remake/test/axe_*.mjs` は105件成功。
- `axe_tap_pull.mjs` の3サイズの `aim-controls-clear-of-hand` は全件成功。保持・解除・タッチ取り消し後のポーズと、ボタン中央への入力到達を確認した。本編の計測から続けてフリックで投げられた。
- 途中の単体プレビュー計測ではChromium停止と待ち時間切れが発生した。本編の計測と対象ブラウザ回帰は最終配置で成功した。
- 背景台帳はGitの登録内容から135枚の照合に成功。既存の `bg_smoke_lab.png` の寸法警告が1件あった。
- 画像更新コミットは [`fae94771c4`](https://github.com/haseatsu114514-dot/shisha-game/commit/fae94771c47ab58239e7e6ebc6ef657ffbe3b2e7)。計測と最終配置を含む `codex/axe-one-hand` のpush後のheadは [Draft PR #4124のコミット一覧](https://github.com/haseatsu114514-dot/shisha-game/pull/4124/commits) に記録する。

## フェーズ4b — 一人称の構図の再配置（2026-11-21）

通常構え（A）は、右下から的へ伸びる腕が手首に向かって細く見えるようにし、手を中央右寄りの中段に置いた。斧は手の先で立て、背と上縁が見える斧頭を的の右側の上半分に大きく見せた。引き構え（B）は、右側の前腕をほぼ垂直にして手を右上の内側へ上げ、峰と柄の芯が見える斧頭を上端にかけた。

編集前に作業フォルダ内で307,200バイトのランダムファイルをコピーし、内容の一致とSHA-256を確認した。Codex内蔵画像編集の入力はフェーズ3のゲーム原画とその編集途中の画像。原画をLanczosで1920×1080の共有PNGに変換し、既存の `build_images.encode` で表示用WebPを出力した。新しい絵に合わせて `HAND_SILHOUETTE` と表示座標を更新し、背景台帳には平均輝度とLFSポインタのGit blobを記録した。

- Aは [原画1670×941](../../../asset_sources/axe-one-hand-20261121/bg_axe_lane_aim_ready.png)、[共有PNG](../../../assets/backgrounds/bg_axe_lane_aim_ready.png)、[表示用WebP](../../../remake/img/backgrounds/bg_axe_lane_aim_ready.webp)。
- Bは [原画1672×941](../../../asset_sources/axe-one-hand-20261121/bg_axe_lane_aim_windup.png)、[共有PNG](../../../assets/backgrounds/bg_axe_lane_aim.png)、[表示用WebP](../../../remake/img/backgrounds/bg_axe_lane_aim.webp)。

<details>
<summary>採用画像の生成指示</summary>

Aはフェーズ3の通常構えを編集した。

> Use case: precise-object-edit. Edit the supplied existing 16:9 game illustration, pose A of a first-person recreational target lane. Keep the fixed camera, entire round wooden target, wood lane, fencing, red floor line, existing warm amber lighting and detailed painted game-art finish. Recompose only the existing dark-sleeved right forearm, hand, wooden handle and forged steel axe. The player reaches straight forward toward the lane, from the bottom right into the distance. Draw a long diagonal foreshortened sleeve with a wide near end at the lower right frame edge, smoothly tapering into a narrower distant wrist; the raised hand is mid-height, center-right around x=72%, y=48%. Its wooden handle stands steeply upright just beyond the fist, a slight inward lean. Enlarge the head on screen (about twice the visible width of the old head), wholly in the upper half between x=64–74%, y=15–35%, just to the right of the target. Preserve the exact distinctive rear three-quarter view of the original axe: the blunt rectangular forged poll and narrow top ridge facing the eye, the thin blade pointing away and receding along the lane, with restrained highlights and the same wood. Keep the subject right of x=63%; leave x>=83% empty of the subject between y=10% and 67% for game controls. Continue the arm off the lower edge, with no interior cut at the bottom. Preserve the bright hand and charcoal cuff. One arm, one hand, one axe. No text, UI, borders, extra people or props. Output the full widescreen illustration.

Bはフェーズ3の引き構えの前腕を起こし、フリック操作面に近い高さで袖の幅を調整した。

> Use case: precise-object-edit. Edit the existing 16:9 game illustration of the static first-person windup pose. Preserve the fixed lane camera, entire round wooden target, red floor line, warm amber light, fencing, and painted game-art finish. Change only the screen placement and perspective of the single right forearm, fist and original long-handled axe. In the final game viewport the forearm has to fit a thin vertical slot. Compose it around x=71%: the nearly vertical dark charcoal sleeve is only 8–9% of image width at all heights y=45–70%, with its left and right edges clearly visible and modest flare below 75%. Wrist bows slightly inward, sleeve runs vertically to and beyond the bottom border. Preserve a natural adult fist with the same charcoal cuff and warm skin, centered x=70%, y=28%, its overall size moderate, around 9% of image width. Put the much larger forged steel axe head above the fist at x=70%, y=0–15%, with its taper just touching the upper frame edge. Preserve the same blunt rectangular poll and narrow raised upper spine projecting away into the lane. The axe is rear-facing, edge-on with very little of either side showing, and the original wooden handle is aligned through the center of the head. Keep the original proportions of the long wooden handle, the same light on skin, same deep charcoal sleeve fabric, and a distinct silhouette. No added HUD, extra people, equipment or props. This is a single complete 16:9 game-art frame.

Bの斧頭を大きくし、握りの下に見える柄尻を短くした。

> Use case: precise-object-edit. Edit this exact existing 16:9 first-person video-game target lane illustration. Keep the full scene and the narrow straight upright charcoal right forearm exactly where they are, the hand at exactly the same height near the upper right, and the same amber lighting. Make just two local corrections to the axe: (1) Enlarge the forged steel head about 45% in apparent size, emphasizing the wide rectangular blunt back and top ridge in foreshortening. Keep the head above the fist at the top border; a little of the tapered far corner can extend past the top edge. Preserve the same rear-facing angle, forged steel, wooden shaft and eye, with no broadside blade face visible. (2) Shorten the wooden heel sticking out below the gripping little finger so just a small rounded end of wood shows there, like the original grip at the heel of the handle. Preserve the original single hand, vertical sleeve width and position, wooden lane, complete target and painted style. Return the full landscape frame, without text or UI.

</details>

### 計測と実画面

Chromiumで第1章6日目夜の本編の初回レッスンと単体プレビューを計測した。1280×720はマウス、844×390と740×320は横持ちタッチのエミュレーション。SVG輪郭を画面座標に投影し、アルファ値128以上の画素で操作ボタン、的の板、得点欄との交差を数えた。横と縦の照準が取り得る範囲の右端から手元までにも余白があり、既存の最前面レイヤーで右手が明るく見えることを確認した。

| ビューポート | 横照準 | 縦照準 | フリック待ち | フリック保持中 | 照準右端からの余白 | フリック面までの最短距離（A／B） |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1280×720 | 0 px² | 0 px² | 0 px² | 0 px² | 7.25 CSS px | 4.95／7.50 CSS px |
| 844×390 | 0 px² | 0 px² | 0 px² | 0 px² | 4.03 CSS px | 2.98／4.75 CSS px |
| 740×320 | 0 px² | 0 px² | 0 px² | 0 px² | 3.17 CSS px | 2.52／3.50 CSS px |

| ビューポート | 通常構え | 引き構え |
| --- | --- | --- |
| 1280×720 | [フリック入力前](pose-ready-1280x720.png) | [ドラッグ中](pose-windup-1280x720.png) |
| 844×390 | [フリック入力前](pose-ready-844x390.png) | [タッチ操作中](pose-windup-844x390.png) |

### テストと保存

- `node --test remake/test/axe_*.mjs` は105件成功。 `axe_tap_pull.mjs` の `aim-controls-clear-of-hand` は3サイズすべて成功。両ポーズの輪郭、フリックの保持・解除・取り消し、ボタンへの入力到達を確認した。
- Chromiumの一括実行では描画プロセスの停止と読み込みのタイムアウトが発生した。サイズごとに起動し直して、本編・プレビュー各12画面の計測と対象回帰に成功した。
- 背景台帳は135枚の照合に成功した。既存の `bg_smoke_lab.png` の寸法警告が1件あった。
- `codex/axe-one-hand` へ画像とQA画像4枚をpushし、公開時のhead `07111b5c827c6bb4d1663ecf4fc56029ad48ea9e` が `git ls-remote` とDraft PR #4124で一致することを確認した。この検証記録を含むブランチの最新headはPRのコミット一覧で確認できる。[Draft PR #4124のコミット一覧](https://github.com/haseatsu114514-dot/shisha-game/pull/4124/commits)
