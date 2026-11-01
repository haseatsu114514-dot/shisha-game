---
name: portrait-fix
description: 立ち絵（キャラのスプライト）の表示バグ対応。表情を切り替えると立ち絵が左右/上下にずれる・ジャンプする、足元が浮く、頭が見切れる、髪や輪郭が欠ける、身長バランスがおかしい、立ち絵を追加/差し替えする、などのとき必ず使う。症状→原因→使うツールの診断フロー。Use when character portraits shift/jump between facial expressions, are misaligned or clipped, or when adding/replacing portrait images.
---

# 立ち絵のズレ・表示バグ対応

## まず仕組みを理解する（位置はどこで決まるか）

```
assets/sprites/characters/<id>/chr_<id>_<face>.png   ← 原画（表情ごとに1枚）
        ↓ python3 remake/tools/build_manifest.py（ビルド時に毎回計測）
measure(): 透過余白＋足元アンカー ax を numpy/scipy で計測
        → 同一キャラ内で bottom と ax を共通化（表情差分の描かれ方の違いを吸収）
        ↓
remake/data/manifest.json の portrait / characters（生成物）
        ↓
remake/js/vn/engine.js の frame() が描画位置・スケールを決定
```

重要な帰結:
- **位置はビルド時計測**。画像を1pxでも触ったら `python3 remake/tools/build_manifest.py` を再実行
  しないと直らない/ズレたままになる。
- **scipy が無い環境でビルドすると ax が計測されず横位置がズレる**（黙って劣化する）。
  ビルド前に `pip install Pillow numpy scipy` を確認。目録生成はローカルで行い、Pagesは生成済みの目録を配信する。
- ax・bottom はキャラ単位で共通化済みなので、「表情でジャンプする」場合は
  共通化が効かないほど**原画側の描かれ方がバラバラ**なのが原因。
- `data/characters.json` の `spriteAnchor: "head"` を持つ凛は、通常の本体上端20%の横重心を全表情共通の表示アンカーにする。画像の足元整列は従来どおり足元で行う。両ビルドが同じ指定を読み、未指定の他キャラは足元基準のまま。

## 症状別の診断フロー

### A. 表情を切り替えると左右にずれる・ジャンプする
1. まず `python3 remake/tools/build_manifest.py` の出力に scipy 警告（ax計測不可）が出ていないか確認。
   出ていたら scipy を入れて再ビルドで解決。
2. 次に **原画が「絵ごと平行移動」して描かれていないか**を疑う（2026-07-04 に全キャラで
   最大115pxのドリフトを確認・これが再発報告の正体だった）。ax はキャラ単位で共通化＝
   キャンバス固定なので、中身がずれているとそのままジャンプになる。
   → `python3 tools/align_sprite_anchor.py --dry-run` で移動量を確認し、そのまま実行
   （足元重心と下端余白を normal に整列。ura_* 私服セットは別グループとして整列）。
   実行後は `python3 remake/tools/build_manifest.py` で再計測。
3. それでも残る場合は原画の体の描かれ方が表情間で違う（腕の出し方・立ち位置）。
   → `python3 tools/sprite_face_swap.py --character <id> --dry-run` で差分解析し、
   問題なければ `--backup` 付きで実行（normalの体に顔だけ合成＝体を完全統一）。
   ⚠️ 平行移動を先に整列してから使う（移動したままだと別ポーズと誤判定される）。

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
- キャラ同士の大小関係は実画面で比較する。`node remake/test/rin_portraits.mjs` は凛の5表情の頭部アンカーと見切れを検証する。

### E. 立ち絵の追加・差し替え
1. ファイル名は `assets/sprites/characters/<id>/chr_<id>_<face>.png`。face は基本5種
   （normal/smile/surprise/sad/serious）＋キャラごとの追加分（smug/wink/evil/excited/thinking/bow 等）。
   台詞側の `face` 指定は実在するファイルに合わせる。
2. 追加したら同キャラの既存表情と合わせて B の正規化を通す（新画像だけ座標系が違うのを防ぐ）。
3. `python3 remake/tools/build_manifest.py` で trim を再計測。

## 直した後の確認（必須）

### 足元を整列しても、上半身が画面中央に来ない場合

凛v11では頭部が足元重心より約100px左にあり、足元を中央へ置くと顔が左へ寄った。PNG全体を左右へ動かすだけでは、ビルドが足元を再計測するので解消しない。オーナー指示に沿って不自然な腰・脚の姿勢を画像生成で直し、凛だけ `spriteAnchor: "head"` を採用した。通常の頭部基準を全表情で共通化し、実会話のPC／スマホで見た目の中央と切り替え時の配置枠を確認する。[凛の最新引き継ぎ](../../../docs/archive/rin_portrait_handoff.md)を参照。

```bash
python3 remake/tools/build_manifest.py
node remake/test/rin_portraits.mjs        # 凛の5表情・中央配置をPC／スマホで確認
```

- 仕上げに**該当キャラの表情が実際に切り替わる場面を目視**する（ズレは自動テストで
  全ては拾えない）。`python3 remake/tools/serve_preview.py --port 8123` → ブラウザ/スクリーンショットで確認。
- 「オーナーの手元でだけズレる」報告は、コードより先に **Pages 配信版の鮮度**
  （`deploy-pages.yml` の最終実行とmainのHEADの照合）を疑う（owner-request スキル Step 4）。
