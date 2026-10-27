# #1081 I02・I03 原因調査・未採用比較

調査基準: origin/main ed8098a9。AGENTSは取得mainとSHA256一致。Issue assigneesなし。Issueコメントに本件の作業提案はあるが生成開始の記録なし。open PR一覧・みんと関連PRを確認し、I02/I03の競合PRは見当たらない。既存worktreeは1つ、stash・HEADだけの未push commit・開始時の変更なし。既存checkout/cacheを再利用、選択した原画2件だけLFS回収。新clone・ログイン・権限変更なし。通信はクラウド内。

## 結論・推奨

- **新生成0枚**。まずコンカフェ通常を既存の斜め向きへ戻す候補を推奨する。`asset_sources/portraits/jawline-cleanup/minto-normal-before.png`。approved style-referencesにもこの画像が残る。私服は現状維持を第一候補とする。黒い線の好みを含む最終判断は本人比較待ち。
- 現行通常はPR #983（merge e91930cb）で採用された正面寄りv4。過去の「正面化不採用」はsmile v1の話で、smileは既に復元済み。normalは未復元。台帳の古い「公開未反映」記述はPRの公開成功記録より古い。今回normalを新たに不採用判断することと、過去smileの復元漏れは区別する。
- 黒線はPNG内の頬・顎の描線に含まれる。全10表情のPNGと配信用WebPはRGBA完全一致。WebP圧縮で黒線が増えた証拠なし。私服の元シートにも顎線があり、生成原画段階の線画と縮小での見え方が主な候補。透過境界だけの問題・古いURLだけの問題とする根拠はない。個別のプレイ版キャッシュの否定はできない。
- 私服の髪外周には微小な明色の点も見える。原画にも存在し、頬の黒線とは別。現段階で顔の再生成を必要とする破綻は確認できず、全線除去や自動マスク修正は推奨しない。

## 現在の接続

`remake/js/core/data.js:portraitInfo` が manifest.faces とspeaker/faceから同名素材を決定。`oneesan` はmintoへ別名解決しura_*、不在ならura_normal。mintoの省略faceはnormal。存在しない表情は近似またはnormal。正面通常は店での通常会話・face省略・fallback・通常立ち絵を使うintro等に現れる。台本の具体箇所は references.json（portrait:falseも区別）。動的JS呼出はこの一覧だけで網羅した扱いにしない。

- コンカフェ: normal / smile / sad / surprise / wink
- 私服: ura_normal / ura_smile / ura_sad / ura_surprise / ura_smug
- 元PNG: `assets/sprites/characters/minto/chr_minto_{face}.png`
- 表示WebP: `remake/img/sprites/characters/minto/chr_minto_{face}.webp`
- manifest: `remake/data/manifest.json`、顔アイコンは `assets/ui/face_icons/face_minto{,_private}.png`
- normalだけは `?v=face-line-20261026` 付与あり。manifest収録時WebP、未収録時PNG。
- 私服原画: `.claude/skills/character-portrait-remaster/references/minto-private-v1-sheet.png`（5体）。現コンカフェnormal原画: `asset_sources/portraits/minto-eye-jaw-review/normal-v4-source.png`。旧採用通常は上記before。旧desktop_backupは別デザインのシートで今回の元と取り違えない。

## 比較とQA

[index.html](index.html) は実画像付きローカル比較。全10表情＋旧通常の明暗背景、顔拡大、原寸リンク、全身縮小、6枚の実VN画面を収録。images.jsonに寸法・bbox・SHA・PNG/WebP一致を記録。全キャンバス896×1200、spriteScale=.91、manifest h=.7867,b=.02,ax=.5762。可視範囲は概ねy230〜1178で頭上・足元に透明余白を保持。

原寸顔・全身一覧・私服元シートを目視。髪/顔の縁、手、ニット/服の模様を比較し、通常顔の角度差以外に再生成必須と判断できる大きな破綻は認めなかった。細い黒線の審美的評価は残る。

ローカル実VNは1280×720、844×390でnormal/ura_normal/旧通常を制御台詞で表示。旧通常のみPlaywrightの一時route置換、本編ファイル無変更。頭上は切れず、顔・指は会話枠より上。下半身は通常仕様どおり会話枠の背面に入り、全身表示のQAはHTML合成で別確認。実台本を自然進行した記録・公開版/物理端末の確認ではない。明暗背景比較も合成であり実ゲーム背景確認とは区別する。runtime.jsonのpageerrorは全件空。

## 採用された場合の範囲（今回は未実施）

旧通常PNG、同名WebP、営業顔アイコンPNG/WebP、必要なアイコンcrop・manifest実測値、素材目録と採否記録、URLキャッシュrevisionを照合・更新。旧通常bboxと足元が現行と少し異なるため単純な同名置換で完了とせず、再計測して現行高さ・足元へ合わせる。他9表情は原則維持。タイトル絵/CG/章レイヤーは別素材であり自動的に差し替えない。本人が別の正面画像を見た場合は場面を特定して追加確認する。

既存原画・没案すべて保持。I02/I03は採用待ちとして未完了。新原画・新表示用候補は生成していない。
