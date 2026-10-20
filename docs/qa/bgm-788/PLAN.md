# PLAN.md — Issue #788 TRPG・斧投げ専用BGM接続 実施設計書

本ドキュメントは、Issue #788「TRPG・斧投げの採用済み専用BGMを接続（OP曲は追加しない）」における音量計算根拠、復帰BGM決定根拠、ファイル・関数ごとの最小パッチ案、およびテスト観点をまとめた設計書です。
指定された編集禁止ファイル（`audio.js`, `axe-bar.js`, `hiyori-axe.js`, `trpg.js`）は直接編集せず、本設計書のパッチ案として提示します。

---

## 1. 原本音源と実測ラウドネス

ユーザー採用済みの原本（`（ローカル原本コピー）/` に格納）は以下の通りです（再生成・差替え禁止）。

| 場面 | 曲名 | ファイル名 | サイズ | 形式 | 実測 Integrated LUFS | 実測 True Peak |
|---|---|---|---:|---|---:|---:|
| **TRPG** | Shared Discovery | `Shared Discovery.mp3` | 4,528,970 bytes | MP3 / 48kHz / stereo | **-15.7 LUFS** | **-3.5 dBFS** |
| **斧投げ** | Aiming groove | `Aiming groove.mp3` | 2,127,635 bytes | MP3 / 48kHz / stereo | **-15.3 LUFS** | **-4.5 dBFS** |

### 比較対象（既存曲の実測値と設定）
- `title.mp3`: -14.3 LUFS / Peak 0.0 dBFS / `BGM_GAIN`: 1.00（未設定デフォルト）
- `kansetsu_shomei_to_black_coffee.mp3`: -13.6 LUFS / Peak +0.5 dBFS / `BGM_GAIN`: 1.00
- `tonari.mp3`: -17.3 LUFS / Peak -1.1 dBFS / `BGM_GAIN`: 1.00
- `sweets_or_sweets.mp3`: -8.5 LUFS / Peak +1.6 dBFS / `BGM_GAIN`: 0.55 $\implies$ 実効 -13.69 LUFS
- `bgm_tournament_edm` (Overture!): -8.12 LUFS / `BGM_GAIN`: 0.51 $\implies$ 実効 -13.97 LUFS
- `bgm_tournament_craft` (Mind Duel): -10.59 LUFS / `BGM_GAIN`: 0.67 $\implies$ 実効 -14.07 LUFS

---

## 2. 音量補正（BGM_GAIN）の根拠の計算

### 2.1 Web Audio / HTMLAudioElement の音量制約
- `remake/js/core/audio.js` の `bgmLevel(key)` の計算式：
  $$\text{volume} = \text{config.bgmVolume} \times (\text{BGM\_GAIN}[key] \mathbin{??} 1.0) \times \text{bgmDuck}$$
- ブラウザの `HTMLAudioElement.volume` の許容範囲は $[0.0, 1.0]$。もしユーザーが `config.bgmVolume = 1.0` に設定した場合、$\text{BGM\_GAIN}[key] > 1.0$ だと $\text{volume} > 1.0$ となりブラウザが `IndexSizeError` / `RangeError` をスローして停止します。
- したがって、**`BGM_GAIN` は原則として 1.0 以下の減衰（アッテネーター）としてのみ機能する**必要があります。

### 2.2 日常BGMとの音圧関係
- 日常曲の代表である `tonari.mp3` は -17.3 LUFS、街マップ曲 `kansetsu_shomei_to_black_coffee.mp3` は -13.6 LUFS です。
- 今回の新規2曲（-15.7 LUFS と -15.3 LUFS）は、ちょうど日常曲の中間帯（-15.5 LUFS 前後）に位置しており、街マップや店舗から切り替わった際に耳障りな急激な音圧変化を与えません。
- True Peak も -3.5 dBFS / -4.5 dBFS と十分に低く、音割れ（クリッピング）のリスクは皆無です。

### 2.3 2曲間のラウドネス整合（Aiming groove の減衰補正）
- 斧投げ曲「Aiming groove」（-15.3 LUFS）は、TRPG曲「Shared Discovery」（-15.7 LUFS）よりも **0.4 dB 音圧が高い**状態です。
- 切替時に同等レベルの聴感音量で揃えるため、Aiming groove を $-0.4\text{ dB}$ アッテネートします：
  $$\text{Gain}_{\text{axe}} = 10^{-0.4 / 20} = 10^{-0.02} \approx 0.95499 \implies \mathbf{0.95}$$
  $$\Delta L_{\text{axe}} = 20 \log_{10}(0.95) \approx -0.4455\text{ dB}$$
  $$I_{\text{eff, axe}} = -15.3 - 0.4455 = \mathbf{-15.75\text{ LUFS}}$$
- TRPG曲「Shared Discovery」は補正なし（基準）：
  $$\text{Gain}_{\text{trpg}} = \mathbf{1.00} \implies I_{\text{eff, trpg}} = \mathbf{-15.70\text{ LUFS}}$$
- これにより、両曲の実効ラウドネスは **約 -15.7 LUFS**（差 $0.05\text{ dB}$）で完全に揃います。

---

## 3. 復帰BGMの決定根拠

### 3.1 TRPG（ボドゲカフェ）
- **流入元**:
  - 第2章以降の夜の日常行動。街マップ（`bg_osu_map_night`）から `trpg_bar` ピンをタップして来店。
  - マップ画面で再生中のBGMは `kansetsu_shomei_to_black_coffee`。
- **再生開始**:
  - `openTrpgBar`（`remake/js/daily/trpg.js`）開始時に `playBgm("bgm_trpg")` を呼ぶ。
- **復帰先**:
  - 退店時は街マップに戻るため、既存実装と同じく **`kansetsu_shomei_to_black_coffee`** に復帰。
  - 理由: 街マップの夜BGMとしての正本が `kansetsu_shomei_to_black_coffee` であるため。

### 3.2 斧投げ（ソロ来店 / Axe Bar）
- **流入元**:
  - 夜の街マップ（`bg_osu_map_night`）から裏通りの `axe_bar` ピンをタップして来店（`openSlots: [1]`）。
  - 入店前のBGMは `kansetsu_shomei_to_black_coffee`。
- **再生開始**:
  - `visitAxeBar`（`remake/js/daily/axe-bar.js`）開始時に `playBgm("bgm_axe")` を呼ぶ。
  - 入店直前の曲を `previousBgm = currentBgm() || "kansetsu_shomei_to_black_coffee"` として退避。
- **復帰先**:
  - 退店時は街マップに戻るため、退避しておいた **`previousBgm`（通常 `kansetsu_shomei_to_black_coffee`）** に復帰。

### 3.3 斧投げ（ひよりイベント / `hiyori-axe.js`）
- **流入元**:
  - tonari の客席メニューから「ひよりと斧投げへ行く」（`sub === "hiyori_axe"`）。
  - 開始前は tonari 店内であるため、BGMは `tonari`。
  - その後、オープニング会話 `axe_reveal` が tonari 内のBGMで再生される。
- **再生開始**:
  - ミニゲーム `runAxeThrow` の実行直前で `playBgm("bgm_axe")` を呼ぶ。
  - イベント開始前の曲を `previousBgm = currentBgm() || "tonari"` として退避。
- **復帰先**:
  - ミニゲーム終了後、アウトロ会話 `event.outro` および tonari 店内復帰（`setBg("bg_tonari_inside_night")`）時に **`previousBgm`（通常 `tonari`）** に復帰。

---

## 4. 素材形式と配置案

- **形式**:
  単体MP3の再配布を防止するため、既存の大会曲（`bgm_tournament_edm.bgm`, `bgm_tournament_craft.bgm`）と同様に `remake/tools/pack_bgm.py` を用いた `.bgm` パック形式（ヘッダー `SUIENBGM1` ＋ AES-256-GCM暗号化）を採用します。
- **配置案**:
  - `assets/audio/bgm/bgm_trpg.bgm`（Shared Discovery: 約4.5MB）
  - `assets/audio/bgm/bgm_axe.bgm`（Aiming groove: 約2.1MB）
  - （※リポジトリへの素材追加は約6.6MBとなるため、コーディネーターの判断待ち）
- **キー名と目録**:
  - キー名は `bgm_trpg` と `bgm_axe`。
  - `remake/tools/build_manifest.py --audio-only` を実行することで `remake/data/manifest.json` の `"bgm"` 配列に自動追記されます。

---

## 5. ファイル・関数ごとの最小パッチ案

### 5.1 `remake/js/core/audio.js` へのパッチ案
**編集箇所**: `SYNTH_FALLBACK`（未配置時・ロード失敗時のフォールバック）と `BGM_GAIN`（ラウドネス補正）

```diff
--- a/remake/js/core/audio.js
+++ b/remake/js/core/audio.js
@@ -506,6 +506,8 @@ const SYNTH_FALLBACK = {
   bgm_map: "calm",
   bgm_rival_shop: "calm",
+  bgm_trpg: "calm",
+  bgm_axe: "battle",
 };
 
 /** 今鳴っている曲のキー（自動再生待ちの間は null） */
 export const currentBgm = () => currentKey;
 
 // 新規大会曲は約 -14 LUFS にそろえる。設定変更・フェード中も曲ごとの倍率を保つ。
-const BGM_GAIN = { sweets_or_sweets: 0.55, bgm_tournament_edm: 0.51, bgm_tournament_craft: 0.67, bgm_continue_urgent: 0.68 };
+const BGM_GAIN = { sweets_or_sweets: 0.55, bgm_tournament_edm: 0.51, bgm_tournament_craft: 0.67, bgm_continue_urgent: 0.68, bgm_axe: 0.95, bgm_trpg: 1.0 };
```

---

### 5.2 `remake/js/daily/trpg.js` へのパッチ案
**対象関数**: `openTrpgBar`
**編集箇所**: 入店時の `stopBgm(.2)` を `playBgm("bgm_trpg")` へ変更。

```diff
--- a/remake/js/daily/trpg.js
+++ b/remake/js/daily/trpg.js
@@ -54,7 +54,8 @@ export async function openTrpgBar({ nightBusy = () => false } = {}) {
   const host = el("section.trpg-screen", { "aria-label": "ボドゲカフェのシナリオ棚" });
   const hadHud = document.getElementById("hud")?.classList.contains("show");
   showHud(false);
-  showScreen("trpg", host); stopBgm(.2);
+  showScreen("trpg", host);
+  playBgm("bgm_trpg");
   const controller = mountTrpgCampaign(host, { getState: () => state, save, nightBusy });
   const unsubscribe = on("hud", () => { if (state !== owner) controller.destroy(); });
   const observer = new MutationObserver(() => { if (!host.isConnected) controller.destroy(); });
```

---

### 5.3 `remake/js/daily/axe-bar.js` へのパッチ案
**対象関数**: `visitAxeBar`
**編集箇所**: `core/audio.js` から `playBgm`, `currentBgm` をインポートし、入店時に `playBgm("bgm_axe")` を再生、退店時（`finally`）に直前のマップBGMへ復帰。

```diff
--- a/remake/js/daily/axe-bar.js
+++ b/remake/js/daily/axe-bar.js
@@ -7,6 +7,7 @@ import { DB, bgUrl } from "../core/data.js";
 import { layers, showScreen, setBg, toast } from "../core/ui.js";
 import { venueHost } from "../core/venue-host.js";
 import { addMoney, addStamina, earnStat } from "../core/stats.js";
+import { playBgm, currentBgm } from "../core/audio.js";
 import { showHud } from "./hud.js";
 import { AXE_BAR } from "./axe-bar-data.js";
 import { runAxeThrow } from "../minigames/axe.js";
@@ -29,6 +30,8 @@ export async function visitAxeBar({ staminaGuard = async () => true, signal } =
   const hadHud = document.getElementById("hud")?.classList.contains("show");
   const host = el("div.sub-menu.axe-bar-menu", { dataset: { test: "axe-bar-menu" } });
   showScreen("axe-bar", host); showHud(false);
+  const previousBgm = currentBgm() || "kansetsu_shomei_to_black_coffee";
+  playBgm("bgm_axe");
   const observer = new MutationObserver(() => { if (!host.isConnected) cancel(); });
   observer.observe(layers.screen, { childList: true });
   const available = () => current() && owner.visitedDay.axe_bar !== day && owner.money >= AXE_BAR.playCost && owner.stamina > 0;
@@ -89,6 +92,9 @@ export async function visitAxeBar({ staminaGuard = async () => true, signal } =
     observer.disconnect(); unsubscribe(); window.removeEventListener("pagehide", cancel);
     signal?.removeEventListener("abort", cancel); abort.abort(); active = false;
     if (state === owner && host.isConnected) showHud(hadHud);
+    if (state === owner) playBgm(previousBgm);
   }
 }
```

---

### 5.4 `remake/js/daily/hiyori-axe.js` へのパッチ案
**対象関数**: `playHiyoriAxeSequence`
**編集箇所**: `core/audio.js` から `playBgm`, `currentBgm` をインポートし、ミニゲーム `runAxeThrow` 開始時に `playBgm("bgm_axe")` を再生、ミニゲーム終了後およびシーケンス完了/中断時（`finally`）に直前の `tonari` BGMへ復帰。

```diff
--- a/remake/js/daily/hiyori-axe.js
+++ b/remake/js/daily/hiyori-axe.js
@@ -6,6 +6,7 @@ import { play } from "../vn/engine.js";
 import { runAxeThrow } from "../minigames/axe.js";
 import { bgUrl } from "../core/data.js";
 import { setBg } from "../core/ui.js";
+import { playBgm, currentBgm } from "../core/audio.js";
 
 export function hiyoriAxeAffordable() {
   const event = hiyoriRoute().events?.find(e => e.id === "axe_reveal");
@@ -26,16 +27,20 @@ export async function playHiyoriAxeSequence(event, { signal } = {}) {
   signal?.addEventListener("abort", cancel, { once: true });
   if (signal?.aborted) abort.abort();
+  const previousBgm = currentBgm() || "tonari";
   try {
     if (!current()) return false;
     const opening = await play(event.dialogue, { signal: abort.signal });
     if (!current() || opening?.id !== event.dialogue) return false;
+    playBgm("bgm_axe");
     const game = await runAxeThrow({ host: document.getElementById("stage"), signal: abort.signal,
       mode: "practice", opponent: "hiyori" });
     if (!current() || !game.completed) return false;
+    playBgm(previousBgm);
     const ending = await play(event.outro, { signal: abort.signal });
     return current() && ending?.id === event.outro;
   } finally {
     unsubscribe(); signal?.removeEventListener("abort", cancel); abort.abort();
     if (state === owner) await setBg(bgUrl("bg_tonari_inside_night"), { fast: true });
+    if (state === owner) playBgm(previousBgm);
   }
 }
```

---

## 6. テスト観点

1. **ラウドネス・音量計算**:
   - `BGM_GAIN.bgm_axe = 0.95`, `BGM_GAIN.bgm_trpg = 1.0` により、実効ラウドネスが約 -15.75 LUFS と -15.70 LUFS に揃うこと（差 0.05 dB）。
   - `config.bgmVolume = 1.0` 時でも `volume <= 1.0` を保ち、ブラウザの音量例外が発生しないこと。
   - `config.mute = true` 時に正しく音量が 0 になること。
2. **切替・復帰・二重再生防止**:
   - `playBgm` は内部で既存BGMを 0.6秒フェードアウトしてから新曲をフェードインするため、即時切替による急峻なクリッピングや二重再生が起きないこと。
   - TRPG終了時、ソロ斧投げ終了時に `kansetsu_shomei_to_black_coffee` へ確実に復帰すること。
   - ひより斧投げ終了時に `tonari` へ確実に復帰すること。
   - 画面離脱・キャンセル・例外発生時も `finally` 句で退避した直前のBGMに復帰すること。
3. **パック形式の暗号化・復元**:
   - `pack_bgm.py`（AES-256-GCM / `SUIENBGM1`）で暗号化されたバイナリが `audio.js` の `bgmSource` で正しくBlob URLに復号されること。
   - 音源の取得失敗時は `SYNTH_FALLBACK`（TRPG: calm, 斧: battle）に自動フォールバックし、ゲーム進行が停止しないこと。

---

## 7. 要ユーザー確認（要コーディネーター確認）

1. **ファイル追加（約6.6MB）のタイミング**:
   - `bgm_trpg.bgm`（約4.5MB）および `bgm_axe.bgm`（約2.1MB）はリポジトリに追加すると約6.6MBの通信量となります。
   - リポジトリ安全ルール（大容量通信の事前確認）に従い、リポジトリへの追加とpushはコーディネーター側の判断で実行していただく形としています。
2. **キー名・ファイル名**:
   - 用途ベースの `bgm_trpg` / `bgm_axe`（大会曲 `bgm_tournament_edm` と同様の設計）を推奨案としてパッチを作成していますが、もし曲名ベース（`shared_discovery` / `aiming_groove`）をご希望の場合は、ファイル名とパッチのキー名を差し替えるだけで対応可能です。
