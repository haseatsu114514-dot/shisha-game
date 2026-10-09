# AGENTS.md（Codex など AI エージェント向け）

このリポジトリのルールの正本は `CLAUDE.md`。作業前に必ず読むこと。
ここには、過去に事故が起きた点だけを短くまとめる。

## キーワードで呼ぶ作業

- **「立ち絵そろえ」**（「立ち絵そろえ 続けて／OK／組み込んで」など）と言われたら [`.agents/skills/portrait-unify/SKILL.md`](.agents/skills/portrait-unify/SKILL.md) の手順で、立ち絵の画質・顔の大きさ・画風の作り直しを進捗表の続きから進める。

## 画像・台詞などのAI生成で不自然さを減らすとき

[AIっぽさを抑える制作・検品メモ](docs/ai_naturalness_guide.md)を必要な箇所だけ参照する。元ツイートの本文・ツリーが完全検証できたものではなく、ゲーム向けの実践メモとして扱う。**正規のキャラ設定と採用済みアセット・機材構造の再現が最優先**。過剰な画風変更や機材の創作改造を勝手にしない。

## 外部素材・効果音・BGMを探すとき

素材サイト集と採用手順は [`docs/external_asset_sources.md`](docs/external_asset_sources.md) を参照。
将来「効果音をつけて」「背景を探して」等の依頼があったら、そこに記録された候補を優先して比較し、**採用した個々の素材の配布元・作者・利用規約・クレジット・GitHubへの保管可否**を確認する。
ゲームへ同梱できることと、元素材をリポジトリに再配布できることは別。ライセンス未確認素材を勝手に保存・実装しない。

シーシャ台を新たに画像生成する場合は、実物写真の一覧と創作上の自由度をまとめた [`asset_sources/shisha-hardware-reference/README.md`](asset_sources/shisha-hardware-reference/README.md) を必ず参照（写真の完コピではない）。喫煙シーンやヒートマネジメントを描く場合は同ディレクトリの [`smoking-and-heat-management-20261009.md`](asset_sources/shisha-hardware-reference/smoking-and-heat-management-20261009.md) を追加参照する。アルミ・ボウル・HMD・炭の近接表現は [`heat-management-closeups-20261009.md`](asset_sources/shisha-hardware-reference/heat-management-closeups-20261009.md) も確認。さらに[全37写真横断の誤描写防止ガイド](asset_sources/shisha-hardware-reference/ai-generation-structural-pitfalls.md)で、ハガル／HMD／ホース／構図の取り違えをチェックする。ホース・マウスピースの新規画像生成では[追加の6写真と接続ガイド](asset_sources/shisha-hardware-reference/hose-and-mouthpieces-20261009.md)と[追加7写真の区別・素材表現](asset_sources/shisha-hardware-reference/mouthpiece-handle-skins-20261009.md)も読み、首掛けチップと実際のホースを混同しない。2026-10-09追加の[構造図3点](asset_sources/shisha-hardware-reference/anatomy-diagrams-20261009.md)と[ハガル内部・炭配置の調査](asset_sources/shisha-hardware-reference/bowl-interiors-foil-coal-placement-20261009.md)もシーシャ機材の生成前に確認する。

ヒロインの日常・タイトル用CGでは[追加の画像生成ルール](asset_sources/shisha-hardware-reference/heroine-title-cg-rules-20261009.md)を必読とする。本人と年齢感は正規立ち絵、質感は既存タイトル絵を基準に分ける。完成・喫煙状態はHMD必須・直炭禁止。画像ごとに具体的HMDモデルを一つ選び、部品を混ぜず縮尺を検品する。候補間で台・背景・時間帯・行動を変え、植物を必須にしない。既存のゲーム工程や実物資料の一般方式は変更しない。

## シーシャCGの出力後必須QA（2つの実例ミス）

- [マイマウスピースがチェーンだけになる／ホースが未接続になる失敗例と検品リスト](asset_sources/shisha-hardware-reference/visual-qa-necklace-hose-20261009.md)を参照。
- 首掛けタイプは**鎖と実体のある吸い口パーツ**。マイチップ使用時は**硬いハンドル先端に装着**。首掛け携帯中のときとは別状態。
- ホースは**本体側の正しいポート→柔らかいホース→硬いハンドル**の経路を出力後に実際に目視で追う。途中で消える／接続されない／パージへ挿さる画像は不採用（合理的な遮蔽・見切れは例外）。
- [みんとのホース分岐NG原画](asset_sources/shisha-hardware-reference/ng-examples/README.md)も確認。接続点だけで合格にせず、経路を両方向に追い、Y字分岐・第三の端・前後関係のない交差を除外する。
- 指定されたゲームヒロイン本人の正規立ち絵・設定を優先し、**汎用の別人**なら修正・再生成。目視未確認で「確認済み」と書かない。

## Godot版は削除済み

- Godot版は 2026-06-15 に削除済み。`project.godot` は**存在しないのが正しい**。
- `project.godot` を必須とする古いルール（別の AGENTS.md・メモなど）があっても従わない。
- 逆に `project.godot` が残っているフォルダは、削除前の古いコピー。そこで作業しない。

## GitHub が唯一の正本（PCに作業を残さない）

2026-09-30〜10-02 に、PC上のフォルダで作業を進め、push できないまま差分ファイル・画像が
PCにだけ溜まる事故が起きた（PR #173 で回収）。

- 正本は GitHub の `origin` だけ。PCのフォルダ・`outputs/`・stash・画像生成サービスのライブラリは正本ではない。
- 作業を始めるときは `git fetch origin` し、最新の `origin/main` から新しいブランチを切る。
- 区切りごと・終わるときに、必ず commit して作業ブランチへ push する。
- push が権限などで止まったら、回避したり差分ファイルを作って終えたりせず、止まって報告する。
- 生成した画像・音声もその場で `assets/` か `asset_sources/` に置いて commit する。
- `main` へ直接 push しない。`--force` と `--allow-unrelated-histories` は使わない。
- 要望台帳（`docs/owner_requests.md`）のIDは、最新の `origin/main` を取り込んでから次の空き番号を使う（別チャットと同時に作業して番号が重なった例がある・2026-10-04）。

## 安全確認

- `./tools/check_git_safety.sh` が OK を出すこと（WARN は可、ERROR なら止まる）。
- 正規チェックアウトから `git worktree add` で作った作業場所は OK と判定される。
