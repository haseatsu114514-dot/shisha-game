# 第1章 実装ブループリント（Codex用）

このファイルは Codex CLI に「そのまま渡せる」第1章の作業設計図。
**Part 0（準備）→ Part A（タスク順）→ Part B（タスク1の貼り付け用プロンプト）** の順。
いま投げるのは **Part B のタスク1** だけでいい。

前提環境: Godot **4.6** / GDScript（タブインデント・`gdformat`整形）/ git安全ルールは `AGENTS.md` 準拠。

---

## Part 0. 最初の一度だけの準備

1. **引き継ぎ資料3部をリポジトリに入れる**（Codexが仕様として読めるように）
   - `HANDOFF_01〜03.md` を `docs/handoff/` に置いてコミット。
   - `CLAUDE.md` 末尾か `AGENTS.md` に1行追記:
     「設計の正典は `docs/handoff/` と `docs/minigame_implementation_plan.md`。キャラ名等の確定値は HANDOFF_01 §6 / HANDOFF_02 §14 に従う。」
2. **Codexを正規チェックアウトのルートで起動**（`project.godot` のある場所）。最初に `./tools/check_git_safety.sh` が通ることを確認。
3. **（任意）Godot MCP を入れておく**。入っていれば Codex が起動画面のスクショ/ログを自分で見て直せる。無くても下記タスクはヘッドレステストで自己検証できるように書いてある。

### Codexに毎回効かせる“立ち回りルール”（最初のメッセージに含める）
> - 作業は1タスクずつ。指示されたタスクの「完成の定義」を全部満たすまで止まらない。途中で「とりあえず雛形」では終わらせない。
> - 編集前に `git rev-parse --show-toplevel` と `./tools/check_git_safety.sh` を実行。`origin/main` からfeatureブランチを切る。`main` に直push禁止。
> - 既存の動いている処理（弾幕・吸い出し・他ステップ）は触らない。今回のタスク範囲外のファイルは変更しない。
> - 画像は生成しない。プレースホルダ（単色矩形・ColorRect等）で作る。アートは後工程。
> - 仕上げに `gdformat` と、可能なら `gdlint` を通す。
> - 完了報告は「完成の定義」を1項目ずつ満たした証拠（実行ログ・スクショ）付きで。

---

## Part A. 第1章タスク順（縦に1本通す）

各タスクは「単体で起動して確認できる」粒度。順に積んで、最後に大会フローへ結合する。

1. **アルミ穴あけミニゲーム（タップ式）を単体テストシーンとして完成** ← 今ここ（Part B）
2. 盛り方選択（3択）を単体ステップとして実装（plan §1）
3. 炭焼き判定（色を見る判定ゲーム）を単体実装（plan §炭焼き）
4. 調整フェーズ改修（灰落とし等5アクション・数値表示撤廃）（plan §調整）
5. 手札プレゼン方式の実装（plan §プレゼン）
6. 上記を `ch1_tournament` の16ステップフローに**結合**（弾幕・吸い出しは既存のまま挟む）
7. 日常ループ1日分（朝LINE→練習/バイト→夜締め）が通ることを確認
8. 日常→大会→結果が一続きで動く＝**第1章が一周遊べる**状態に（`ch1_smoke_runner` を緑にする）

> 結合（タスク6）までは各ミニゲームを独立シーンで作り、`scenes/minigames/` に置く。これがCodexが「簡単なとこだけ作って終わる」のを防ぐ一番の効き目（範囲が小さく、完成判定が明確）。

---

## Part B. タスク1 ＝ そのまま貼り付けるCodexプロンプト

> 下の枠をそのままCodexに貼る。前段に Part 0 の“立ち回りルール”を付けてから貼ると安定する。

```
タスク: 第1章「アルミ穴あけミニゲーム（タップ式・作り直し版）」を、単体で起動・確認できるテストシーンとして完成させて。

## 背景
- 仕様は docs/minigame_implementation_plan.md の「アルミ穴あけ（作り直し）」に準拠。
- 旧リズムゲーム版は scripts/tournament/ch1_tournament.gd に残っているが、新方式（_aluminum_grid_holes / _aluminum_glow_window 等）は書きかけで未完成・未接続。
- 今回は ch1_tournament.gd 本体は触らず、再利用できる「独立したミニゲーム部品＋テストシーン」として新規に作る（結合は後タスク）。

## 作るもの
1. scripts/minigames/aluminum_punch.gd … 穴あけミニゲーム本体（Control派生、単体で完結）。
2. scenes/minigames/aluminum_punch.tscn … 上記をF6で単体起動できるシーン。
3. scenes/debug/aluminum_punch_runner.gd + .tscn … scenes/debug/ch1_smoke_runner の作りに倣ったヘッドレス自己検証ランナー。

## ゲーム仕様（第1章パラメータ）
- アルミ上面に穴の候補位置をグリッド配置。穴の数は 24〜28個（HMS機材で増減。今回は固定26でよい）。
- 穴が1つずつ順に光る（グロウ）。プレイヤーはタップ/クリック。グロウ受付時間は 1.2 秒（_aluminum_glow_window と一致）。
- 判定: グロウ中心に近い順に PERFECT / GOOD / NEAR、時間切れ or 大外し = MISS。
- スコア: 各判定を集計し、結果Dictionaryを返す:
    { perfect:int, good:int, near:int, miss:int, accuracy_ratio:float(0..1), delta_spec:float, delta_aud:float, cleared:bool }
  - accuracy_ratio = (PERFECT*1.0 + GOOD*0.7 + NEAR*0.4) / 全穴数
  - delta_spec = accuracy_ratio * 12.0（専門点への加点。係数は後で調整可能なよう const にする）
  - delta_aud = perfect 数に応じた小さなボーナス（const化）
  - cleared = (GOOD以上のヒット数 / 全穴数) >= 0.75（クリアライン75%）
- 終了時に signal finished(result: Dictionary) を emit する（後で大会フローが受け取れるように）。
- 演出はプレースホルダでよい: アルミ＝ColorRect、穴＝小さな円/矩形、グロウ＝色とスケールのTween。画像生成はしない。
- 数値（スコアの生値）はプレイ中の画面に出さない。出すのは判定テキスト（PERFECT等）と最後の簡易リザルトのみ。

## 完成の定義（すべて満たすまで終わらない）
- [ ] scenes/minigames/aluminum_punch.tscn が Godot 4.6 で F6 起動し、エラー0。
- [ ] 26個の穴が順に光り、タップで PERFECT/GOOD/NEAR/MISS 判定が出る。
- [ ] 全穴終了後に result Dictionary を上記スキーマで作り、finished シグナルを emit、画面に簡易リザルト（各判定の個数と cleared）を表示。
- [ ] scenes/debug/aluminum_punch_runner.tscn をヘッドレス実行して自動検証が緑になる:
      godot --headless --path . scenes/debug/aluminum_punch_runner.tscn
      （ランナーはミニゲームをマウントし、全穴を自動でタップ相当の入力で消化し、result が正しいスキーマ・値域で返ることをassert。失敗時 exit 1、成功時 exit 0。ch1_smoke_runner の _assert/_mount_scene パターンに倣う）
- [ ] gdformat 済み。可能なら gdlint も通す。
- [ ] Godot MCP が使えるなら、起動してスクショを撮り、穴グリッドとグロウが見えていることを確認・添付。

## 検証ループ
コードを書いたら「ヘッドレスランナー実行 → ログ確認 → エラー/assert失敗を修正」を、exit 0 になるまで繰り返すこと。MCPがあればスクショで見た目も確認して直す。「書いて終わり」にしない。

## 触ってはいけない範囲
- scripts/tournament/ch1_tournament.gd 本体、弾幕・吸い出し・他ステップ、既存シーン。
- 既存の動作を壊す変更。今回は新規ファイル追加が中心。

## git
- origin/main から feat/ch1-aluminum-punch ブランチを切って作業し、コミットして。main へは push しない。作業前に ./tools/check_git_safety.sh を通す。
```

---

## Part C. タスク1が緑になったら次に投げる文（参考）

> 「タスク1で作った scripts/minigames/aluminum_punch.gd を、docs/minigame_implementation_plan.md §1 の『盛り方選択（3択）』ステップと同じ作りで scripts/minigames/packing_style.gd / scenes/minigames/packing_style.tscn として実装して。完成の定義・検証ループ・触らない範囲はタスク1と同じ方式で。」

以降、Part A の順に同じテンプレで投げていく。タスク6（結合）の段で初めて `ch1_tournament.gd` 本体に手を入れる。
