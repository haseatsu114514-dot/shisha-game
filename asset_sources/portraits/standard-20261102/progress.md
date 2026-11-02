# 規格そろえ：進捗表

`立ち絵そろえ` スキルが読み書きする。上から順に進める。プロンプトは [prompts.md](prompts.md)、規格は [docs/portrait_standard.md](../../../docs/portrait_standard.md)。
状態：`未着手` → `生成済み`（原画を保存・オーナー確認待ち）→ `合格` → `組み込み済み`。
2026-10-10 に終えた最初の「立ち絵そろえ」（6人34表情）の記録は [resolution-upgrade-20261009/progress.md](../resolution-upgrade-20261009/progress.md)。

## 段階1：試作（通常3枚）

2026-11-02：この環境に接続された OpenAI 画像API（gpt-image-2 等）で生成しようとしたが、残高切れ（insufficient_quota）で生成できなかった。残高を足すか、Codex など画像生成が使える環境で「立ち絵そろえ」を送り直す。

| 順 | キャラ | 表情 | 状態 | メモ |
|---|---|---|---|---|
| 1 | 組長（`kumicho`） | normal | 未着手 | |
| 2 | スティーブ（`steve`） | normal | 未着手 | |
| 3 | ヴォルク（`volk`） | normal | 未着手 | |

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
| 組長（神崎竜二）（`kumicho`） | smile・serious・surprise・sad・smug | 未着手 |
| スティーブ（`steve`） | smile・serious・surprise・sad | 未着手 |
| ヴォルク（`volk`） | smile・serious・surprise・sad | 未着手 |
| 六角サイ（`sai`） | smile・serious・surprise・thinking | 未着手 |
| 零-REI-（`rei`） | smile・serious・surprise・sad | 未着手 |
| 斧崎マキ（`maki`） | smile・serious・surprise・excited | 未着手 |
| 路上占い師（`uranaishi`） | smile・serious・surprise・sad | 未着手 |
| シェイク（`sheikh`） | smile・serious・surprise・smug | 未着手 |
| 王煙楼（`master_hookah`） | smile・serious・surprise・sad・angry・laugh | 未着手 |
| ダ・シルヴァ太陽（`da_silva`） | smile・serious・surprise・excited | 未着手 |

## オーナー判断待ち

| 件 | 内容 |
|---|---|
| みんとの私服 | 私服の頭が営業姿より12%大きい（6.41頭身と7.00頭身）。どちらに合わせるか |
| 上園 | 6.38頭身で規格（6.4〜）の境目。作り直すか |
| あげは・サメちゃんの区分 | 今の採用絵に合わせて小柄枠（5.4〜6.2）に入れた。標準枠へ寄せるか |
