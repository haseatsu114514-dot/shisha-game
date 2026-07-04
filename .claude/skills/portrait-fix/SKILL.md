---
name: portrait-fix
description: 立ち絵（キャラのスプライト）の表示バグ対応。表情を切り替えると立ち絵が左右/上下にずれる・ジャンプする、足元が浮く、頭が見切れる、髪や輪郭が欠ける、身長バランスがおかしい、立ち絵を追加/差し替えする、などのとき必ず使う。症状→原因→使うツールの診断フロー。Use when character portraits shift/jump between facial expressions, are misaligned or clipped, or when adding/replacing portrait images.
---

# 立ち絵のズレ・表示バグ対応

## まず仕組みを理解する（位置はどこで決まるか）

```
assets/sprites/characters/<id>/<face>.png   ← 原画（表情ごとに1枚）
        ↓ python3 web/build_data.py（ビルド時に毎回計測）
portrait_trim(): 透過余白＋足元アンカー ax を numpy/scipy で計測
        → 同一キャラ内で bottom と ax を共通化（表情差分の描かれ方の違いを吸収）
        ↓
web/js/data.js の portrait_trims / portrait_scales（生成物）
        ↓
web/js/engine.js applyPortraitTrim() が描画位置・スケールを決定
```

重要な帰結:
- **位置はビルド時計測**。画像を1pxでも触ったら `python3 web/build_data.py` を再実行
  しないと直らない/ズレたままになる。
- **scipy が無い環境でビルドすると ax が計測されず横位置がズレる**（黙って劣化する）。
  ビルド前に `pip install Pillow numpy scipy` を確認。CIにも入っている前提。
- ax・bottom はキャラ単位で共通化済みなので、「表情でジャンプする」場合は
  共通化が効かないほど**原画側の描かれ方がバラバラ**なのが原因。

## 症状別の診断フロー

### A. 表情を切り替えると左右にずれる・ジャンプする
1. まず `python3 web/build_data.py` の出力に scipy 警告（ax計測不可）が出ていないか確認。
   出ていたら scipy を入れて再ビルドで解決。
2. 再ビルドしても残る場合は原画の体の描かれ方が表情間で違う（腕の出し方・立ち位置）。
   → `python3 tools/sprite_face_swap.py --character <id> --dry-run` で差分解析し、
   問題なければ `--backup` 付きで実行（normalの体に顔だけ合成＝体を完全統一）。

### B. 上下にずれる・足が浮く・頭が見切れる
- 表情間でキャンバスや下余白が不揃い。
  → `python3 tools/normalize_sprites.py assets/sprites/characters/<id>/` で
  キャンバス統一（896x1200）＋ union bbox で全表情の位置・サイズを揃える。
- ⚠️ **必ずキャラフォルダ単位で処理**する。1枚だけ正規化すると他の表情との
  相対位置が壊れて逆にズレる。まず `--dry-run` か `--suffix _normalized` で確認。

### C. 髪・輪郭・薄い部分が欠ける
- 過去事故: `clean_sprite_alpha.py` の一括適用が髪の房（α64〜240）をゴミと誤削除
  → 全72ファイルを git 履歴から復元して再処理した。
- 教訓: アルファ清掃・背景除去系は**一括適用しない**。1キャラで結果を目視してから広げる。
  欠けが起きたら、壊れる前のコミットから `git checkout <sha> -- assets/sprites/...` で復元。

### D. キャラ同士の身長バランスがおかしい
- 正本は `data/characters.json` の `spriteScale`（出典: brand/character_profiles.md の身長、
  基準172cm・±6%クランプ）。画像側で拡縮して調整しない。
- 回帰テスト `node web/test/portraits.mjs` が大小関係（sumi>naru>rin>minto>tsumugi）を検証する。

### E. 立ち絵の追加・差し替え
1. ファイル名は `assets/sprites/characters/<id>/<face>.png`。face は9種のみ
   （normal/smile/surprise/sad/serious/smug/wink/evil/excited）。
2. 追加したら同キャラの既存表情と合わせて B の正規化を通す（新画像だけ座標系が違うのを防ぐ）。
3. `python3 web/build_data.py && python3 web/build_standalone.py` で trim を再計測。

## 直した後の確認（必須）

```bash
python3 web/build_data.py && python3 web/build_standalone.py
node web/test/portraits.mjs        # 身長比・データ経路の回帰（速い）
```

- 仕上げに**該当キャラの表情が実際に切り替わる場面を目視**する（ズレは自動テストで
  全ては拾えない）。`python3 -m http.server 8123` → ブラウザ/スクリーンショットで確認。
- 「オーナーの手元でだけズレる」報告は、コードより先に **Pages 配信版の鮮度**
  （CIのscipy有無・タイトル右下の `D.build` 刻印）を疑う（owner-request スキル Step 4）。
