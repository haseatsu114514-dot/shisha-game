# CLAUDE.md — Claude Code の入口

@AGENTS.md

Claude Code でも Codex と同じ `AGENTS.md` を共通ルールの正本として使う。ゲーム仕様・制作資料は `AGENTS.md` のリンクから**作業に必要なものだけ**参照する。

`@AGENTS.md` を自動展開しないGitHub連携では、同じrefの `AGENTS.md` をファイル取得で読む。
CLI / GitHub連携のどちらも利用でき、予約と成功runの確認、差分保存、PRとCIの条件は共通。
CLIコマンドが使えない場合は `AGENTS.md` の「実行経路」と [予約手順書](docs/issue_claim_protocol.md) の連携経路に従う。
checkoutで作業する場合のローカル安全検査も `AGENTS.md` に従う。

- ゲーム・会話・世界観の詳細: `docs/gameplay_agent_reference.md`
- 画像・シーシャ機材・素材制作の詳細: `docs/asset_ai_guidance.md`
- 資料の正本と過去ログの扱い: `docs/current_documentation_guide.md`

過去の `CLAUDE.md` の詳細ルールは上記へ内容を移動した。Git安全ルールは `AGENTS.md` に一元化した。
