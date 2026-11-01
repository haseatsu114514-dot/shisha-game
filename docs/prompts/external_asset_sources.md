# 外部ゲーム素材サイト集（2026-10-09）

対象：『水煙前線 -EN:CODE-』の将来の背景、ドット絵、UI、効果音（SE）、環境音、BGM、アニメーション、制作補助。
このファイルは「探す場所」のブックマークであり、**素材の採用許可や使用ライセンスの確定ではない**。各素材を使う直前に原文規約を確認する。

## 最初に：このゲームに適した探し方

- **現行版は HTML / JavaScript の remake/**。Godot版は削除済み。基本は PNG / WebP / SVG / WAV / MP3 / OGG / WebM など、Webゲームから扱えるデータを探す。専用エンジンのプラグイン・プロジェクトは原則そのまま流用しない。
- **キャラとシーシャ機材の正規設定を優先**。既存ヒロインを汎用キャラ素材に置き換えない。機材画像は AGENTS.md が指定する実物写真・構造・ホース接続チェックを優先し、市販素材は主に背景・環境・UI・小物・演出へ利用する。
- **音は「毎回聞く軽い音」「作業結果の手応え」「店の環境音」を別々に探す**。常時鳴らす音は目立たせすぎず、ゲームの雰囲気を守る。
- 他人の素材の利用規約はサイト単位でなく**個別の配布ページ・ファイル**で決まることがある。無料でも商用不可・クレジット必須・改変不可・再配布禁止などがある。
- 商用配布、ブラウザでの公開、GitHubのプライベート保存、AI処理・学習、将来の素材差し替えはそれぞれ別の論点。**「商用OK」だけではGitHubへの元ファイル丸ごと再配布やAI学習が許されたことにはならない**。

## 今後の採用方針（オーナー要望・2026-10-09）

- **無料のフリー素材を優先**して採用する。有料素材は原則購入しない（必要なら個別に提案し、オーナーの了承を取る）。
- 「無料」のうえに **商用ゲームへの利用・ブラウザ公開・必要なファイル同梱が認められていること**を確認する。無料＝著作権フリー／クレジット不要ではない。
- **CC0や商用利用可能な配布物**を優先。作者名表示が必要な CC BY 等も、適切なゲーム内クレジットが可能なら候補として残す。CC BY-NC等の非商用限定素材は採用しない。
- **配布ページのURL・作者・ライセンス・確認日・クレジット要件を必ず記録**。商用ゲーム利用可能でも素材単独の再配布禁止なら、GitHubへの元ファイル登録は別途条件を確認する。私有リポジトリでも自動的に許可されるわけではない。
- この一覧は**サイトのブックマークとして保持**する。外部サイトの素材本体を無差別にまとめて取り込まず、ゲームで実際に必要なものだけを確認・選定して導入する。

## 優先度 A：すぐ探すならこのサイト

| サイト | 分野 | このゲームでの第一候補 | ライセンス目安・注意 |
|---|---|---|---|
| [Kenney](https://kenney.nl/assets) | UI/アイコン/2D/効果音等 | ボタン、スロット演出、共通UI | 同サイトのアセットページ掲載品は概ね CC0・帰属表示不要。各パックのライセンスを保持。[公式FAQ](https://kenney.nl/support) |
| [ぴぽや倉庫](https://pipoya.net/sozai/) | 日本・ドット絵/マップチップ/エフェクト | 街歩き、ミニゲーム、小物 | 無料配布素材は商用利用可・原則クレジット任意。個別条件と有料版は別途確認。[規約](https://pipoya.net/sozai/terms-of-use/) |
| [みんちりえ](https://min-chi.material.jp/) | 日本・背景イラスト | 店の外観・室内・街の会話背景の参考/採用候補 | ゲーム・商用利用を案内。**素材ページ個別規約**を読む。[説明](https://min-chi.material.jp/about/) |
| [効果音ラボ](https://soundeffect-lab.info/) | 日本・効果音 | ボタン、物を置く、布・扉・生活音 | 商用無料・原則クレジット不要。音源単独や「効果音が主目的」のコンテンツ等の再配布は不可。[規約](https://soundeffect-lab.info/agreement/) |
| [OtoLogic](https://otologic.jp/) | 日本・効果音/ジングル/BGM | 決定・キャンセル、UI、店内雑音 | 基本 CC BY 4.0。無料利用には**OtoLogic のクレジット表記**が必要。[規約](https://otologic.jp/free/license.html) |
| [Freesound](https://freesound.org/) | 実録・環境音 | 水泡、炭、空調、雨、カフェのざわめき | 投稿音源ごとに CC0 / CC BY / CC BY-NC 等。**商用想定なら BY-NC を避ける**。[FAQ](https://freesound.org/help/faq/) |
| [itch.io — Game Assets](https://itch.io/game-assets) | 国内外クリエイターの有料/無料素材 | 夜の街、店内タイル、人物、アニメ/パーティクル | **商品ごとに別規約**。無料だから二次配布可ではない。[内装＋Pixel Art＋Tileset検索](https://itch.io/game-assets/tag-interior/tag-pixel-art/tag-tileset) |
| [BOOTH](https://booth.pm/ja) | 日本の創作素材マーケット | 日本らしい背景、UI、フォント、音素材 | **商品ごとに作者の利用条件を確認**。再配布・改変・成人向け・商用等の可否がばらばら。 |

## 2D/ドット絵/背景の追加候補

| サイト | 用途 | 確認メモ |
|---|---|---|
| [OpenGameArt](https://opengameart.org/) | ドット絵・背景・アニメ・SE・BGMを横断検索 | CC0 / CC BY / GPL / OGA-BY 等が混在。素材詳細と作者表示要否を確認。CC0以外は慎重に。 |
| [ドット絵世界](https://yms.main.jp/) | 日本のマップチップ、RPG風タイル、キャラクター | 一部を除き制作ツールを問わず使えると案内。RPGツクール等の権利が混ざる素材は要確認。 |
| [DOT ILLUST](https://dot-illust.net/) | 日本のかわいい小物/人物アイコン | 商用利用には点数制限等の規定あり。大量採用前に規約確認。 |
| [DOTOWN](https://dotown.maeda-design-room.net/) | 大きめのポップなドット絵イラスト | 配布条件とゲーム内同梱の可否を個別に確認。サイズ感・色数の統一にも注意。 |
| [LimeZu on itch.io](https://limezu.itch.io/) | 店舗・街・屋内のドット絵タイルセット | タイルサイズ、商用条件、作者表示、使用範囲を購入/取得した商品単位で確認。 |
| [Pixel Frog on itch.io](https://pixelfrog-assets.itch.io/) | ドット絵キャラ・アニメ・エフェクト | アクション演出やエフェクト参考。作品別条件、既存画風との相性を確認。 |
| [CraftPix](https://craftpix.net/) | 2D背景、UI、スプライト、タイル | 無料と有料のライセンスが異なり得る。素材ごとに使用条件を確認。 |
| [ぴぽやリンク](https://pipoya.net/link/) | 日本のゲーム素材リンク集 | リンク先それぞれの規約を読む。ツクールのRTP改変素材・FSM改変素材は元規約の制限に注意。[注意](https://pipoya.net/link/?page_id=105) |

## UI/アイコン/フォント

| サイト | 用途 | ライセンス目安・注意 |
|---|---|---|
| [Game-icons.net](https://game-icons.net/) | 状態異常、ステータス、道具、評価記号 | 多くは CC BY 3.0。**作者名を含むクレジットが必要**。一部 Public Domain。[公式](https://game-icons.net/about.html) |
| [Lucide](https://lucide.dev/icons/) | シンプルな線画SVGアイコン、設定・メニュー | 原則ISC、Feather由来アイコンにはMITの条件も記載。著作権・許諾表示の保持条件を確認。[規約](https://lucide.dev/license) |
| [Material Symbols](https://fonts.google.com/icons) | ボタン/音量/戻る/設定などのWeb UI | Googleの公式アイコンは Apache-2.0。使用パッケージの条件に従う。[原文案内](https://github.com/google/material-design-icons) |
| [Google Fonts](https://fonts.google.com/) | UI・見出し・日本語フォント | フォントごとのライセンス・再配布/同梱条件・文字の表示品質を確認。 |

## 効果音（SE）・環境音

| サイト | 得意な用途 | ライセンス目安・注意 |
|---|---|---|
| [Sonniss — GameAudioGDC](https://sonniss.com/gameaudiogdc/) | 実録・映画品質の環境音、ドア、金属、機械、衣擦れ | GDC無料バンドルはゲーム内の商用利用可・クレジット不要を明示。素材単独再配布とAI/ML学習は禁止。[ライセンス](https://sonniss.com/gdc-bundle-license/) |
| [Pixabay — Sound Effects](https://pixabay.com/sound-effects/) | 生活音・UI音・環境音 | Pixabay規約と音源個別の扱いを取得時に確認。音楽・効果音のコンテンツ認識/権利申立てにも注意。 |
| [Mixkit — Sound Effects](https://mixkit.co/free-sound-effects/) | UI、生活、シネマティックな短い効果音 | **効果音のFree Licenseはゲーム利用可**。素材単独の再配布は禁止。[SEの規約](https://mixkit.co/license/modal/sfxFree/) ※同サイトの**Stock Music Free Licenseはゲーム利用不可**。[音楽の規約](https://mixkit.co/license/modal/musicFree/) |
| [Kenney — Audio](https://kenney.nl/assets/category:Audio) | UIクリック、ゲームらしいフィードバック音 | 先にパックを選んで、その配布ページに記されたライセンスを保存。 |
| [イワシロ音楽素材](https://iwashiro-sounds.work/) | 8bit・チップチューン系BGM/SE | サイト案内は商用可・クレジット任意。採用する曲ごとに利用条件を再確認。 |
| [sfxr](https://www.drpetter.se/project_sfxr.html) | レトロゲーム風の決定・失敗・抽選音を自作 | 「素材サイト」ではなく音の生成ツール。生成音声の権利・配布条件を利用前に確認。 |
| [ChipTone](https://sfbgames.itch.io/chiptone) | レトロ・電子音の作成 | ツール。ダウンロード時に提供元と生成物の利用条件を確認。 |

### シーシャゲームで探す音と検索語の例

| 場面 | 日本語検索 | 英語検索 |
|---|---|---|
| 店のドア開閉 | ドアベル / 引き戸 / ドアが閉まる | shop door bell / door open close |
| シーシャの水泡 | 水の泡 / ぶくぶく / 気泡 | bubbling water / water bubbles / hookah bubbling |
| シーシャ炭の操作 | 炭の燃える音 / 金属トング / 小さな金属音 | charcoal crackle / metal tongs / metal clink |
| ボウルとホイル | アルミホイル / 軽い擦れ / 手作業 | foil crinkle / rustle / ceramic touch |
| 店内環境 | カフェ 雑踏 / 空調 / 小声 | cafe ambience / quiet crowd / air conditioner |
| 街の移動 | 夜の街 / 雨 / 足音 | night city ambience / footsteps / rain street |
| ミニゲーム | 決定 / 失敗 / コンボ / 大成功 | ui select / fail / combo / success stinger |
| 大会 | 控室 / 拍手 / カウントダウン | crowd murmur / applause / countdown |
| パチスロ風ミニゲーム | リール / 停止 / 払い出し / 告知 | reel stop / slot click / jackpot / notification |

**重要：** 水泡や吸う音は実物のシーシャらしさを確認して選ぶ。換気扇・熱湯・ストロー等の似た音をそのまま「シーシャ音」と決めつけない。特定のパチスロ機種の実機サウンドや既存ゲームのSEを無断流用しない。録音に人物の会話が含まれる場合はプライバシー/肖像・録音権利等にも注意。

## BGM・ジングル

| サイト | 作品内での想定 | ライセンス目安・注意 |
|---|---|---|
| [OpenTracks（旧DOVA-SYNDROME）](https://opentracks.com/) | 街歩き、会話、店内の普段使い | 商用ゲームの背景BGM利用可・通常クレジット不要。ただし**作曲者の追加条件が優先される場合**あり。[ライセンス](https://opentracks.com/help/articles/license/)、[ゲーム利用FAQ](https://opentracks.com/help/articles/license-usage/) |
| [魔王魂](https://maou.audio/) | 大会、大成功、感情の山場 | 商用利用可・改変可。曲単独の配布や作者詐称は禁止。[規約](https://maou.audio/rule/) |
| [PeriTune](https://peritune.com/) | 幻想的な場面、夜の街、緊張、物語イベント | 商用ゲーム利用可・クレジット任意。**2026-03以降の新曲は独自規約、旧曲は原則CC BY 4.0**。[改定案内](https://peritune.com/blog/2026/03/01/terms-update/)、[現行規約](https://peritune.com/about/) |
| [MusMus](https://musmus.main.jp/) | 温かい日常、穏やかな店内、コミカルな場面 | 商用ゲーム利用可だが**著作権表示が無料使用条件**。[規約](https://musmus.main.jp/info.html) |
| [Audiostock](https://audiostock.jp/) | 専用感の高いBGM・SEを有料購入したいとき | 購入するライセンスの使用範囲・ゲーム配布方法を確認。 |
| [itch.io — Music](https://itch.io/game-assets/tag-music) | インディーゲーム向けループBGM、8bit/Lo-fi | 各作者の個別条件と、リリース版に同梱できるかを確認。 |

関連する既存の制作指示：docs/prompts/bgm_suno_prompts.md には過去のBGM発注プロンプトがある。ただし古いweb/版への配線指示を含むので、**最新版remake/の実装にはそのまま適用しない**。

## ドット絵パレット / 制作ツール（素材とは別）

| サイト | 用途 | メモ |
|---|---|---|
| [Lospec](https://lospec.com/) / [Palette List](https://lospec.com/palette-list) | ドット絵の色数・色味の統一 | パレット作者・個別の利用条件がある場合は従う。 |
| [Piskel](https://www.piskelapp.com/) | ブラウザ上のドット絵・スプライト編集 | アニメーションの試作に便利。 |
| [Aseprite](https://www.aseprite.org/) | 本格的なドット絵・アニメ編集 | 制作ツール。ゲームに組み込む素材は自作か権利確認済みを使う。 |
| [Tiled](https://www.mapeditor.org/) | 街や室内のタイルマップ編集 | タイル画像は別途用意が必要。 |
| [LDtk](https://ldtk.io/) | 2Dレベルデザイン | 直接のゲームプラグインではなく地図設計用。 |

## 3D・将来の参考用：今は低優先

| サイト | 使いどころ | 注意 |
|---|---|---|
| [Mixamo](https://www.mixamo.com/) | 将来3Dキャラ化、リギング・動作の参考 | 3Dキャラ/アニメ用。現在のブラウザ2D実装にそのまま追加するものではない。利用規約確認。 |
| [Poly Haven](https://polyhaven.com/) | 店内の素材感、金属/木/壁面の3Dテクスチャ・HDRI参考 | 素材自体は CC0。[公式](https://polyhaven.com/license) |
| [Quaternius](https://quaternius.com/) | ローポリ3D小物・街背景の参考 | **2026-08-28更新のQALが現行案内**。古いFAQにはCC0表記も残るので、取得日と個別素材ライセンスを確認。[規約](https://quaternius.com/license.html) |
| [Godot Asset Store / Asset Library](https://godotengine.org/asset-library/) | 別のGodot案件で使う拡張・サンプル | **本作のGodot版は削除済み**。2026年にAsset Storeも案内された。既存版の復活・プラグイン導入を勝手にしない。[公式のお知らせ](https://godotengine.org/article/introducing-the-godot-asset-store/) |

## 実際に「効果音をつけて」と頼まれたら（AIエージェント用）

1. まず CLAUDE.md / AGENTS.md と現行 remake/ の音再生コードを読む。削除済みのGodot版・旧web/版を復活させない。
2. SEを足したい**具体的な操作・画面・頻度**を洗い出す。優先順位は「UI決定/戻る → クラフト作業 → ミニゲーム採点 → 店内環境 → 大会演出」を基本とするが、ユーザーの指定を優先。
3. 本ガイドから2〜3サイトを検索し、**候補音をいくつか比較**する。安易に最初に見つけた音を使わない。自作録音・生成ツールも選択肢にする。
4. 実際に採用する**各音源の配布ページ、作者、ライセンス、商用利用、ゲーム内同梱、改変、クレジット、入手日、音の長さ・形式**を記録する。不明なら無断取り込みをせず、代案へ。
5. 音声を合法的に入手し、ライセンスが許す範囲で asset_sources/music/ にオリジナルを、使う最終データを assets/ の既存配置規則に従って入れる。**GitHubへの原音源コミット自体が再配布に当たる場合がある**ため、可否が不明なら原音源をコミットせず、使用条件・URLなどのメタデータだけ残して扱いを確認する。プライベートリポジトリだから無条件に再配布可とは考えない。
6. クリップ音の連打、音量ピーク、音切れ、BGMとの音量差、スマホSafari、Web Audioのユーザー操作制約などを確認する。ループSE/環境音はシームレスに、長尺のBGMは過剰ダウンロードを避ける。
7. 採用ファイルと合わせ、**クレジット台帳**を更新。音量/ミュート設定を尊重し、音が出せない状況でも操作結果が分かるUIを維持する。
8. 画像・音源の追加に伴う既存のアセットインデックスやマニフェスト更新手順を確認する。最新の main から作業ブランチ・PRを作り、レビュー・確認後にマージ。mainへの直接pushやforce pushはしない。

## 採用素材の記録テンプレート（1ファイル・1出典ずつ）

| 項目 | 記録内容 |
|---|---|
| 用途 / シーン | 例：シーシャ製作のトング接触音 |
| 元サイト / 元素材URL | 配布ページへの直接リンク（検索ページではなく） |
| 作者名 / 正式タイトル | クレジットに使う正確な表記 |
| ライセンス / 規約URL / 確認日 | 規約を確認した日を残す（可能なら当時の文面も保管） |
| 商用 / 改変 / 配布物への同梱 | それぞれOK / NG / 要確認 |
| GitHubへのソース保存 | OK / NG / 要確認（ゲーム同梱可とは分けて判定） |
| クレジット | 必須文面、ライセンスへのリンク、変更表示の要否 |
| 保管先 / 最終ファイル名 | asset_sources/music/・assets/ 以下の場所 |
| 長さ / 形式 / 音量 / ループ | 例：0.12s / WAV / -12dB / 無 |
| 使用位置 / 採用理由 | 操作名、バージョン、音質・世界観との相性 |

### 重要な判断ルール

- CC0：通常はクレジット不要。ただし商標・肖像・第三者権利まで自動で保証するものではない。
- CC BY：クレジット、ライセンスへのリンク、変更点表示などの要件を遵守する。
- CC BY-NC：将来の商用公開を考えて**採用しない**方針。
- GPL系やツクールRTP改変素材：利用条件・配布との適合判断が必要。安易に本体へ混入させない。
- 「商用OK」と「素材単独の再配布OK」は別。ゲームへの組み込み・ブラウザ配信・GitHub保管方法を個別に判定する。
- 原文の更新や商品別条件をこのページの要約より常に優先する。

---
2026-10-09 時点のリンク集。**この段階で素材本体のダウンロードやゲームへの採用はしていない。** 新しい素材を採用したときは、その都度出典・ライセンス・採用理由をこのファイルか別の台帳に追記する。

## 2026-10-24 採用記録：青い会話ウインドウ比較用フォント

- **Zen Old Mincho Regular** — The Zen Old Mincho Project Authors。[公式配布TTF](https://github.com/google/fonts/blob/main/ofl/zenoldmincho/ZenOldMincho-Regular.ttf)、SIL Open Font License 1.1。商用利用・ゲーム同梱・GitHub再配布可、ライセンスを同梱。
- 保管先：`remake/fonts/ZenOldMincho-Blue-Regular.woff2`、ライセンス：`remake/fonts/OFL-ZenOldMincho.txt`。TTFからWOFF2へ可逆圧縮、文字マップと横幅メトリクスの一致を確認。
- 使用位置：R2「平成の青いADV」の名前・本文・操作文字（会話プレビュー専用）。青い光沢と銀縁へ明朝体を合わせるため採用。出典・元ファイルと同梱版のSHA-256は `asset_sources/ui/vn-smoke-11/retro-variants/blue-character-preview/generation.json`。
