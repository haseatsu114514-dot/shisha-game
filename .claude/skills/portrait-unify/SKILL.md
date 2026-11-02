---
name: portrait-unify
description: オーナーが「立ち絵そろえ」と言ったら使う（「立ち絵そろえ 続けて」「立ち絵そろえ 組み込んで」「立ち絵そろえ 組長」なども同じ）。立ち絵の頭の大きさ・画風を規格（docs/portrait_standard.md）にそろえる作り直しを、進捗表を読んで次の段階から進める：プロンプトで画像生成→原画の保存→ゲーム用896x1200への位置合わせ→頭身の測定→比較画像でオーナー確認→採用分の組み込み。Use when the owner says 立ち絵そろえ to run or continue the portrait resolution/face-size/style unification remaster.
---

# 立ち絵そろえ（頭の大きさ・画風を規格にそろえる作り直し）

キーワード **「立ち絵そろえ」** で呼ばれたら、このファイルの手順で**進捗表の続きから**進める。
1回の呼び出しで1つの「区切り」まで進め、オーナーの確認が要るところで止まる。

2026-11-02 から第2期（規格そろえ）。第1期（2026-10-10、6人34表情の画質・顔の大きさ）は完了し、記録は [resolution-upgrade-20261009](../../../asset_sources/portraits/resolution-upgrade-20261009/README.md)。

| 何を見るか | ファイル |
|---|---|
| 規格（頭身・顔アイコン・画風の数値と言葉） | [docs/portrait_standard.md](../../../docs/portrait_standard.md) |
| 進捗（どこまで済んだか・次は何か・オーナー判断待ち） | [progress.md](../../../asset_sources/portraits/standard-20261102/progress.md) |
| 完成プロンプト・参照画像のパス・生成後チェック | [prompts.md](../../../asset_sources/portraits/standard-20261102/prompts.md) |
| 原画をゲーム用896x1200へ合わせる | `tools/fit_portrait.py` |
| 頭身を測る・顔アイコンの枠 | `tools/portrait_metrics.py`（記録は `data/portrait_metrics.json`） |

## 呼び出しの言い方

- `立ち絵そろえ` / `立ち絵そろえ 続けて` … 進捗表の次の区切りを進める
- `立ち絵そろえ OK` / `合格` … いま「生成済み」の分を合格にして次へ
- `立ち絵そろえ 直して：<直す点>` … いま確認中の画像を、その点だけ直して作り直す
- `立ち絵そろえ 組み込んで <キャラ>` … 合格した分をゲームの素材へ差し替える
- `立ち絵そろえ <キャラ名や番号>` … そのキャラ・番号から進める（ナビの順番より優先）

## 変えないもの（毎回守る）

- 顔立ち・表情・ポーズ・衣装・小物・色・体格。**身長（spriteScale）と全身の高さ**。変えるのは解像度・頭の大きさ・画風だけ。
- 小柄枠（つむぎ・ましろ・あげは・サメちゃん）は丸さを残す（PU04・PU05）。区分を変えるのはオーナー判断。
- 文字・枠・影・床を絵に入れない。採用はオーナーの確認後。マージはオーナーの明示指示があるときだけ。
- 正本はGitHub。生成した原画はその場で `asset_sources/portraits/<id>-remaster-v2/` に保存して commit・push する（PCや生成サービスに置いたままにしない）。

## 手順

### 0. 準備

1. AGENTS.md の Git Safety を確認し、`git fetch origin` → 最新の `origin/main` から作業ブランチを切る（このタスクの未マージのPRブランチがあれば、そこに最新mainを取り込んで続ける）。
2. `progress.md` を読み、オーナーの言い方から今回やることを決める（上の「呼び出しの言い方」）。

### 1. 区切り（どこまで進めて止まるか）

- **段階1（試作：組長・スティーブ・ヴォルクの通常）**：3枚を作ったら止まって確認。
- **段階2（残り7人の通常）**：作ったら止まって確認。
- **段階3（表情差分）**：1キャラの残り表情をまとめて作ったら止まって確認。
- progress.md の「オーナー判断待ち」は、オーナーが答えるまで手を付けない。
- 「生成済み」が残っている（確認待ち）なら、新しく作らずにそれを見せて確認を求める。

### 2. 生成（1表情ずつ）

1. `prompts.md` の該当ブロックの**英文をそのまま**使う（言い換え・要約しない）。オーナーが直す点を言った場合だけ、末尾に英語で1〜2文足す。
2. 参照画像は、ブロックの「参照画像」に書いた**リポジトリのファイルを自分で読み込んで**画像生成ツールに渡す（①→②→③→④の順で、プロンプトにそれぞれの役割を書く）。**オーナーに画像の保存や添付を頼まない。** 作業場所にファイルが無いときは GitHub の `origin/main` から取得する。
   **段階3では、②に合格済みの新しい通常の原画 `asset_sources/portraits/<id>-remaster-v2/normal-source.png` を使う。**
3. 画像生成ツール（Codex の画像生成、または環境に接続済みの画像生成API）で生成する。**使える画像生成が無いとき**は生成できない旨と、画像生成が使える環境（Codex など）で「立ち絵そろえ」を送り直してほしいことを伝えて止まる。オーナーに手作業の保存・添付をさせない。
4. 原画を `asset_sources/portraits/<id>-remaster-v2/<face>-source.png` に**無加工で**保存。使ったプロンプトを `<face>-prompt.txt`、添付した画像のパスとSHA-256・生成日・ツール名を `generation.json` に追記する。
5. `python3 tools/fit_portrait.py asset_sources/portraits/<id>-remaster-v2/<face>-source.png <id> <face>` を実行（ゲームの素材は触らない）。`<face>-preview.png` と比較画像 `<face>-compare.png` ができる。WARN（原画が小さい・透過なし・端で切れる）が出たら作り直す。
6. `<face>-preview.png` の頭身を測る：`python3 tools/portrait_metrics.py grid <id> /tmp/g.jpg --image asset_sources/portraits/<id>-remaster-v2/<face>-preview.png` の目盛りで点を読み、`python3 tools/portrait_metrics.py calc <id> eyes=… chin=… crown=… cheeks=…`（記録は書き換えない）。目標±0.3に入らなければ、頭の拡大率を直して作り直す。
7. 比較画像と原画を**原寸で実際に見て** `prompts.md` の生成後チェックを確かめる。不合格なら直す点を英語で1文足して作り直す（2回まで。直らなければその旨を記録して確認に回す）。見ていない画像に「確認済み」と書かない。
8. `progress.md` の状態を `生成済み` にし、測った頭身とメモを一言（例：「7.3頭身。頭はもう少し大きくてもよい」）。

### 3. 確認を求めて止まる

- 区切りの全部ができたら commit・push し、比較画像（`<face>-compare.png`）をオーナーに見せる。
- 聞くこと：「合格か、直す点（頭の大きさ・丸さ・画風・顔の似方・手の位置など）」。**ここで止まる。** 勝手に次の区切りへ進まない。
- オーナーが合格と言ったら `progress.md` を `合格` に。直す点があれば 2 へ戻る。
- 段階1の結果でプロンプト全体に共通する直しが出たら（例：「頭の縮め方が足りない」）、`prompts.md` の該当キャラ全ブロックを直してから次へ進む。

### 4. 組み込み（オーナーが「組み込んで」と言ったとき）

キャラ単位で行う（同じキャラの表情が新旧混在しないよう、全表情が合格してから）。

```bash
python3 tools/fit_portrait.py asset_sources/portraits/<id>-remaster-v2/<face>-source.png <id> <face> --apply   # 表情ごと
python3 remake/tools/build_manifest.py          # numpy・scipy が入っていること（無いと立ち位置がずれる）
python3 tools/portrait_metrics.py grid <id> /tmp/grid.jpg   # 新しい通常を測る（docs/portrait_standard.md 2節）
python3 tools/portrait_metrics.py set <id> eyes=… chin=… crown=… cheeks=…
python3 tools/portrait_metrics.py overlay <id> --out /tmp/ov.jpg   # 点が合っているか原寸で見る
python3 tools/make_face_icons.py <id>           # 丸アイコン（測った位置から自動で切り抜く。手で拡大率を直さない）
python3 tools/portrait_metrics.py check         # 規格内になったか（WARN が消えたか）
python3 tools/portrait_metrics.py sheet         # 顔の大きさの比較図
```

- **顔の大きさ**：`check` で規格内、`asset_sources/reference-sheets/face-size-ingame.png` で同じ区分のキャラと並べて目でも見る。
- **審査員の顔**：組み込んだキャラが `remake/js/craft/audience.js` の `FACE_CROPS` にあれば、`tools/make_face_icons.py` の `face_box` で枠を計算し直して値を更新する。
- **ゲーム画面**：会話で表情を切り替え、立ち位置のずれ・見切れが無いか確認する（portrait-fix スキルの「直した後の確認」）。
- 以前の素材は `fit_portrait.py --apply` が `previous-runtime/` に保存する。
- `progress.md` を `組み込み済み` にし、commit・push・PR。PR本文に差し替えたファイルと確認したことを書く。**マージはオーナーが言ったときだけ。**

## 報告の形

- 何番を作ったか、測った頭身、チェックで気になった点、確認してほしいこと（1〜3点）、次に「立ち絵そろえ」で何が進むか、を短く。
