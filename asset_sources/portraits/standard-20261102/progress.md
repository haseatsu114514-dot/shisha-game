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
| みんと（`minto`） | normal・smile・sad・surprise・wink | 組み込み済み |

## 段階2：残りの通常（7枚）

| 順 | キャラ | 表情 | 状態 | メモ |
|---|---|---|---|---|
| 4 | 六角サイ（`sai`） | normal | 合格（B案） | 8.39→約7.6頭身。規格の上限に近い。原画は `sai-remaster-v2/normal-source.png` |
| 5 | 鴉葬レヰ（`rei`） | normal | 合格（C-v2案） | 8.67→約7.35頭身。原画は `rei-remaster-v2/normal-source.png` |
| 6 | 斧崎マキ（`maki`） | normal | 合格（B案） | 8.74→約7.1頭身。3案とも規格内。原画は `maki-remaster-v2/normal-source.png` |
| 7 | 辻占のオババ（`uranaishi`） | normal | 作り直し（依頼文は prompts.md の TS12） | 8.78→最良のC-v2でも約7.9〜8.1頭身。フードで頭頂が隠れ、頭がほとんど大きくならない |
| 8 | シェイク（`sheikh`） | normal | 作り直し（依頼文は prompts.md の TS12） | 8.88→約7.9〜8.5頭身。頭巾で頭頂が隠れる |
| 9 | 王煙楼（`master_hookah`） | normal | 作り直し（依頼文は prompts.md の TS12） | 8.98→A案で約7.7〜7.8頭身。長いひげであごが隠れる。腰のホースの機材検品（shisha_reference §4）も保留 |
| 10 | ダ・シルヴァ太陽（`da_silva`） | normal | 合格（B案） | 9.08→約7.0〜7.3頭身。原画は `da_silva-remaster-v2/normal-source.png` |

2026-11-02 TS10：Codex が7人の通常を各3案（レヰ・辻占のオババは初稿3案も）生成し、オーナーがギガファイル便（期限 2026-11-09、SHA256 `dac280234dbbf36391b14b95d07ff3c8ec480de249309cbc85c63856d326aa15`）で共有した。Claude が頭頂・あごを測り直した値と Codex の値は、各フォルダの `generation.json` の `candidates` にある（推奨案を選んだ4人だけ保存。残り3人の候補はZIPのみ）。

- 推奨の4人（サイB・レヰC-v2・マキB・太陽B）は、原画を `<id>-remaster-v2/normal-source.png` に保存した。オーナーの確認後、表情差分を作ってからキャラ単位で組み込む。
- 辻占のオババ・シェイク・王煙楼は、フード・頭巾・長いひげで頭頂やあごが隠れていて、「頭を約○%大きく」の指示ではほとんど大きくならなかった。作り直すなら、参照②（凛想・須井）と同じ頭の大きさを、原画の高さに対する頭の高さ（約200px／人物1400px）で指定する。上園と同じく今のまま残す（`accepted`）こともできる。

## 段階2.5：ラクダレースの2人（通常2枚・TS13）

第4章ドバイのラクダレース（#2304・#2373）で増えた2人。Codex の候補をそのまま入れたので頭が小さい。2026-11-02 オーナー「任せる」で、表情差分の前に通常を約7頭身で作り直す。プロンプトは prompts.md の TS13（頭の大きさは px で指定）。

| 順 | キャラ | 表情 | 状態 | メモ |
|---|---|---|---|---|
| 11 | ファーリス（`saif`） | normal | 組み込み済み（7.08頭身） | 8.62→目標7.0頭身。①は `asset_sources/ch4-camel-race/originals/saif-normal-A-v2.png` |
| 12 | ハリール（`rashid`） | normal | 組み込み済み（7.48頭身） | 9.75→目標約7頭身。グトラで頭頂が隠れるので目〜あごで測る。①は `asset_sources/ch4-camel-race/originals/rashid-normal-B.png` |

2026-11-02 TS13：Codex が2人の通常を作り直し、ZIP（SHA256 `843eba1d…`）で届いた。原画を `saif-remaster-v2/normal-source.png`・`rashid-remaster-v2/normal-source.png` に保存し、`fit_portrait.py` で確認用の画像（`normal-preview.png`・`normal-compare.png`）を作った。ゲームの素材は触っていない。

- 顔・ひげ・目の色・服・持ち物・ポーズ・色は前の絵のまま。頭だけが大きくなった。身長と足元の位置も前と同じ。
- 頭身は Codex の測定でファーリス 6.61・ハリール 6.85、Claude の測定で 7.24・7.68。頭頂とあごの読み方の差で、どちらも規格（6.4〜7.7）内。前は 8.62・9.75。
- 2026-11-02 オーナー「おーけー」で採用し、組み込んだ。顔の位置を測り直し（ファーリス 7.08・ハリール 7.48頭身、会話画面の頭 143px・128px）、顔アイコンを作り直した。2人の顔アイコンは画像があるのに manifest の `faceIcons` から漏れていて、ゲームで出ていなかったので足した（ヨルも同じく漏れている。別件）。
- 会話画面で PC（1280×720）とスマホ（591×1280）に表示し、読み込み・頭の見切れ・画像端の欠けが無いことを確かめた。
- **次は prompts.md の TS13「表情差分」**（ファーリス：smile・surprise・excited・wink、ハリール：smile の5枚）。①は合格した `asset_sources/portraits/<id>-remaster-v2/normal-source.png`。台詞はこの5種類を指定していて、今は全部通常の顔で代用されている。

ヌール（`noor`、7.96頭身）は上限7.7をわずかに超えるだけなので、今のまま残す案を推奨（オーナー未回答）。

## 段階3：表情差分（キャラ単位）

通常が合格したキャラから、残りの表情をまとめて作る。組み込みはキャラ単位（新旧の表情を混ぜない）。

| キャラ | 表情 | 状態 |
|---|---|---|
| 組長（神崎竜二）（`kumicho`） | smile・serious・surprise・sad・smug | 組み込み済み |
| スティーブ（`steve`） | smile・serious・surprise・sad | 組み込み済み |
| ヴォルク（`volk`） | smile・serious・surprise・sad | 組み込み済み |
| 六角サイ（`sai`） | smile・serious・surprise・thinking | 組み込み済み |
| 鴉葬レヰ（`rei`） | smile・serious・surprise・sad | 組み込み済み |
| 斧崎マキ（`maki`） | smile・serious・surprise・excited | 組み込み済み |
| 辻占のオババ（`uranaishi`） | smile・serious・surprise・sad | 未着手 |
| シェイク（`sheikh`） | smile・serious・surprise・smug | 未着手 |
| 王煙楼（`master_hookah`） | smile・serious・surprise・sad・angry・laugh | 未着手 |
| ダ・シルヴァ太陽（`da_silva`） | smile・serious・surprise・excited | 組み込み済み |
| ファーリス（`saif`） | smile・surprise・excited・wink（新規。今は通常だけ） | 依頼文あり（prompts.md の TS13）・通常の合格待ち |
| ハリール（`rashid`） | smile（新規。今は通常だけ） | 依頼文あり（prompts.md の TS13）・通常の合格待ち |

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

2026-11-02 オーナー「推奨のをお願い」：TS09 の21枚をゲームに組み込み（PR #2369）、サイB・レヰC-v2・マキB・太陽Bの通常を合格にした。辻占のオババ・シェイク・王煙楼は作り直す。次は Codex で「立ち絵そろえ 続けて」と送り、prompts.md の TS11（4人の表情差分16枚）と TS12（3人の通常の作り直し）を作る。

2026-11-02 TS11：Codex がサイ・レヰ・マキ・太陽の表情を各4枚（計16枚）作り、オーナーがギガファイル便（期限 2026-11-09、ZIP の SHA256 `8a43a3ab1c22773b45176a1a22f2a5cc1a19167578be22f411b91e471bdc8399`）で共有した。中の4つのZIPは一覧の SHA256 と一致。Claude が会話画面の大きさで新しい通常と頭頂・あごを並べ、16枚とも頭の大きさがそろうことを確認した。透明度16以上の散った画素は無い。通常＋表情の20枚を組み込み、頭が通常より8px以上横にずれる9枚は絵全体を横へ動かして頭をそろえた（rei/serious +8px, rei/surprise +14px, maki/excited +10px, maki/serious +10px, maki/smile +9px, maki/surprise +8px, da_silva/serious +30px, da_silva/smile -8px, da_silva/surprise +11px）。顔の位置の記録・顔アイコンも作り直し、20表情×PC／スマホの会話画面で確認した。オーナー「OK。ただレイだけ顔でかく拡大されてるような」→ レヰの顔アイコンだけ寄りすぎていた（右の頬が髪に隠れていて、頬の幅を狭く測っていた）。頬の幅を髪の下の輪郭まで測り直してアイコンを作り直した。会話画面の立ち絵の顔の大きさは標準のキャラの中央値どおりで、変えていない。

## オーナー判断（2026-11-02 回答済み）

| 件 | 回答 |
|---|---|
| 試作の選定 | 任せる → 組長C・スティーブB・ヴォルクB |
| みんとの私服 | 可愛い方 → 頭が大きい私服に営業姿を合わせる（段階1.5） |
| 上園 | そのまま（`accepted`） |
| 7人の通常（TS10） | 推奨のまま → サイB・レヰC-v2・マキB・太陽Bを合格、辻占のオババ・シェイク・王煙楼は作り直し |
| あげは・サメちゃんの区分 | 可愛い方 → 小柄枠のまま |
| 作り直しの範囲と変えてよいもの | 「全キャラ作り直しは勘弁、一部ならいい」「作り直して良い　見た目は今のがいいけど」「頭身とかはいじってもいい」→ 作り直すのは規格外の一部だけ。頭身・頭の大きさは変えてよく、顔・衣装・色・ポーズは今の絵のまま |
| ファーリス・ハリール（ラクダレース） | 任せる → 表情差分の前に通常を約7頭身で作り直す（段階2.5・TS13） |
