# Claude引き継ぎ：好感度・公私の呼び名・最終交流イベント・専用ハガル

作成日：2026-10-03。オーナーがこのチャットの残作業をClaudeへ移管し、引き継ぎ文のmainへのマージを指示した。

## 現状と作業の基準

- 確認済みのmainは `9873a10073ec6443f10b8c71d1d9c2d2d97bff4e`。PR #172（回収PR #173を含む）はマージ済み。
- この引き継ぎでは文書だけを追加・更新する。下記の修正・新機能は調査と設計案までで、ゲーム実装にはまだ入っていない。完了扱いにしない。
- 着手時は `git fetch origin` 後の `origin/main` を確認し、新規作業はそこから始める。現在のローカル作業フォルダ、差分ファイル、outputs、以前の会話での「できた」は、mainに入った証拠にしない。
- 今の開発対象はリメイク版 `remake/`。台詞・キャラ・機材の正本は共有の `data/`。旧 `web/` の全面改修は含めず、共有データ変更による旧版の破損を避ける。みんとの結末は共有台詞と旧版の表示も確認する。
- 先に `docs/owner_requests.md`、`remake/README.md`、`docs/master_spec.md` の該当項目を読む。古い仕様と下記の新しいオーナー指示が衝突する場合は、今回の指示を優先する。

## 今回のオーナー指示と優先度

監査で挙げた「気になった点」の番号と指示は以下の対応。番号を別の課題へ読み替えない。

| 番号 | 指摘 | オーナー指示／今回の扱い |
|---|---|---|
| 1 | 通常好感度を15%減らす式が、小さい報酬で従来より増える場合がある | 「バランスをとって」。小報酬でも増加の逆転を直し、通常は従来比約15%緩やか、恋人後の絆は従来比半分という意図を保つ |
| 2 | 私的なみんとの呼び名と、結末の口調・衣装が揃っていない | 「マストで治す」。本名開示、公私の文脈、台詞、名前欄、履歴、LIMEを横断して直す |
| 3 | リメイクの進行は第1章のみ。第2章以降・世界大会後の結末へ未接続 | 「まだいいや」。今回の依頼で章を増やしたり結末への進行を解禁したりしない |
| 4 | かふかの身長が162cmで定義されている | 「身長156に変えて」。156cmへ変更。年齢20の変更指示はない |
| 5 | #172のmainへの取り込みが1親のコミットで、元のmerge方式指定と異なる | 「いったんいいや」。既存Git履歴を書き換えたり、マージをやり直したりしない |

### 好感度MAXのイベント

- 各キャラの最後の好感度イベントは、感動できる場面やオチを用意し、その人物との物語に一区切りをつける。
- ヒロインは、関係の育て方によって「付き合うか」のイベントへつながる。
- 最初の案は、好感度とは別の隠し恋愛値を好感度イベントの選択肢で育て、一定を上回ると告白可能にする方式。「適切な選択肢で口説く」「普段から友達っぽいと告白そもそも発生しない」が意図。
- **最後に追加された方針**：好感度を深める途中の固有イベントに、キャラごとの分岐の質問を入れ、その返答で恋愛／友情を分けてもよい。全員共通の質問を機械的に置かない。
- このチャットでは、キャラごとの途中の質問・選択肢を隠し恋愛値に反映し、恋愛方向の選択を重ねた相手だけMAXイベントから告白へ進む方針を提案済み。質問の数、出す好感度段階、具体的な数値・閾値は未確定。明示的なルート分岐を併用する設計も可。
- 友情ルートにも、そのキャラらしい物語の締めと同じ専用ハガルを用意する。恋愛を選ばないと物語や報酬を取り逃がす形にしない。
- 悩みへの配慮、作品の肯定、お礼、訪問回数、好感度、贈り物だけを恋愛意思と扱わない。個人として二人で会いたい、恋愛的に関わりたいという選択を分ける。

### 各キャラからの専用ハガル

- 最後にそれぞれからプレゼントを受け取る。渡す理由は友情の証、お礼、贈り物など、その人物に合わせる。
- 例：**「みんとが育てたミント専用ハガル」**。そのキャラの得意フレーバーの香りが染み付いた、使い込んだハガル。
- 売却不可。名前や説明だけでなく、売却処理でも拒否する。
- 対応する特定フレーバーを使う時に少し有利になる。対象外にも一律の大きな強化を与えない。
- 一度だけ授与し、所持・装備選択・制作効果・保存／ロードまでつなぐ。自動で装備を差し替える必要はない。
- 効果量・配合条件は未確定。香りや制作の小さな補助を想定し、通常装備と比べてバランスを確認して決める。

## 既存コードの接続先と注意

### 1. 好感度の速度

`remake/js/core/stats.js` の `gainAffinity()` が対象。

- 通常の現行式は `pts * mult * 0.85 + affinityCarry` を切り捨て、端数を持ち越す。
- 従来式は加算ごとに `Math.round(pts * mult)`。魅力100・1ポイントの報酬を100回加えると、従来100に対して現行102となる。2ポイント100回も従来200に対して204。一方、10ポイント10回は120から102へ減る。
- 修正案：従来の `Math.round(pts * mult)` に0.85を掛け、その後で端数を持ち越す。小報酬を無駄にせず、従来の報酬に対する減速を保てる。これは実装案で、オーナー固定の式ではない。
- 恋人側は既に `Math.round(pts * mult) * 0.5 + loveCarry`。私的な交流の時だけ絆が増える `bond.private` の条件を保つ。
- 既存の好感度、絆、端数を取り消さない。魅力の全段階、占い倍率、小さい加算、連続加算、保存／ロードで確認する。

### 2. みんとの公私の統一（必須）

- `remake/js/core/data.js` の `displayName()` は現在、公私の文脈と `_minto_name_known` を使わず、みんとの短い名前を返す。
- 名前を実際に聞いた後の私的な場面は「栞」（呼びかけは「栞さん」など既存台詞に合わせる）、営業中の店舗では「みんと」。文脈を明示的に渡す方式が候補。
- `_minto_identity_revealed` と `_minto_name_known` を同じ意味にしない。名前を聞く前に本名を表示しない。
- `speaker: oneesan` は名乗る前の「お姉さん」のエイリアス。私服の `ura_*` を見ただけで正体・本名を開示しない。
- 一方、`outing_minto_1` は「みんと」と約束して会う場面。名前未開示の `speaker: minto` を私服という理由だけで「お姉さん」へ置き換えない。
- `remake/js/vn/engine.js` の `showLine()` は名前欄とログで `displayName()` を呼ぶ。LIMEの `daily/phone.js`、恋愛場面の `daily/romance.js` も確認する。
- `data/dialogue/ending.json` の `epilogue_minto` に通常の `smile` と接客調の♡が残る。私的な場面に合わせて `ura_*`、素の落ち着いた口調と呼び名へ統一する。「彼女の彼女」の重複もある。
- `ch1_minto_fifth`、`ch1_minto_private_1`、`outing_minto_1`、`confession_minto`、`confession_minto_accept`、`lover_minto_lv*` と新しいMAXイベントを横断する。
- `ch1_minto_phantom_smell` は営業終了後の場面。場所が店内という理由だけで営業中の顔・口調に決めず、場面の意図を確認する。
- `data/characters.json` の `appearance_rules.private_date` に「恋人ルート確定後のデートのみ」という古い説明がある。恋人になる前の私服の約束とも整合させる。
- 共有結末を旧版で表示した時の `web/js/engine.js` の名前解決、`web/js/game.js` の `displayName()`／会話コンテキストにも必要な対応を確認する。共有データ変更時は `python3 web/build_data.py` でバンドルへ反映する。

### 3. かふかの身長

`data/dialogue/kafuka.json` の `profile.height_cm: 162` を156へ。初回の名乗りを前倒ししたり、恋愛を突然解禁したりしない。画像の作り直しは今回依頼されていない。

### 4. MAXイベント・途中の恋愛分岐

- `remake/js/core/stats.js` の `gainAffinity()` は今、MAXになった `ROMANCEABLE` を無条件に `_confession_due` へ予約する。
- `remake/js/daily/romance.js` の `maybeConfession()`、`onDialogueEnter()`、`becomeLovers()` と `daily/calendar.js` の `endDay()` が接続先。告白の台詞は `data/dialogue/confession.json`。
- 新しいルート条件を、予約時と再生時の両方で確認する。旧セーブに残る `_confession_due` だけで告白を発生させない。
- 台詞の選択は `remake/js/vn/engine.js` の `pickChoice()` と `chapters/ch1.js` の `setupHooks()`／`hooks.onChoice` で拾える。選択に安定したIDを付け、同じ会話の再生で恋愛値を何度も稼がせない。
- 固有会話の順番は `daily/spots.js` の `VISIT_SEQ`。MAXだけを理由に前半の固有会話を飛ばさない。MAXイベント、贈り物、必要に応じた告白を順序立てる。
- 私的な誘いは定休日か営業後という既存オーナー条件を維持する。昼の行動から急に閉店後の告白へ飛ばさない。予約・固定イベントと重なる時は後に回す。
- 状態の追加は `remake/js/core/state.js`（現行SCHEMA 7）の移行処理へまとめる。候補は、隠し恋愛値、恋愛選択の既読ID、MAXイベントの既読記録。所持ハガルは既存 `owned` を使用できる。
- 古い好感度や訪問回数から恋愛的な選択をしたことにしない。既存の恋人関係は維持する。旧MAXセーブへの追加イベントは、実際に読んだ時に既読・授与を確定する。

### 5. ハガルの機材接続

- `data/equipment.json` に既に `suyaki_minto`、`suyaki_adam`、`suyaki_naru` がある。容量20g、`chapter_min: 99`、売値2500の未接続定義。重複IDを新設せず、既存定義の再利用を検討する。
- 贈り主、対象フレーバー、売却不可、非売品、素焼き画像の情報をデータで定義する。既存容量20gも踏まえて性能を調整する。
- `remake/js/daily/shop.js` の `equipRows`／`sellRows`：販売一覧から非売品を除外し、売却処理側にも不可の確認を入れる。
- `remake/js/craft/steps.js` の `stepSetup()` は所持機材から選択できる。`daily/status.js` の `itemsTab()` に贈り主、染み付いた香り、売却不可を表示する。
- `remake/js/craft/art.js` の `buildRig()` は現在、未登録ボウルIDをシリコンの絵で代用する。贈呈ハガルは素焼きとして描く。
- `remake/js/craft/score.js` の `computeShisha()`／`finalize()` 等に対象フレーバーの小さな効果を接続する。制作中の機材スナップショット `cs.equip` を使い、所持条件と得点上限を確認する。
- 旧版の共有機材参照への影響も確認する。旧版に贈呈の導線を実装する場合は `web/js/game.js` の売却、`craftScore()`、所持品表示を同じ契約にそろえる。名前・説明だけで完了としない。

## キャラ別の分岐・締めの案（台詞確定ではない）

以下はこのチャットの調査から作った方向案。キャラの既存の口調・背景・会話順序を読み、完成台詞として書き直す。特に、仕事での顔と私生活の顔のどちらも本人として描く。

| 人物 | 恋愛／友情の質問・関係の締めの方向 | 既存設定から確認できる香り |
|---|---|---|
| スミ | 閉店後、今度ははじめがスミに一台を作る。手になじんだ道具を託す。厳しい口調の後の小さな冗談 | カルダモン・クラシックスパイス |
| なる | 教わる側から互いの煙を確かめる友人へ。「次はお前の煙を吸わせろ」という約束 | バニラ・激甘お菓子系 |
| アダム | 大仰な継承の言葉から、内側に染みた年月と細かな手入れのメモに着地するオチ | ダブルアップル |
| つむぎ | 途中の質問は、絵がない日にも彼女と会いたいか。最後は完成した絵を最初に見せ、持ち帰れる香りを渡す | ラベンダー・フローラル／お茶 |
| みんと | 途中の質問は、仕事を離れた栞とどんな関係でいたいか。私服で、隠さず一緒にいられる一区切り。幻臭を即座に治す話にはしない | ミント |
| 凛 | 途中の質問は、仕事や試作の口実がなくても二人で会いたいか。最後のハガルは試験品ではなく個人からのプレゼント | ブルーベリー |
| アゲハ | 遊ぶ仲から普段の時間も一緒に過ごしたいか。体調を救うことを交際条件にせず、店を回す仲間への感謝で締める | ホワイト／レッドグミベア、トロピカル系 |

### 「どのキャラ」の対象と後続章

- オーナーの要望は各キャラ。現在好感度の交流導線があるキャラ全員を確認する。主人公、エイリアス、一般客を新規攻略対象にする依頼ではない。
- リメイクの通常交流は章1の `sumi / tsumugi / naru / adam / minto / rin`。恋愛対象の現行定義は `tsumugi / minto / rin / ageha`。
- 旧版 `web/js/game.js` の `CHAR_STAT` は後続章を含む18名。章2：`ageha / kumicho / rei / dr_kemuri`、章3：`mashiro / mukai_master / nandi / steve / volk`、章4：`master_hookah / sheikh / da_silva`。章1の6名に加えた一覧として取り漏れを確認する。
- 第2章以降のリメイク進行への接続は保留。後続キャラのイベントや贈り物のデータを用意する場合も、現在の章制限を維持し、「データ準備」と「通常プレイで到達できる」を区別して報告する。
- かふかは別overlay。章1の出会いと章2以降の店の設定があり、現在 `romance_available: false`。身長変更だけを理由に恋愛解禁しない。将来のMAXイベントはコロちゃんの「王の褒美」から本人のお礼へ着地する案がある。
- **未決定の香りを勝手に確定しない**：かふかは `favorite_flavor / specialty_flavor` がnull。スティーブのMountain Fog、ナンディのパンラースナ、ましろ・ヴォルクのシガー／ダークリーフ系など、現行フレーバーIDと一致しない設定がある。既存正本と予定フレーバーを確認し、未整備・判断待ちを明示する。

## 今回は保留・別担当

- 第2章以降のリメイク進行、世界大会後の「空」を入れた結末への接続（指摘3）。結末の台詞はmainに存在するが、通常プレイの到達まで完了していない。
- #172の取り込み方式・既存Git履歴の修復（指摘5）。今後のPRはmerge commitを使い、squashしない。
- 背景19枚＋透過台7枚は **未回収・後日オーナーがアップロード**。現在の古い背景や空のscenePropsを新しい26枚の回収済み証拠にしない。回収済みのSHISHARK背景2種＋かふか4表情（PNG6＋WebP6）は別件。
- 26枚の過去の書き出し先は `/workspace/scratch/c21ba4556c00/handoff_export/shisha-game-ch1-handoff-2026-10-01.tar.gz`、Work Library ID `libfile_709964203b008191bd2a432a287bbbe8`。これは履歴で確認した所在であり、現時点の実ファイル存在・取得可否は未確認。MacのDownloads等では対象アーカイブを確認できていない。
- 7/16のシーシャ作りパート修正、元フォルダの未コミット変更、stash、他の未マージブランチを今回へ混ぜない。
- 日常ループのアイデア、哲学書のアイデア提案、別枝の街歩きプロトタイプは、これだけを理由に本編へ実装・マージしない。

## Gitの安全確認と実装場所

- 正規リポジトリ：`/Users/hasegawaatsuki/Documents/New project/shisha-game`。origin：`haseatsu114514-dot/shisha-game`。
- 正規フォルダには多数の未コミット変更が残り、作業枝は `codex/making-workbench-assets`。未コミット内容を巻き込まない。フォルダ・stash・`../shisha-recover` を削除しない。
- `project.godot` は2026-06-15のオーナー指定で削除済み。無いのが正しい状態で、その確認を要求する古い一行は今回の過去の回収作業では明示的に適用外にされた。
- 正規フォルダのroot、origin、`./tools/check_git_safety.sh` の `OK: git safety checks passed` を確認する。WARNは可、予期しないERRORや権限停止は報告して停止する。hooksやcanonicalRootの設定を勝手に変えない。
- `shisha-recover` は正規リポジトリのworktreeで、古い複製ではない。ただし以前の例外は回収枝向けだった。新しい実装枝にも `--no-verify` を使えると自動的に解釈しない。
- 過去の例外：`shisha-recover` 内だけcommit/pushの `--no-verify` を許可し、push前に毎回、枝 `codex/recover-local-work`、common-dir `/Users/hasegawaatsuki/Documents/New project/shisha-game/.git`、`git merge-base HEAD origin/main` の成功、push先 `origin codex/recover-local-work` を確認するものだった。
- 今回の実装については、既存worktreeでorigin/mainから新しい枝を作り、例外を適用してよいか確認を送ったが、回答は得ていない。その後オーナーがゲーム実装をClaudeへ移管した。作業場所の例外が必要なら、既存の許可範囲を確認する。
- mainへの直接push、force、unrelated histories、squash、権限で止まった操作の別手段での回避は禁止。新しい作業はorigin/main起点、PRで反映する。

## 完了確認と報告

1. 通常の小報酬を含む好感度速度と恋人の半分処理を検証。占い・魅力倍率・端数・保存も確認。
2. みんとの名前を知る前／後、営業中／私的場面、名前欄／ログ／LIME、私服の表情、告白と結末の口調を確認。かふかの身長は156cm。
3. 同程度に好感度MAXへ進んだ友情ルートでは告白なし、恋愛方向に選択したルートだけ告白あり。途中の質問を再生しても恋愛値が重複しない。
4. 両ルートで物語の締めとプレゼントを受け取れる。イベント・授与は一度きり。元から恋人の旧セーブ、非恋人MAXの旧セーブの互換を確認。
5. 専用ハガルは売却不可、所持品に残り、制作で選択でき、素焼きの絵で出る。対応する配合だけ小さく有利になり、対象外・未所持・装備していない時に効果が出ない。
6. `python3 tools/lint_dialogue.py` はERROR 0。必要なデータビルドを行い、変更に関係する回帰テストと通しプレイを実施する。

既存テストの確認先：

```sh
python3 web/build_data.py
python3 tools/lint_dialogue.py
# 別ターミナルで正しい作業枝のルートを公開する
python3 -m http.server 8123
# 以下は1本ずつ
node remake/test/playthrough.mjs
node remake/test/relationship_memories.mjs
node --experimental-vm-modules remake/test/data_loading.mjs
node --experimental-vm-modules remake/test/daily_consistency.mjs
node --experimental-vm-modules remake/test/foil_holes.mjs
node --experimental-vm-modules remake/test/kafuka_story.mjs
node --experimental-vm-modules remake/test/lime_consistency.mjs
node web/test/playthrough.mjs
node web/test/ch2.mjs
node web/test/screenshots.mjs
node web/test/relationship_memories.mjs
```

- この文書作成時はゲームを変更していないため、ゲームのテストを再実行していない。以前のmain監査ではVMの `data_loading / daily_consistency / foil_holes / kafuka_story / lime_consistency` はPASS、ブラウザ通しテストや実機の今回の新機能は未検証。
- 当Macの通常Node環境では `playwright` と `/opt/node22/lib/node_modules/playwright` が見つからなかった。テスト依存を確認し、未実行をPASS扱いにしない。8123のサーバーが古いworktreeを公開していないか確認する。
- 完了報告では、実装した項目・保留した項目と理由、テスト結果、PR URL、mainへのマージ結果を記載する。データだけの準備、ローカル実装、GitHub main、公開Pagesを分ける。
