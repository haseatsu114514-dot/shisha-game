# #1178 第1章の一人称・表記チェック

## 判定と対象時点

- 2026-10-28、Codex C。参照HEAD: `ed8098a9b0469f508fcca61964a00eebc567f918`（開始時の `origin/main` と一致）、branch: `codex/c-1178r-20261028`。
- [Issue #1178](https://github.com/haseatsu114514-dot/shisha-game/issues/1178) 本文を `gh issue view 1178 --json number,title,body,url` で確認。「指摘は根拠（ファイル・箇所）付きで報告し、修正は別途判断する」に従った調査報告。変更はこのREADMEだけ。**台詞・設定・実装は修正していない。**
- 一人称・固有名詞・肩書きについて10項目の候補を記録した（範囲外の参照元1項目を含む）。はじめの「俺」は正しい。旧設定の「僕」へ戻す提案はない。
- 確度は「高＝明示指示・正本と直接照合可能」「中＝表記やモードの解釈、二次資料の確認が必要」。候補の存在と、修正すべきかの判断を分けた。中の候補は一括置換しない。
- `docs/setting_book/02_characters.md:4` および同 `README.md:6` は資料集を二次資料とし、一人称・呼称表は全件照合未了と明記している。資料集しか固定値の根拠がない南雲・パッキー・ひよりの候補は、その限界も記載した。

## 確認範囲

第1章JSは `remake/js/chapters/ch1.js`、`ch1-preview.js`、`ch1-title-motion.js` の3本。会話本文・直書きの台詞・地の文・選択肢・紹介タイトル・表示名の参照先を確認した。

主要JSONは以下の15本（235シーン、抽出対象の表示文字列3,210フィールド）。全シーンの `lines`、`branches`、`choices` を再帰的に検索し、話者・文脈を確認した。以下の件数は到達可能な画面数や不具合件数ではない。

| `data/dialogue/` 以下のファイル | シーン数 | 文字列フィールド数 |
|---|---:|---:|
| `ch1_adam.json` | 9 | 176 |
| `ch1_ageha.json` | 1 | 25 |
| `ch1_bonds.json` | 9 | 217 |
| `ch1_events.json` | 9 | 151 |
| `ch1_incognito.json` | 3 | 31 |
| `ch1_interval.json` | 6 | 60 |
| `ch1_main.json` | 10 | 357 |
| `ch1_minto.json` | 11 | 352 |
| `ch1_naru.json` | 10 | 229 |
| `ch1_rin.json` | 6 | 108 |
| `ch1_spots.json` | 35 | 325 |
| `ch1_sumi.json` | 10 | 174 |
| `ch1_tournament.json` | 18 | 283 |
| `ch1_tsumugi.json` | 9 | 330 |
| `remake_ch1.json` | 89 | 392 |

`ch1_interval.json` はファイル名による対象に含めたが、現行の `remake/js/core/data.js:43` のロード一覧に含まれず、`remake/js` 内にもシーンIDの直接参照は見つからなかった。実際に再生される会話とは扱いを分ける。

共通JSONも読み、次の第1章関連部分を補助確認した。第2章以降専用の会話は今回の指摘対象にしていない。

| ファイル | 今回の確認部分・根拠 |
|---|---|
| `data/dialogue/confession.json` | `confession_{minto,tsumugi,rin,hiyori}` と各accept/reject |
| `data/dialogue/lover_events.json` | `lover_{tsumugi,minto,rin}_lv1`〜`lv5` |
| `data/dialogue/hiyori.json` | `preview_only` を除く16シーン。イベント定義の `chapters: [1,2]` と `remake/js/daily/hiyori.js`、`core/hiyori-route.js` を確認。previewは参考として区別 |
| `data/dialogue/samechan.json` | `samechan_first_encounter` の本文・分岐。`daily/samechan.js:74` の第1章帰路イベント。ショップ・恋愛の会話は第2章以降 |
| `data/dialogue/craft_inner_voice.json` | 全30シーン。はじめの作業中・工程後の内心 |
| `data/dialogue/tournament_craft.json` | `tournament_craft_opening_1` と第1章から共有する制作・試喫会話（`_2` / `_3` の章専用場面は除外） |
| `data/dialogue/venue_hours.json` | 全17シーン。店主・施設の昼夜会話 |
| `data/dialogue/axe_bar_discovery.json` | 噂・匿名目撃の2シーン |
| `data/dialogue/axe_tutorial.json` / `axe_versus.json` | マキの7レッスン会話、ひより対戦の台詞。`minigames/axe.js:237,252` で別途ロード |
| `data/chapter_previews/ch2.json` | 第1章終了時の全11フレーム。`ch1-preview.js:19` からロードされる次回予告 |
| `data/lime_messages.json` | 第1章で交流するキャラのメッセージ・返信。一人称候補は送信者/返信者を確認 |
| `data/baito_events.json` | シフト会話の本文・選択肢・結果・接客後の文。客の発言の引用と主人公の内心を区別 |
| `remake/data/lover.json` / `friends.json` / `broadcast.json` | 第1章で交流するキャラの恋人・友人文面、大会実況。後章キャラ固有部分は指摘対象外 |

照合先は `docs/master_spec.md`、`brand/character_profiles.md`、`docs/setting_book/{02_characters,03_world_shops,04_glossary,06_flavors_recipes}.md` と、その参照する `data/{characters,flavors,recipes,secret_recipes}.json`。IDの解決・紹介表示を確認するため `remake/js/core/data.js` と `remake/js/vn/{engine,intro}.js` も読み取りだけ行った。

## 指摘一覧

位置は上記HEADのリポジトリ相対パス・行番号。シーン中の配列添字は0始まり。

| ID | ファイル:行 / シーンキー | 現状 | 根拠 | 修正案（未適用） | 確度 |
|---|---|---|---|---|---|
| P01 | `data/dialogue/ch1_spots.json:385` / `ch1_c_station_visit.branches.before_tournament[16]` | 南雲「……で、**僕**が見たいのは、味や技術の正確さじゃない」 | `docs/setting_book/02_characters.md:28,254` は南雲「私」。`data/characters.json` の南雲には一人称の固定フィールドがない | 資料集の「私」を採るなら「私が見たいのは」。正本側の口調確定を確認して採否判断 | 中（資料集との不一致は確認済み） |
| P02 | `data/dialogue/ch1_minto.json:183` / `ch1_minto_first.lines[31]` | 営業中のみんと「**うち**さ、こう見えてシーシャの話できる相手、あんまりいないんだよね」 | `brand/character_profiles.md:80` は営業時「みんと」、私生活「私」（同:81）。直前直後も客への営業会話、`face: smile` | 「みんとさ、こう見えて……」。同:262「うち、キャストはみんとひとりだから♪」、同:576「うちは、お客さんに……」は「うちの店」の省略とも読めるため別扱い。必要なら「うちの店は」と明示 | 高（:183）、店を指す2箇所は要判断 |
| P03 | `data/dialogue/ch1_minto.json:1113,1140,1192,1217,1401,1426,1965` / `ch1_minto_fourth`、`ch1_minto_phantom_smell`、`ch1_minto_after_ch1` | 通常の営業姿で「**私**、はじめくんが……」「**私**の人生」「昔は**私**の実家」「だから**私**……」「**私**にとってはね」「きみの煙、**私**は好き」。`normal/smile/sad/serious` のままで `ura_*` への移行はない | 同プロフィール:80–82の営業/私生活の書き分け。いずれも打ち明け話や閉店際で、本音が混ざる意図も読み取れる | 営業が続く箇所だけ「みんと」にするか、素の話に移る描写・表情を添えて「私」を残すか判断。`ura_*` の私生活会話の「私」は正しく、置換しない | 中（モード解釈が必要） |
| P04 | `data/dialogue/ch1_tsumugi.json:1300,1391,1398` / `ch1_tsumugi_smoke_color`、`data/dialogue/remake_ch1.json:2233` / `remake_shuraba_rin_tsumugi` | つむぎの「**わたし**」が同章の「**私**」と混在 | `data/characters.json:411` の `tsumugi.voice.first_person` は「私」、資料集:65も「私」。別人格の一人称ではなく字面の差 | 漢字に揃えるなら「私」。柔らかさの演出として平仮名を残す方針ならそのまま。補助範囲にも同種が9フィールドある（後述） | 中（表記差は確実、変更必須とは断定しない） |
| P05 | `data/dialogue/ch1_tournament.json:206,536,541,571,601,1560` / `ch1_tournament_opening`、`judging`、`defeat` | MCが「MCは**パッキー**が」「**パッキー**も初めて」「**パッキー**今鳥肌」「**パッキー**は祈りが」「**パッキー**から」「**パッキー**ね」と自称 | `docs/setting_book/02_characters.md:31,275` は着ぐるみ時「ボク」、素「わし」。現行本文では名前による自称が繰り返される。正本プロフィールには「名前での自称は禁止」とする指定は見つからない | 固定する方針なら自称部分を「ボク」にする。MCの名乗り（:206）とキャラ名の自称を許容するなら維持。資料集側との採否判断を先にする | 中（資料集差・許容範囲の判断） |
| P06 | `data/dialogue/hiyori.json:1586` / `hiyori_bond_question.branches.romance[0].inner` | 心の声「うれしい。今の、ちゃんと**私**に言ってくれたんだよね」 | `docs/setting_book/02_characters.md:19,137` は表「私」/心の声「あたし」。正本 `data/characters.json:1006` の `speech_rules` は表/innerの演出を定義するが、この代名詞までは固定していない | 資料集の区別を採用するなら「あたしに」。参考として未接続の `hiyori_preview_gap` 同:240のinner「私の総務窓口」も同種。表の台詞の「私」は変更対象にしない | 中（資料集との照合、previewは本編件数に含めない） |
| N01 | `data/dialogue/ch1_minto.json:992,997` / `ch1_minto_third`、`data/dialogue/ch1_tournament.json:465` / `ch1_tournament_served.lines[5]` | 「**ケインミント**」がみんとの比喩・はじめの内心・大会中のみんとの内心に登場 | `data/flavors.json` の現行5メーカー・78銘柄に同名/短縮名/IDなし。`docs/master_spec.md:53` のメーカー表と資料集 `06_flavors_recipes.md` にも収録なし。`data/flavors.json:324` の「アルファーヘブン ミント」とは別の名称 | 現行世界の未収録銘柄として残すか、既存の「ミント」等へ表現を整理するか判断。:997の「ダークリーフ」も伴うため、名称だけ機械的に差し替えず、採用する銘柄と一緒に判断する。新銘柄の追加は今回の範囲外 | 高（未収録の確認）/ 中（差し替え先） |
| N02 | `data/dialogue/ch1_spots.json:847,1871`、`data/dialogue/ch1_tournament.json:261,271,723,1530` | 地の文やMCで「**火浦理一**」「**上園文太郎**」「**蒸野はじめ**」。いずれも本人の自己紹介ではない | `docs/master_spec.md:252` §8「ネームプレート・LIME・選択肢・通常会話文中に、フルネームは一切表示しない」「フルネームは自己紹介の台詞・設定資料としてデータに残すだけ」。名前の字自体は `data/characters.json` と一致 | :847を「チャコール博士」、:1871を「上園さん」、:1530を「はじめ」に。MCの3箇所も短い呼び名にするか、大会での紹介・選手発表を例外とするか判断。自己紹介中の「蒸野はじめです」「緑川栞」「匂坂 凛」は指摘に含めない | 高（字面・原則との差）/ 中（大会MCの例外解釈） |
| N03 | `data/lime_messages.json:344` / `encourage_minto.messages[1]`、`data/chapter_previews/ch2.json:16` / `frames[id=minto-warning]` | みんと「お祝いの一台は**わたし**に任せて」「**わたし**はここにいるから」 | `brand/character_profiles.md:80–82` は営業「みんと」、私生活「私」。このLIME文面に私生活への切替指定はなく、個人用アカウントの会話とは限らない。予告は次章の断片でモードの説明なし | 私的な本音として残す場合も「私」とする表記統一候補。営業声を保つなら「みんと」。文脈の判断を先にする。予告の第2章側の元シーン全体は今回点検していない | 中 |
| X01 | **参照元が範囲外**: `data/characters.json:56` / `sumi.intro_cutin.title` | スミの紹介肩書きが「**表舞台を降りた名人**」 | 今回の明示指示は「**はじめの師匠**」。`brand/character_profiles.md:26` と資料集:151も師匠関係を記載。`remake/js/vn/intro.js:19,73,119` がこの値を表示し、`engine.js:650` が初出スミの紹介を予約する。章JSONに肩書き文字列は直書きされていない | 別途 `sumi.intro_cutin.title` を「はじめの師匠」にする候補として引き継ぐ。紹介共通データの変更になるため、本調査では触れない | 高（今回の指示との直接差） |

P04の補助範囲9フィールド（主対象4フィールドとは別）:

- `data/dialogue/confession.json:322` / `confession_tsumugi_accept.lines[3]`。
- `data/dialogue/lover_events.json:99,150,170,221,292,314` / `lover_tsumugi_lv2`〜`lv5`。
- `data/lime_messages.json:928` / `lime_after_outing_tsumugi.replies[0].response`。
- `remake/data/lover.json:636` / `gameday.tsumugi[1].m[1]`。

## 問題なし・指摘に含めなかったもの

- **はじめ**: 主対象15JSONの `speaker: hajime`、話者なしの地の文・心の声、選択肢と、上記共通JSONの第1章関連部分を確認。「僕／ぼく／ボク」への戻りは検出なし。`ch1_main.json` 冒頭の内心、`ch1_tournament.json` 優勝後の地の文「その中で、tonariのバイトの俺が勝ったんだ。」、`craft_inner_voice.json` も対象。「凛さんの**私物**」「**オレンジ**」「客の引用中のおれ」などをはじめの一人称誤りに数えていない。
- **ましろ**: 主対象15JSONには `speaker: mashiro` の発話がない。第1章にましろの発話があって適合している、という判定ではない。正本 `brand/character_profiles.md:343,347` と `data/characters.json:748` は「僕」。共通の告白・恋人データにあるましろの「僕」は後章用として検索上区別し、誤りにも変更対象にもしていない。
- **スミ・なる**: 一人称「俺」は一致。店を指す「うち」、語の一部の「私物」「私的」等は除外。スミの師弟関係を否定する本文表現は今回の確認では検出なし。肩書きはX01の参照元に問題が残る。
- **あげは**: `ch1_ageha_encounter` と `outing_ageha_1` は正本の「うち」および「ハジメっち」に反する一人称を検出せず。**凛**の「私」、**チャコール博士**の「私」も一致。**サメちゃん**の第1章帰路会話は本体「わし」、腹話術（`face: ventriloquism`）「余」で対応している。
- **みんと**: `oneesan` と `ura_*` の私生活での「私」は正しい。P03と混同して営業名へ直さない。「うちのお店」「うち、キャストは……」など店を指す語も自称と断定しない。
- **アルファーヘブン**: 主対象15JSONにはメーカーの日本語名自体が直書きされていない。検索した範囲で「アルファヘブン／アルファーヘヴン／アルファヘヴン」等は検出なし。`remake_lemon_gift` が参照する `lemon` の名称はカタログで「アルファーヘブン レモン」。これは参照先の確認であり、店・くじ等の全画面で正しいことを実機保証するものではない。
- **店舗名**: `tonari`、`Dr.fookah`、`NIGHTSIDE`、`C.STATION` の字を確認。`KEMURIKUSA／ケムリクサ`、`EDEN／エデン`、`PEPPERMINT／ぺぱーみんと` は資料集 `03_world_shops.md` が併記しており、誤記扱いしない。
- **人名の字**: 火浦理一・上園文太郎・蒸野はじめ・緑川栞・匂坂凛などは正本と一致。通常会話でのフルネーム使用はN02に分けた。「前園壮一郎」「炭場創」の旧名は表示文字列に検出なし。内部ID `maezono`、匿名客の `???`、私服の `oneesan` は表示名の誤字として扱わない。`ch1.js:655` の `realName()` は本名をそのまま出す関数ではなく、`core/data.js:159` で短い呼び名を返す。
- **フレーバー**: レモン、ミント、ダブルアップル、バニラ、ピーチ、ブルーベリー、ラベンダー、ローズ、ライチ、カルダモン、シナモン等の字は現行カタログと照合。「NS アールグレイ」は `data/flavors.json:570` の登録済み `short_name` なので誤記に含めない。「フラミンゴ・ピーチ」「キャラメル・マキアート風」等は台詞内のミックス名・狙う味であり、単体銘柄と即断しない。配合・報酬・レシピ開放の監査はしていない。
- **第1章JS3本**: 直書きの台詞・文言に、はじめを「僕」とする箇所や対象の固有名詞の明確な誤字は見つからなかった。章題・大会名も設定資料と照合。`ch1-preview.js` の表示文は別JSONなので、N03に分けて確認した。

## 確認方法・検索コマンド

機械検索で候補を抽出した後、同じJSONの前後・話者・表情・分岐と正本を読んで判定した。以下は今回の確認を再実行するためのコマンド。`rg` の終了値1は一致なしであり、検査失敗と混同しない。

```bash
gh issue view 1178 --json number,title,body,url
gh pr list --state open --limit 100 --json number,title,files
rg --files remake/js/chapters data/dialogue docs/setting_book brand
wc -l remake/js/chapters/ch1*.js data/dialogue/ch1_*.json data/dialogue/remake_ch1.json
rg -n '一人称|アルファ|師匠' docs/master_spec.md brand/character_profiles.md docs/setting_book/ data/characters.json
rg -n '俺|僕|私|我|わたし|うち|アル|フレーバー|レモン' remake/js/chapters/ch1.js
rg -n 'わたし|ケインミント|うちさ|うち、キャスト|うちは、お客' data/dialogue/ch1_*.json data/dialogue/remake_ch1.json
rg -n 'アルファヘブン|アルファーヘヴン|アルファヘヴン|アルファーヘブン|前園|炭場' data/dialogue/ch1_*.json data/dialogue/remake_ch1.json
rg -n 'わたし|私に言って|私の総務' data/dialogue/{hiyori,confession,lover_events}.json data/lime_messages.json remake/data/lover.json data/chapter_previews/ch2.json
rg -n '師匠|title|intro_cutin|first_person|short_name' data/characters.json data/flavors.json remake/js/vn/intro.js
rg -n 'ch1_interval|interval_day' remake/js --glob '*.js'
```

主対象15JSONの再帰抽出（Python標準ライブラリのみ）。件数はこの抽出条件による。台詞を実行したりゲームデータを書き換えたりしない。

```bash
python3 - <<'PY'
import collections, json, pathlib, re
files = sorted(pathlib.Path('data/dialogue').glob('ch1_*.json'))
files += [pathlib.Path('data/dialogue/remake_ch1.json')]
rows = []
def walk(value, file, scene='', path='', speaker=''):
    if isinstance(value, dict):
        scene = value.get('dialogue_id', scene)
        speaker = value.get('speaker', speaker)
        for key, child in value.items():
            loc = path + '.' + key
            if isinstance(child, str) and key in (
                'text', 'inner', 'title', 'label', 'name', 'description'
            ):
                rows.append((file, scene, loc, speaker, child))
            elif isinstance(child, (dict, list)):
                walk(child, file, scene, loc, speaker)
    elif isinstance(value, list):
        for i, child in enumerate(value):
            walk(child, file, scene, f'{path}[{i}]', speaker)
for file in files:
    data = json.loads(file.read_text())
    before = len(rows)
    walk(data, str(file))
    print(file, len(data['dialogues']), len(rows) - before)
print('FILES', len(files), 'TEXT_FIELDS', len(rows))
pattern = re.compile('俺|オレ|おれ|僕|ぼく|ボク|私|わたし|あたし|アタシ|わし|ワシ|余|我|うち|ウチ|ミー')
for speaker in sorted({r[3] for r in rows}):
    found = [r for r in rows if r[3] == speaker and pattern.search(r[4])]
    print('SPEAKER', speaker, collections.Counter(
        token for r in found for token in pattern.findall(r[4])
    ))
    for row in found:
        print(*row, sep='\t')
PY
```

共通JSONは同じ再帰抽出に加え、文字列配列・`sender`・`response`・`result`・`inner` を検索し、当該キャラと第1章の文脈を確認した。単純な出現数には「オレンジ」「私服」「余韻」「今のうち」なども含まれるので、不一致の件数として使用していない。

## 検証・残る判断

- 実施: Git root・必要ディレクトリ・`project.godot` 不在、Git Safety、hooks設定の読み取り確認、開始時の差分なし確認、Issue本文・開いているPRの実変更ファイル確認。編集先READMEに重複なし。
- 実施: 対象・補助JSON31本の構文読み取り成功、上記の検索と前後文脈・表示参照先の照合、READMEの差分・参照位置確認。再帰抽出をREADME掲載コードから実行し、235シーン・3,210フィールドの一致を確認。本文変更はない。
- 実施: `git diff --no-index --check /dev/null docs/qa/issue1178-ch1-pronoun-notation/README.md` に空白エラー出力なし（新規ファイルの差分による終了値1）。既存追跡ファイルとindexの差分なしを確認。
- 未実施: nodeのゲーム回帰テスト、ブラウザ再生・スクリーンショット、CI。文書だけの調査のためサーバーは起動していない。画面到達性や全分岐の実プレイ確認を完了したとは扱わない。
- 対象外: 時系列・日数・好感度・既読・進行、シーシャ知識の真偽と外部出典、保留Issue #768 / #736 / #563 / #489 / #627 / #471。N01は名称の照合のみで、現実の銘柄の性質を検証したものではない。
- 次の判断: 上表の一人称・表記候補の採否を司令塔へ返す。二次資料だけを根拠とするP01/P05/P06、営業/私生活のP03/N03、フルネームの大会例外、未収録銘柄N01は個別に判断する。X01は範囲外の参照元変更候補として分離する。
- 調査時点で `ch1_main.json`、`ch1_tournament.json`、`ch1_spots.json`、`remake_ch1.json` 等には未マージPRがあり、本報告はそれらの変更前の上記HEADに対するもの。修正へ進む際はマージ後の現物・行番号を再照合する。
- 保存状態: `git add --sparse docs/qa/issue1178-ch1-pronoun-notation/README.md` はGit管理領域の `index.lock` 作成時に `Read-only file system` で失敗した。stage・commitは未実施。権限変更・別経路への回避はせず、このREADMEを未追跡ファイルとして作業ツリーに残した。司令塔によるcommitが次の作業。
- push・PR作成・Issueコメントは今回の指示により行わない。commitメッセージ案: `docs: audit chapter 1 pronouns and notation for #1178`。
