# TEST_REQUEST.md — Issue #788 局所テスト及び素材変換手順書

コーディネーター実行用テスト手順書です。ターミナルコマンドを実行できない環境のため、以下の局所テストおよび素材変換の実行をお願いいたします（全章通し・総当たりは不要です）。

---

## 1. 素材変換コマンド（.bgm パック形式への変換）

単体MP3の再配布を避け、ゲーム専用形式（AES-256-GCM / マジックヘッダー `SUIENBGM1`）に変換します。

```bash
# 1. TRPG曲の変換（Shared Discovery.mp3 -> bgm_trpg.bgm）
python3 remake/tools/pack_bgm.py "[local path omitted] Discovery.mp3" assets/audio/bgm/bgm_trpg.bgm

# 2. 斧投げ曲の変換（Aiming groove.mp3 -> bgm_axe.bgm）
python3 remake/tools/pack_bgm.py "[local path omitted] groove.mp3" assets/audio/bgm/bgm_axe.bgm

# 3. アセット目録の更新（manifest.json の bgm 配列更新・画像は維持）
python3 remake/tools/build_manifest.py --audio-only
```

> **注記**: 素材ファイル（計約6.6MB）の正式なリポジトリへのコミットおよびpushはコーディネーターの判断待ちです。まずはローカルworktree上で変換・検証可能です。

---

## 2. 局所テストの実行コマンド

### 2.1 新規テスト（Issue #788 専用テスト）
音量計算・BGM_GAIN減衰境界・シーン遷移/復帰制御・AES-GCM復元互換性を一括検証します。

```bash
node --experimental-vm-modules remake/test/bgm_minigame_788.mjs
```
- **期待結果**:
  - `[Loudness Calculation] PASS: TRPG=-15.70 LUFS, Axe=-15.75 LUFS (diff: 0.05 dB)`
  - `[Audio Module BGM_GAIN] PASS: Gain curves and volume boundaries verified`
  - `[Scene Transition & Recovery] PASS: TRPG, Solo Axe, and Hiyori Axe transitions verified`
  - `[Package Format AES-GCM] PASS: Encryption, header magic, and decryption roundtrip verified`
  - `ALL TESTS PASSED: Issue #788 BGM connection`

### 2.2 既存関連テスト（回帰確認）
既存のBGMゲイン保持、および暗号化パック復元処理に影響がないことを確認します。

```bash
# 既存のゲイン保持・設定変更・フェード検証
node --experimental-vm-modules remake/test/bgm_gain.mjs

# 既存のパック音源取得・キャッシュ・復元検証
node --experimental-vm-modules remake/test/bgm_packaged.mjs
```
- **期待結果**: 両テストがエラーなく `PASS` で終了すること。

---

## 3. テスト観点サマリ
- **音量揃え**: Aiming groove (-15.3 LUFS) を 0.95倍減衰させ、Shared Discovery (-15.7 LUFS) と実効ラウドネス -15.75 LUFS vs -15.70 LUFS（差 0.05 dB）に揃っていること。
- **クリップ・上限防止**: 最大音量設定（`config.bgmVolume = 1.0`）でも `volume <= 1.0` を維持し、ブラウザの例外（`RangeError`）を確実に回避していること。
- **復帰の確実性**:
  - TRPG終了時 → 街マップ曲 `kansetsu_shomei_to_black_coffee`
  - ソロ斧投げ終了時 → 街マップ曲 `kansetsu_shomei_to_black_coffee`
  - ひより斧投げ終了時 → tonari店内曲 `tonari`
  - 各シーンの中断・例外時も `finally` で元のBGMに復帰すること。
- **二重再生防止**: `playBgm` の組み込みフェード処理（前曲の停止と新曲フェードイン）を活用し、音の重なりや跳ねを防いでいること。
