# 規格そろえ：進捗表

`立ち絵そろえ` スキルが読み書きする。上から順に進める。プロンプトは [prompts.md](prompts.md)、規格は [docs/portrait_standard.md](../../../docs/portrait_standard.md)。
状態：`未着手` → `生成済み`（原画を保存・オーナー確認待ち）→ `合格` → `組み込み済み`。
2026-10-10 に終えた最初の「立ち絵そろえ」（6人34表情）の記録は [resolution-upgrade-20261009/progress.md](../resolution-upgrade-20261009/progress.md)。

## 段階1：試作（通常3枚）

2026-11-02：この環境に接続された OpenAI 画像API（gpt-image-2 等）で生成しようとしたが、残高切れ（insufficient_quota）で生成できなかった。残高を足すか、Codex など画像生成が使える環境で「立ち絵そろえ」を送り直す。

| 順 | キャラ | 表情 | 状態 | メモ |
|---|---|---|---|---|
| 1 | 組長（`kumicho`） | normal | 合格（C案） | 約6.75〜7.1頭身。原画は `kumicho-remaster-v2/normal-source.png` |
| 2 | スティーブ（`steve`） | normal | 合格（B案） | 約7.0頭身。原画は `steve-remaster-v2/normal-source.png` |
| 3 | ヴォルク（`volk`） | normal | 合格（B案） | 約7.6〜7.7頭身。原画は `volk-remaster-v2/normal-source.png` |

2026-11-02 Codex が各3案を生成し、[PR #2330 のコメント](https://github.com/haseatsu114514-dot/shisha-game/pull/2330#issuecomment-6573094756)でギガファイル便のZIP（期限 2026-11-07、SHA256 `f4c68242905c3d83a9998c463354046dc5ac20a887b9162f1753b2c0ee435fa2`）として共有した。採用前なのでリポジトリには入れていない。Codex は各キャラの目標（6.7・7.4）±0.3で全案不合格と判定したが、規格（標準6.4〜7.7）で見ると9案中8案が範囲内。画風（髪・靴の艶）・余白・ノイズを含め、どれを採るか・作り直すかはオーナーが決める。期限までに採る案を `asset_sources/portraits/<id>-remaster-v2/normal-source.png` として保存する。

2026-11-02 オーナー「1は任せる」で、規格の中央に近く足元の余白がある案を選んだ（組長C・スティーブB・ヴォルクB）。選んだ理由と全9案の頭身は各フォルダの `generation.json`。**ゲームへの組み込みは表情差分ができてから**キャラ単位で行う（通常だけ先に入れると、表情を切り替えたときに頭の大きさが変わる）。次はこの3人の表情差分を、合格した通常の原画を②に入れて作る。

## 段階1.5：みんと営業姿（5表情）

2026-11-02 オーナー「可愛い方」で、営業姿の頭を私服の大きさ（6.41頭身）に合わせる。プロンプトは prompts.md の「みんと営業姿」。

| キャラ | 表情 | 状態 |
|---|---|---|
| みんと（`minto`） | normal・smile・sad・surprise・wink | 組み込み済み（Draft PR・オーナー確認待ち） |

## 段階2：残りの通常（7枚）

| 順 | キャラ | 表情 | 状態 | メモ |
|---|---|---|---|---|
| 4 | 六角サイ（`sai`） | normal | 未着手 | 現在8.39頭身 |
| 5 | 零-REI-（`rei`） | normal | 未着手 | 現在8.67頭身 |
| 6 | 斧崎マキ（`maki`） | normal | 未着手 | 現在8.74頭身 |
| 7 | 路上占い師（`uranaishi`） | normal | 未着手 | 現在8.78頭身 |
| 8 | シェイク（`sheikh`） | normal | 未着手 | 現在8.88頭身 |
| 9 | 王煙楼（`master_hookah`） | normal | 未着手 | 現在8.98頭身 |
| 10 | ダ・シルヴァ太陽（`da_silva`） | normal | 未着手 | 現在9.08頭身。通常だけ腕を上げていて頭の位置が他の表情と違う（2026-11-02 に真剣の大きさだけ先に合わせた） |

## 段階3：表情差分（キャラ単位）

通常が合格したキャラから、残りの表情をまとめて作る。組み込みはキャラ単位（新旧の表情を混ぜない）。

| キャラ | 表情 | 状態 |
|---|---|---|
| 組長（神崎竜二）（`kumicho`） | smile・serious・surprise・sad・smug | 組み込み済み（Draft PR・オーナー確認待ち） |
| スティーブ（`steve`） | smile・serious・surprise・sad | 組み込み済み（Draft PR・オーナー確認待ち） |
| ヴォルク（`volk`） | smile・serious・surprise・sad | 組み込み済み（Draft PR・オーナー確認待ち） |
| 六角サイ（`sai`） | smile・serious・surprise・thinking | 未着手 |
| 零-REI-（`rei`） | smile・serious・surprise・sad | 未着手 |
| 斧崎マキ（`maki`） | smile・serious・surprise・excited | 未着手 |
| 路上占い師（`uranaishi`） | smile・serious・surprise・sad | 未着手 |
| シェイク（`sheikh`） | smile・serious・surprise・smug | 未着手 |
| 王煙楼（`master_hookah`） | smile・serious・surprise・sad・angry・laugh | 未着手 |
| ダ・シルヴァ太陽（`da_silva`） | smile・serious・surprise・excited | 未着手 |

2026-11-02 TS09：Codex の候補（組長15・スティーブ12・ヴォルク12・みんと15＋旧案）から、新しい通常と会話画面での頭の大きさが最も近い案を選んで組み込んだ。選んだ案と全候補の値は各 `<id>-remaster-v2/generation.json`。

| キャラ | 選んだ案 | 通常との頭の大きさ |
|---|---|---|
| 組長 | smile A・serious C・surprise A・sad A・smug C | −4〜+1%（smug だけ約−8%） |
| スティーブ | smile C・serious A・surprise A・sad C-v2 | +2〜+5% |
| ヴォルク | smile C-v2・serious A・surprise C・sad A | −1〜+1% |
| みんと | normal B・smile A-v3・sad B・surprise C-v3・wink B-v3 | 私服との差 約13%→約5〜6% |

- スティーブの笑顔・真剣・驚き、ヴォルクの笑顔・真剣・驚きは頭が通常より13〜33px横にずれていたので、絵全体を横へ動かして頭の位置を通常にそろえた。
- みんとは厚底靴のぶん頭身が大きく出るので、頭身ではなく会話画面での頭の大きさ（頭頂〜あご）で私服と比べた。
- 会話画面で21表情×PC／スマホを切り替え、読み込み・見切れ・配置の枠の動きが無いことを確認した。

## オーナー判断（2026-11-02 回答済み）

| 件 | 回答 |
|---|---|
| 試作の選定 | 任せる → 組長C・スティーブB・ヴォルクB |
| みんとの私服 | 可愛い方 → 頭が大きい私服に営業姿を合わせる（段階1.5） |
| 上園 | そのまま（`accepted`） |
| あげは・サメちゃんの区分 | 可愛い方 → 小柄枠のまま |
