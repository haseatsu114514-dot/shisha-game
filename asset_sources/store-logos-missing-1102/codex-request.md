# Codex への依頼: 足りない店のロゴ3店の生成と組み込み（SLG01〜SLG03）

このファイルは Codex がそのまま実行する依頼書。まず `AGENTS.md`（Git・通信量・LFS・PR の決まり）と同じフォルダの [README.md](README.md)（調べた結果・作るもの・画風の基準・組み込み手順）を読む。

## オーナー決定（2026-11-02）

- 画像は **Codex で生成する**（この依頼）。
- 対象は、地図でロゴが無く汎用の盾になっているシーシャの店3つ: **SHISHARK**（サメちゃんの店）、第4章ドバイの**中心地のカフェ**、**路地裏のカフェ**（第5章のドバイにも出る）。
- シーシャ屋以外の行き先（路地裏の神社、砂漠ツアーのデスク・砂丘・ラクダレース場）は地図アイコンの担当（`asset_sources/map-icons-1102/`）で、ここでは作らない。

## 作るもの

README の「作るもの」の表の3店。プロンプトは各 `*-prompt.txt` を**そのまま**使う（言い換えない）。

- 1回の生成に「本文（`Candidate` の行より前の全部）＋`Candidate A`・`B`・`C` のうち1行」を渡す。**1店につき A・B・C の3案**を作る（計9枚）。
- 1536x1024、透過背景。参照画像は README の「画風の基準」の表のとおり添付する（1枚目は意匠・配色の基準、2・3枚目は仕上げの基準）。
- 文字: SHISHARK は英字の `SHISHARK` だけ。ドバイの2店は**文字なし**（店名が正本に無いため。アラビア文字風の飾りも不可）。

## 参照画像の取り方

画像は LFS なので、要るものだけ取る（大量取得はしない）:

```bash
git lfs pull --include="remake/img/backgrounds/bg_shishark.webp,remake/img/backgrounds/bg_dubai_cafe_day.webp,remake/img/backgrounds/bg_dubai_alley_cafe_night.webp,assets/ui/store_logos/ch3-smoke-and-glory.webp,assets/ui/store_logos/melty-puff.webp,assets/ui/store_logos/kanzaki.webp"
```

- SHISHARK の看板: `bg_shishark.webp` を x=700, y=30, 幅610, 高さ320 で切り出す（建物・電灯・右下の黒板を入れない）。
- 路地裏のカフェ: `bg_dubai_alley_cafe_night.webp` を x=560, y=0, 幅720, 高さ320 で切り出す（**シーシャ台の写る下側を入れない**）。
- 中心地のカフェ: `bg_dubai_cafe_day.webp` はそのまま。
- 切り出した参照はチャットに渡すだけで、リポジトリに入れない。

## 検品（1枚ずつ。合わなければ作り直す）

- 透過になっていて、縁に背景色・白い光彩が残っていない。
- **シーシャ機材（台・ハガル・ホース・炭）・人物・手**が無い。SHISHARK のサメは1匹だけで、王冠・パペット・フードが無い。
- 文字: SHISHARK は `S-H-I-S-H-A-R-K` の8文字が正しく1行で読め、サメや波に隠れていない。ほかの単語・カタカナ・数字が無い。ドバイの2店は文字・偽の文字・アラビア文字風の飾りが一つも無い。
- 実在の商標・ロゴ・ランドマーク（ブルジュ・ハリファ、帆の形のホテル）・国や宗教の印（三日月・旗・鷹・王冠）に似ていない。路地裏のカフェのダッラ（コーヒーポット）が水たばこに見えない。
- 生成り色（#fffaf0）の 82×46 と、暗い面（#1f1a29）の 180×104 に縮めて、形（SHISHARK は文字）が読める。
- 既存の店ロゴ（mukai・神崎煙草店・Smoke & Glory・MELTY PUFF）と並べて浮かない。中心地のカフェと路地裏のカフェが小さくても見分けられる。
- SHISHARK は店先の看板（背景 `bg_shishark`）と同じ店に見える。

## 比較画像と PR

1. 9枚の原画を無加工で `asset_sources/store-logos-missing-1102/<名前>-<a|b|c>.png` に保存し、`generation.json` に来歴を書く（README の組み込み手順1）。
2. 比較画像 `asset_sources/store-logos-missing-1102/qa/candidates.jpg` を作る（README の組み込み手順2: 1店1行で A・B・C、縮小見本つき、既存ロゴを横に）。
3. 最新 `origin/main` から branch を作り、Ready for review で PR を出す。**比較画像を PR に貼り、オーナーの採用確認が済むまでマージしない**（不採用の案は作り直す）。
4. 採用されたら README の組み込み手順3〜6（WebP にして `assets/ui/store_logos/` へ、`STORE_LOGOS`・`LOGO_ALIASES` に登録、テスト、実画面の確認）を同じ PR で行う。`ch5_dubai_shop` の別名（今の登録漏れ。Dr.fookah の採用ロゴを使う）も同じ PR で足す。
5. 台帳 `docs/owner_requests.md` の SLG01〜SLG04 を、採用・組み込みが済んだら ✅ にする。
