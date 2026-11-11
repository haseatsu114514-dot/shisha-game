# ミニゲームの仮SE（2026-11-10・仮置き）

オーナー依頼（2026-11-10）「斧投げとかサンドレースとかミニゲーム全般に、効果音とかBGMを合うもの探して一旦入れて」の仮置き。ブランチ `grok/minigame-audio`。採否はオーナーの試聴で決める。

- 同梱の音源はすべて **CC0**（商用利用・加工・ゲーム同梱・GitHubへの原音再配布可、クレジット義務なし）。作者・配布ページ・取得URL・確認日・ハッシュは [sources.json](sources.json)、ゲーム用ファイルは [game_files.json](game_files.json)。Kenney の原ライセンスも保存。
- Freesound の原音は公開HQプレビューMP3（元WAVは未取得。ログイン不要の範囲）。Kenney は配布ページの無料ダウンロード（Impact Sounds 1.0）から2ファイルだけ。
- 切り出し位置は波形の立ち上がりから決めた。**耳での音色確認は未実施**。実機スマホ/Safariでの聴感確認も未実施。
- 再生成は `python3 asset_sources/music/minigame-se/prepare.py`（ffmpegが必要）。最終音源は `assets/audio/se/minigame/`（モノラル44.1kHz 16bit WAV。既存の録音SEと同じ形式）。キューの表は `remake/js/core/audio.js` の `MINIGAME_SE`。

| キュー | ファイル | 使う場面（斧投げ） | 原音 |
|---|---|---|---|
| axeThrow | axe_throw.wav | 自分・相手が斧を放す | Swing Woosh — Jofae |
| axeThunk | axe_thunk_01〜03.wav | 得点して板に刺さる（3種を連続で重ねない） | R15-11-Axe Thuds — craigsmith |
| axeDrop | axe_drop.wav | 柄から当たる・回りすぎて落下（失敗音と一緒） | Kenney Impact Sounds（plank＋metal） |
| axeCheer | axe_cheer.wav | ブル・キルショット（6点以上） | Short Crowd Cheer — qubodup |
| axeWin | axe_win.wav | 結果画面: 勝ち／練習・10投で好記録／レッスン完了 | Tada Fanfare A — plasterbrain |
| axeLose | axe_lose.wav | 結果画面: 対戦で負け | Sad, Downwards Jingle (Tremolo) — IndyArts |

0点で板に刺さった時は今まで通り失敗音だけ（喜ばせない。`test/browser/axe_polish.mjs` の条件）。録音が読み込まれる前・取得失敗時は、今までの合成音（whoosh・hit・perfect・fanfare）で鳴る。BGMは既存の「Aiming groove」（`bgm_axe`）をそのまま使う。
