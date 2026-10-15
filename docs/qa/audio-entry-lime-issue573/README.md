# 鈴・LIME音と非破壊診断（#573・部分対応）

WORKER: `codex-c-audio573-20261015-d9a204ec`。CLAIM_RUN `38753858417`、初回STATUS_RUN `38754092264`、再開STATUS_RUN `38756402608`はSUCCESS。Issue・owner・元claim runを実ログで照合済み。同branch `codex/c-573-audio-entry-lime` / Draft PR #583で予約を維持する。Issue全体の完了・マージ・公開の記録ではない。

## 実装

汎用door a/b・walkdoorと退店台詞2件から鈴を除き、tonariのplace予約を消費した場面が店内背景DOMへ差し替わった時点で一度だけ鳴らす。お姉さんの実入店台詞SEは維持。帰宅・他店・退店・会話送り・再描画・予約なしの復帰は対象外。

予約は`setBg`要求時に消費し、同背景のearly returnから次の場面へ持ち越さない。場面確定を幕の生成から分離したため、初回・instant・wipe・holdCover中にも同じ入店条件を使う。古い非同期要求は`bgNow`のガードで確定しない。画像ロード失敗後もDOMを追加して進む既存契約は維持しており、「画像の読込成功」を保証する通知ではない。ロゴや演出style、fast/reducedとは独立する。

LIMEの受信は短い2音、送信は短い上昇音のオリジナル合成。既存SE busとunlock/running/hidden/mute/muted/SE音量条件を共有する。同時受信音は200ms以内の重複を抑え、履歴・閉鎖後のtyping・古いgenは無音。旧phone/playSe("phone")、保存形式、click/blip、全体音量の意味は変更しない。新しい外部素材・バイナリ音源は追加していない。

第3章mukaiの専用実入店経路は現行runtimeに確認できない。`remake/js/chapters/`はch1/ch2で、`ch2-tournament.js:245`は東京への紹介LIMEにとどまる。`daily/`にもmukai入店接続は確認できず、新ストーリーや背景を創作していない。接続には正式な第3章runtime、厳格なchapter===3・spotId===mukai、正本の店内背景確定が必要。純粋条件だけを先に検査し、未接続を完成扱いしない。

## 検証

非ブラウザでPASS:

- `node --experimental-vm-modules remake/test/recorded_se.mjs` — 既存録音、新IDの音の差・SE bus・音声保護条件・重複/後続受信・旧phone。
- `node --experimental-vm-modules remake/test/entry_phone_audio.mjs` — 実entry/transition/phoneに加え、実`ui.setBg`との統合。通常/fast/reduced、初回/instant/brief/wipe/holdCover、同背景、取消/期限切れ、中断、画像失敗を検査。DOM/Image/装置境界だけstubし、本体は複写しない。
- `continue_audio.mjs`、`bgm_gain.mjs`、`lime_consistency.mjs`（同じNode VMフラグ）。LIME mockへ新IDのみ追加し、既存assertは維持。
- JS構文、diff check、Git Safety、workflow YAMLの構文・新step・PR/push path。actionlintは未導入で未実行。
- `python3 tools/lint_dialogue.py ch1_main` — ERROR 0 / 既存WARN 6。

Mac既存ChromeのPlaywrightでPASS（PC / タッチエミュレーションの専用context）:

- `browser/recorded_se.mjs`: WAV decode、実サンプル、連続ループ、音量/消音、末尾音、対応付け・終了処理。初回はwater RMS assertに失敗したが、診断でrunningと実サンプルを確認し、assert/閾値を変えない再実行がPC/タッチともPASS。原因解消の証明とはしない。
- `browser/audio_entry_diagnostics.mjs`: 実setBgでnormal/instant/skip/holdCover/wipe各1回、同背景→復帰のstale cueは0回。buffer/oscillatorの発火時刻・state・論理source数とgainの実RMS/peakを測定。論理source数は音響的な同時発音数と同一ではない。
- `browser/audio_modes.mjs`: 実VNの通常/AUTO/SKIPを実クリック/タップ。通常/AUTOは各2回の送り音と文字音、SKIP開始後は送り音/文字音0。実phone返信は受信2/送信1、履歴再表示0。既存save_loadと同じ代表schema5形式の実loadとcueなし復帰で音0・元の保存内容を維持。実mapのtonariピン→行く→tonariMenu→戻るで入店鈴1回。

結果の最小集計と対象コードhashは`browser_results.json`。ページ内fixtureで実production UIを検査しており、自然なNew Gameからの全章通し・物理端末操作ではない。新ブラウザ2本もrecorded-se CIへ接続。CIはPRの最新headで別途終端確認する。

## 非破壊の素材波形診断

```sh
python3 docs/qa/audio-entry-lime-issue573/analyze_wav.py
```

素材を読み取るだけでJSONをstdoutへ出す。保存結果は`wav_metrics.json`。13本すべてPCM16/44.1kHz、最大peak .892120、飽和サンプル0。ui_clickは52.83ms / peak .764496 / RMS .141382 / DC .004651 / first .010742 / last -.066711 / 最大隣接差 .252960。末尾非ゼロは確認候補であり、実際のgain envelope・実出力・装置・聴取との照合なしに原因と断定しない。water_loopは1.28s / peak .125885 / RMS .010661 / DC約-7.62e-8 / first .001892 / last .002533。全hash・channel指標はJSON参照。素材は再圧縮・変更していない。

ブラウザ診断の複数gain観測で最大RMSはPC約.03684 / touch約.04386、最大peakは約.11838 / .11748。測定fixtureの値であり全ゲーム音声の上限ではない。合成blipは素材WAVの測定対象外。無飽和や端点だけで破裂音の有無は判断できず、スピーカー故障とも断定しない。

## 未確認と次の手順

実音聴取、オーナーの破裂音の実環境再現、物理PC/スマートフォン・Safari・公開版、自然な全章通し、全styleの見た目、第3章実入店は未確認。破裂音を修正済みとは扱わない。次は端末/ブラウザ/出力機器/音量/連打間隔/通常AUTO/SKIP/話者と発火ログを揃え、click・blip・台詞sfxを個別比較し、非ゼロ末尾を含む素材と混合出力を実聴取と照合する。

quota guardはホーム下設定を読むため制約上未実行。再開時の公式非推論C readは2026-10-15T15:01:07ZにPlus・5時間使用7%・週使用17%。古い値を推測更新しない。
