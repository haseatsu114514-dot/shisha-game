# タイトル画面キービジュアル候補（Issue #1243・素材制作）

タイトル画面右側アート用の**専用キービジュアル候補**です。**候補・オーナー選定用の Draft PR で、採用前提ではありません。ゲーム本体の素材（remake/img・manifest・コード）は一切変更していません。**

## 対象キャラ（10人）の確定根拠
「好感度が存在するキャラ全員」を、最終章（第5章）までの資料で確定しました:
- 正式ヒロイン7人（`data/story_routes.json` の `heroine_ids`、恋人システム、第5章後エピローグ）: tsumugi / minto / rin / ageha / mashiro / samechan / hiyori
- 好感度MAX締めくくり（`remake/js/daily/bonds.js` の `BOND_FINALES`）の友情枠: sumi / naru / adam
- master_spec・setting_book・brand 正本で「第4章で新ヒロインは追加しない」「heroine_ids が唯一の名簿」を確認し、後半章での追加は無いことを裏取り済み（詳細は Issue #1243 のコメント）
- かこ・りら等のバイト先系／ちょい役はオーナー決定で対象外（裏好感度の論点は Issue 側で判断分離として報告済み）

## 制作方法（役割分担はオーナー指示）
- **シチュエーション＋生成プロンプト: Claude Opus**（effort medium）。設計正本は `prompts/` 内の各キャラファイル（共通スタイル指定つき抜粋）。既存タイトルアートの場面と重ならない切り口で、各キャラ5場面
- **画像生成: Codex A**（gpt-6.1-sol / medium）。各キャラの立ち絵（sprite）と既存タイトルアート（ある場合）を参照に、参照編集ベースで生成。全50枚 **1024×1536 PNG**
- 明らかな破綻がある場合は1回まで再生成（実績: minto 1件＝既存絵と構図が近かったため、rin 1件＝背面の装飾・ペンダント位置の修正、samechan 2件）。残った軽微な指定差分は `prompts/<キャラ>-report.md` に記録

## フォルダ構成
- `candidates/<キャラ>/title_art_<キャラ>_new<NN>_<場面>.png` … 原寸候補（50枚）
- `candidates/<キャラ>/title_art_<キャラ>_new<NN>_<場面>.webp` … ゲーム組込用 WebP 版（同50枚）
- `compare/<キャラ>_compare.jpg` … キャラごとの5枚比較シート（10枚）
- `prompts/<キャラ>.md` … Opus のプロンプト全文、`<キャラ>-report.md` … Codex の生成記録（方法・再生成・破綻・自己評価）

## 調整役のおすすめ（最終選定はオーナー）
| キャラ | おすすめ | 理由 | 次点 |
|---|---|---|---|
| sumi | 2. mentor_lesson | 至近でボウルを詰める手元と穏やかな笑顔。師匠の「一手」が一番伝わる | 1. morning_charcoal |
| naru | 1. pastry_oven | 焼きたてトレーと満面の笑み。お菓子研究者の彼の魅力が一枚で完結 | 2. watch_my_hands |
| adam | 4. sunset_proclamation | 夕日にりんごを掲げる芝居がかった宣言ポーズ。EDEN の主そのもの | 5. apple_juggle_grin |
| tsumugi | 2. painting_studio | イーゼルの前の画家としての彼女。共感覚の光る絵が唯一無二 | 4. first_snow |
| minto | 2. mint_cloud | ウインクとミント色の煙、コンカフェ衣装。みんとの看板として最強 | 3. melon_cream_soda |
| rin | 5. rainy_neon_umbrella | 雨とネオンの透明傘。大人の凛の映画的な一枚 | 1. sign_here |
| ageha | 2. gummy_light | グミを光にかざすウインク。バイブス全開の彼女らしさ | 1. morning_hands |
| mashiro | 5. scared_of_rumor | 煙を怖がる本人のギャップ（シガーマンの噂）。ましろにしかない一枚 | 1. sunny_nap |
| hiyori | 1. axe_night | 斧投げの躍動と素の笑顔。表の儚さとの二面性が映える | 4. earl_grey_tart |
| samechan | 3. shy_peek | コロちゃんに隠れる至近の素顔。人見知りのなぎさが覗く瞬間 | 1. smoke_ring |

## 次のステップ
オーナーが比較シート（または原寸）でキャラごとにベスト1枚を選定 → 採用分のみ別 PR で `remake/img/ui/title_arts/` へ反映し、表示側（#1243 本体実装）の対応表へ接続する。
