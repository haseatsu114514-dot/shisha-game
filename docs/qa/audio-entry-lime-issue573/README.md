# 鈴・LIME音の実装と引き継ぎ（#573・部分対応）

WORKER: `codex-c-audio573-20261015-d9a204ec`。予約は維持。実ログで確認したCLAIM_RUN `38753858417` / STATUS_RUN `38754092264` に基づき、開始HEAD `1d19f2be95aabbf8376acc1c09e8bd2143cdf967` からローカル実装した。本記録は鈴・LIMEの部分対応を対象とし、Issue全体の完了記録ではない。

鈴は汎用door a/b・walkdoorから除き、place予約を消費した移動の背景差し替え成功時に一度だけ鳴らす。現在の接続はtonari店内（昼夜・曇天差分を含む）。ロゴ表示・演出style・SKIP相当fast・動き軽減に依存しない。帰宅・他店・退店・通常の再描画・予約なしの復帰は対象外。背景待ち中に別の背景要求で置き換えられた場合は既存ui.setBgのガードにより確定通知しない。ui.jsの追加は背景append直後の確定通知1行だけ。

第1章の開幕客退店・つむぎ退店の台詞SEを除き、お姉さんの実入店SEは維持。第3章mukaiの現行入店経路は見つからず未接続。将来の純粋条件は厳格にchapter===3かつspotId===mukaiを検査するが、経路や背景は追加していない。

LIMEは受信を短い2音、送信を短い上昇音のオリジナル合成へ分離。unlock・running・hidden・mute/muted・SE音量を共通条件で保護し、既存SE busへ接続。同時の通知と案内は200ms以内の受信音を重ねない。履歴は無音、typing待ち後に閉鎖・世代変更した場合も無音。旧phone/playSe("phone")と保存形式は維持。

ローカル非ブラウザ検証（PASS）:

- `node --experimental-vm-modules remake/test/recorded_se.mjs` — 既存録音契約、新IDの音の差・bus・抑止・同時受信重複・後続受信・旧phone互換。
- `node --experimental-vm-modules remake/test/entry_phone_audio.mjs` — 実entry/transition/phoneモジュールをVMで読み、入店一度・通常/fast/動き軽減・予約取消/期限切れ・履歴・送受信・閉鎖/古いgenを確認。DOMと音声装置はスタブ。uiの確定通知位置も検査。
- `node --experimental-vm-modules remake/test/continue_audio.mjs` / `node --experimental-vm-modules remake/test/bgm_gain.mjs`。
- `node --experimental-vm-modules remake/test/lime_consistency.mjs` — 新SE IDをmockへ追加し、既存assertを維持して受信・返信・予約・再案内・旧名導入等を確認。初回のmock未定義エラーは更新後の再実行で解消。
- 変更JSの構文確認、`git diff --check`。
- `python3 tools/lint_dialogue.py ch1_main` — ERROR 0、既存台詞へのWARN 6。
- workflowはRuby YAMLで構文・新テストstep・PR/pushの起動対象を確認。actionlintは未導入のため未実行。

未実施: 実音聴取、WAV波形/ピーク/RMS/DC/端点の測定、本物のPC・タッチ入力、通常/AUTO/SKIPのブラウザ操作、Safari、公開版、第3章の実入店。VMのfast検査は本物のSKIP操作やブラウザQAのPASSを意味しない。全styleの視聴とロゴなしケースも実画面では未確認。

破裂音の原因は未特定。全体音量・click・blipの意味は変更していない。次は発生環境、操作、通常/AUTO/SKIP、音量、背景タブ状態を記録し、同じ操作でclick/blip/録音SEを個別に比較する。WAVを測定してから原因と修正方針を判断する。Issue全体の完了扱いはしない。

`recorded-se.yml` に新しい入店／LIMEのNodeテストと関連ファイルの起動条件を追加。quota guardはホーム下設定を読むため今回の制約で未実行。残量の再推定なし。
