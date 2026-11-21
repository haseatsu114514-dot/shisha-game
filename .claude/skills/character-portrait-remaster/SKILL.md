---
name: character-portrait-remaster
description: shisha-gameの既存キャラの立ち絵・表情差分を、元の見た目と規格（docs/portrait_standard.md）の画風・頭身を保って1キャラずつ作り直す。営業姿／私服の同一人物性、表情に伴う小さなポーズ変化、確認用プレビュー、承認済み素材の組み込みを扱う。Use for remaking character portraits and expression variants in this repository.
---

# キャラクター立ち絵の再制作

画風・頭身・参照画像は [立ち絵の規格](../../../docs/portrait_standard.md) を使う。人物の外見・衣装は、最新のオーナー指示、`data/characters.json`、採用済みの立ち絵の順で確認する。正本の参照先は [現行資料の参照ガイド](../../../docs/current_documentation_guide.md) に従う。

作業対象・採用状況は最新の対象Issue/PRと現在ゲームで使う画像を確認する。[制作記録](references/review-status.md)・[画像一覧](references/style-references.json)・[以前の制作指示](https://github.com/haseatsu114514-dot/shisha-game/blob/25b27f1/.claude/skills/character-portrait-remaster/SKILL.md) は、過去の素材と判断の来歴をたどるときに使う。

既存デザインの再制作では顔立ち・髪型・配色・衣装・小物を採用済み画像にそろえる。表情に連動する小さなポーズ差は元絵から確認する。修正指示があるときは対象だけを変え、デザインの採用と本編への組み込みの経緯を記録する。

## 1. 元画像を実際に見る

1. `AGENTS.md` の Git Safety を実行し、正本のリポジトリを確認する。
2. `assets/sprites/characters/<id>/chr_<id>_*.png` を列挙する。
   `data/characters.json` は配列。キャラIDで該当要素を検索し、年齢・身長・`spriteScale`・性格を確認する。
   サメちゃんの人物データは `data/characters.json` の `samechan`、立ち絵は `assets/sprites/characters/samechan/`。
3. **通常だけでなく既存の全表情を見る。** 古い `visual_concepts` が実画像と食い違うことがあるので、
   今ある絵を再現する依頼では実画像とオーナーの説明を優先する。
4. 表情の左右の目、口、舌、眉、涙・赤面、手の位置、小物の左右をメモする。
   左右は「画面左／画面右」で明記する。
5. 必要に応じ元画像をHTMLで並べた比較シートを作る。画像は背景を明暗両方で合成して見る。
   ツールの画像表示だけで低アルファの縁が派手に見える場合もあり、PNGの実際の透過を確認する。

### 同一人物と衣装の確認

- 営業姿と私服を持つ人物は、同一人物の頭身・顔立ち・体格をそろえ、衣装ごとの装飾や仕草は、採用済みの同じ衣装の画像を使う。
- 新しい表情は、対象場面の台詞と既存の `face` 指定を確認する。たとえば、ましろの `sad` はあくびの表情。
- 資料と立ち絵が食い違うときは、採用済みの立ち絵と最新のオーナー指示を照合する。過去の記録にある衣装や髪の案を、そのまま再生成の指示へ移さない。

## 2. 生成

- 画像生成・創作上の画像修正は画像生成ツールを使う。Pythonで顔やポーズを描き換えない。
- [立ち絵の規格](../../../docs/portrait_standard.md) の「生成のたびに渡す参照セット」に従い、採用済みの本人画像、頭身の目標、画風の参照を実画像で渡す。プロンプトには各画像の役割を明記する。
- 最終素材は1回に1人・1表情。全身と髪、靴、手を収め、規格の人物高と透明余白を確保する。同じ衣装の各表情で足元と縮尺をそろえる。
- 透過背景を指定し、背景のグラデーション、光彩、色付きの縁、床影、背景に描かれた市松模様を作らない。
- プロンプトと生成原画を保存する。採用前の絵は確認用資料として扱い、ゲームのPNG／WebPを差し替えない。
  添付した画像のパスと、デザイン用／画風用の役割も記録する。
- 再制作用の文面は規格のテンプレートと現在の人物資料で組み立てる。

## 3. 1セットを見せる

依頼された全身の差分に加え、元との顔比較、別衣装では採用済み衣装との頭身比較を必要に応じ用意する。
並び順と仕草の違いを簡潔に伝え、未採用の新デザインは採用／修正の返答を待つ。
指摘された箇所は元画像を再確認し、指定された箇所を直す。別キャラへの移行は最新の依頼に従い、未採用案は勝手に採用しない。確認待ちの間も保存・比較・依頼範囲の独立作業は進めてよい。

## 4. 採用された素材だけを組み込む

同時に [portrait-fix](../portrait-fix/SKILL.md) を使う。

- ファイル名・表情キーを既存どおり保ち、キャンバスを **896×1200 RGBA** に揃える。
- キャラ／衣装セット全体で一つの拡縮率を使う。足元の下端と下20%の重心を通常に合わせる。
  表情ごとの拡縮で頭身や身長が変わらないようにする。体格設定 `spriteScale` は変更しない。
- 別衣装を持つキャラは他のセットを巻き込んで加工しない。共通のmanifestの高さ・足元アンカーが別衣装の表示にも影響するので確認する。
- 採用済みの腕・肩などのポーズ差は意図されたもの。位置ずれを直すために顔だけ合成し、体を全表情で同じに戻さない。
- 固定幅の5等分で髪や手が切れる場合は、透過の隙間または本体の連結成分で分ける。
  隣の髪が接触している箇所は個別に確認する。単に等分して見切れたまま入れない。
- **アルファを一括で閾値処理しない。** α64〜240の髪も原画。背景の低アルファ残りを整理するときは1キャラで確認してから次へ進む。
- RGBAを別キャンバスへ配置するときにアルファを二重に適用しない（`paste(image, xy)`）。
- 立ち絵の配布版は、`remake/tools/build_images.py` で**lossless WebP・exact alpha**を保持する。
  PNGと配布WebPをRGBAで比較して、一致を確かめる。通信サイズとの交換条件はPRに明記する。
  変換のキャッシュはmtimeを使うため、PNG変更後のGit stash／checkoutで順序が変わると古いWebPを再利用し得る。
  一致しない場合は**対象キャラの生成WebPだけ**を削除して再生成し、もう一度RGBA比較とゲーム内確認をする。

## 5. ビルド・表示確認・記録

```bash
python3 tools/make_face_icons.py <id>   # 丸アイコン（LIME・看板・好感度カード等）も新しい立ち絵から作り直す
python3 remake/tools/build_manifest.py
python3 tools/align_sprite_anchor.py -c <id> --dry-run
# 凛想を変更した場合の回帰。他のキャラはそのキャラの実画面で確認
node remake/test/rio_portraits.mjs
```

- **通常（`normal`）と私服（みんとの `ura_normal`）を描き直したら、丸アイコンの作り直しは省略しない**（2026-10-31 オーナー「旧デザインは使わないで。根絶して」SBD83。みんとの描き直しで作り直し忘れ、旧デザインの顔が LIME・地図に残っていた）。作り直したら WebP も `remake/tools/build_images.py` で更新する。忘れると quick の `tools/check_face_icons_fresh.py` が落ちる。
- 心得の盤などに出る顔も、再生成した顔アイコンと同じ測定値か確認する。
- 丸アイコンは、測った顔の位置（`data/portrait_metrics.json`）から `tools/make_face_icons.py` が自動で切り抜き、全キャラの顔の大きさを揃える（2026-11-02〜。手で拡大率を直さない）。通常を差し替えたら [立ち絵の規格](../../../docs/portrait_standard.md) 2節の手順で測り直す。`TUNE` はパッキーなど測れないキャラだけ。
  頭のてっぺん（髪・角・帽子・フード）は切らない（SBD84）。`make_face_icons.py` が自動で余白を残す（少し下へずらし、足りなければ顔を軸に少し引く）。
  別衣装の顔は `EXTRA`（例: みんと私服＝`face_minto_private`）。
  アイコンは全員160px・256色・輪郭は滑らかな透明度（2026-10-04 オーナー指定。元絵の顔の切り抜きが約180〜240pxのため160pxが上限の目安）。拡大表示とスマートフォンの高密度表示で目が読めるか確認する。キャラ別に変える場合は `TUNE` の `size`。
- 表情の意味や仕草が旧画像と変わったら、そのキャラの全台詞の `face` 指定を場面に合わせて見直す
  （2026-10-04 PRT18〜PRT21。旧つむぎ・旧凛想は表情ファイルの中身が名前とずれていた）。立ち絵と矛盾する外見の地の文も確認する。
- 修正対象は共有 `assets/` と現行 `remake/`。画像を差し替えたら `python3 remake/tools/build_manifest.py` で目録を更新する
  （旧 `web/` 版・単一HTML配布は廃止済みで、再ビルド対象はない）。
- ローカルHTTPサーバー経由で**全表情を実際の会話エンジンに出す**。別衣装との切り替え、左右・上下のずれ、頭／髪／手の欠けを目視する。
  PNGだけ確認して終わらない。実際に読まれるWebPとmanifestも確認する。
- 必要な通し確認は `node remake/test/playthrough.mjs`。重いテストは並列実行しない。
  ブラウザの実行パスは環境に合わせる（例 `CHROME_BIN=/usr/bin/chromium`）。
- [owner-request](../owner-request/SKILL.md) に沿い、`docs/owner_requests.md` と制作記録へ採用済み・確認待ち・マージ状況を残す。
- Git Safetyを確認し、`origin/main` からのブランチとPRを使う。mainへの直接pushやforce pushはしない。
  オーナーがマージを指示済みなら、承認済み素材を確認後にマージする。改めて同じ許可を聞かない。
- 未承認の生成案は確認資料として保存できるが、ゲームの実素材へ採用しない。

## 新チャットでの依頼例

「character-portrait-remasterスキルを使って、次は○○を作って。まず1キャラ分を見せて」

対象Issue/PRで現在の担当と残作業を確認し、現行runtimeの採用済み画像と制作記録を実際に見てから進める。過去の制作順を新しい作業指示にせず、別キャラへの依頼を未採用案の採用回答とも扱わない。

過去の制作根拠は保持する。以下は現在の担当・未完を指定するものではない。

- 凛想v12: [5表情](references/rin-v12-five-review.png)、[姿勢比較](references/rin-v12-stance-comparison.png)、[実会話比較](references/rin-v12-game-before-after-591.png)、[生成元](references/rin-v12-generation.json)、[検証](references/rin-v12-integration.json)、[v11からの引き継ぎ履歴](../../../docs/archive/rin_portrait_handoff.md)。
- 凛想v11: [5表情](references/rin-v11-five-review.png)、[生成記録](references/rin-v11-expressions-generation.json)、[配置・検証](references/rin-v11-integration.json)。
- すみさんv1: [5表情](references/sumi-five-review.png)、[生成・配置記録](references/sumi-generation.json)。
- ましろv1: [6表情](references/mashiro-six-review.png)、[基本5枚](references/mashiro-generation.json)、[立ち寝](references/mashiro-sleep-generation.json)。`sad` は元の絵どおりのあくび。すみさん・ましろの採用記録は要望台帳PRT49を参照。
