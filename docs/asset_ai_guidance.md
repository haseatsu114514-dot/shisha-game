# 画像・シーシャ機材・素材制作の詳細ルール

> 旧 `CLAUDE.md` と旧 `AGENTS.md` の制作指示を移設。関連する画像・素材作業でのみ読む。

## シーシャ台の画像生成リファレンス

**最初に[シーシャ描写の早見表とプロンプト用ルール](asset_sources/shisha-hardware-reference/drawing-sheet/README.md)を見る**（生成前の構成メモ・貼る文・生成後チェックを使う。早見表と構造図は仕組みの理解・検品用の資料で、**生成ツールには添付しない**。生成時は以下の資料の実物写真を見て添付する）。詳細・根拠は以下。シーシャ台が写る背景・CG・ゲーム素材を新規生成・修正するときは、オーナー提供の9種類の実物参考をまとめた [`asset_sources/shisha-hardware-reference/README.md`](asset_sources/shisha-hardware-reference/README.md) を最初に読む。**使用中の人物・ホース・煙・HMDや炭が写る素材**は追加の [`asset_sources/shisha-hardware-reference/smoking-and-heat-management-20261009.md`](asset_sources/shisha-hardware-reference/smoking-and-heat-management-20261009.md) も参照する。**ボウル・ホイル・炭・HMDの近接画**は [`asset_sources/shisha-hardware-reference/heat-management-closeups-20261009.md`](asset_sources/shisha-hardware-reference/heat-management-closeups-20261009.md) でアルミ直置きとHMDを区別して参照する。[今回追加の使用・アルミ・煙突の9写真](asset_sources/shisha-hardware-reference/usage-and-installation-20261009.md)と[37写真横断のAI誤描写防止ガイド](asset_sources/shisha-hardware-reference/ai-generation-structural-pitfalls.md)も必要な画像生成の前に読む。**ホース・マウスピース・人物の吸い方を描く場合**は、追加実物写真6枚と[ホースの接続・使い捨て/首掛けマイマウスピースのルール](asset_sources/shisha-hardware-reference/hose-and-mouthpieces-20261009.md)および[追加マウスピース3点・ハンドル4点／スキン方針](asset_sources/shisha-hardware-reference/mouthpiece-handle-skins-20261009.md)を必ず参照。**追加の構造図3点・呼称・空気の通路**は [`asset_sources/shisha-hardware-reference/anatomy-diagrams-20261009.md`](asset_sources/shisha-hardware-reference/anatomy-diagrams-20261009.md)、**ハガル内部の穴・穴あけ・炭配置と外部リサーチ**は [`asset_sources/shisha-hardware-reference/bowl-interiors-foil-coal-placement-20261009.md`](asset_sources/shisha-hardware-reference/bowl-interiors-foil-coal-placement-20261009.md) を参照する。実物の構造・素材感を参照し、機種・色・形状・装飾は自由に創作。**喫煙中・制作中のヒロインCGを生成したら、[首掛けマイマウスピース／ホースの必須検品](asset_sources/shisha-hardware-reference/visual-qa-necklace-hose-20261009.md)を実施する。** 首飾りはチェーンに加えて独立した吸い口本体が必要。ホースは本体の適切なポートから硬質ハンドルの根元まで物理的に続き、画像内で見える接続を途切れさせない（自然な見切れ・遮蔽は許容）。キャラは指定された正規立ち絵・プロフィールを最優先して汎用美少女への置換を避け、ミスが出た画像は再生成する。特定の製品・ロゴの完コピは禁止。シーシャ台を描かない指定を優先する。ボウル未装着の制作画面は従来の小さな凸型金属ポストを維持。

---

ヒロインの日常・タイトル用CGは[2026-10-09追加の生成ルール](asset_sources/shisha-hardware-reference/heroine-title-cg-rules-20261009.md)を必読とする。顔・年齢感・衣装は正規立ち絵、既存タイトル絵は質感の参照にする。完成・喫煙状態はHMDを使い直炭にしない。一枚ごとに具体モデルを選び、少量の色・仕上げ変更に留めて他モデルの部品を混ぜない。ハガル・HMD・炭・手の縮尺とホース接続を生成後に目視検品し、違反は修正・再生成。台・背景・場所・時間帯・行動は候補間で変え、背景植物を必須にしない。一般の実物資料や既存ゲーム工程・採点仕様への変更ではない。


---

# Codex固有だった画像・素材・制作スキル案内（旧AGENTS.mdより移動）

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

