# 日常BGM「間接照明とブラックコーヒー」（OpenTracks／2026-11-18 出典確認）

FIN08・#3726 B-8 の「配布元が記録に無い3曲」のうち、日常曲の出典確認。

## 曲

- 曲名: 間接照明とブラックコーヒー
- 作曲: オオヒラセイジ
- 配布元: OpenTracks（旧 DOVA-SYNDROME）
- 公開: 2022-08-09、再生時間 3:04（公式ページ記載）
- ページ: https://dova-s.jp/bgm/detail/17173 （OpenTracks の試聴ページ。旧 URL も同じ曲）
- 作曲者の利用条件: サイト準拠（追加の独自条件なし）

ゲームで使っている音（128 kb/s・3:04.63）は、公式ページの 3:04 と一致する。オーナーも以前「フリーBGMだった」と改名を指示している（BGM01）。

## 利用条件（確認した日: 2026-11-18）

OpenTracks の音源利用ライセンス（https://opentracks.com/help/articles/license/ およびゲーム向け説明 https://opentracks.com/help/articles/game_trpg/）:

- ゲームの BGM としての利用は、営利・非営利を問わず可。
- クレジット表示は必須ではないが、可能な限り記載が推奨。スタッフロールの使用楽曲に1行足した（`STAFF_MUSIC`）。
- 音源 MP3 を単体で配布・公開すること、エンドユーザーが容易に音声ファイルとして取り出せる状態で置くことは禁止。大会曲（同じ OpenTracks の「Mind Duel」）と同じく、公開リポジトリには公式 MP3 を置かず、ゲーム専用の `.bgm` 形式で保存する。

## 保存

- ゲーム用ファイル: `assets/audio/bgm/kansetsu_shomei_to_black_coffee.bgm`
- 梱包したバイト列は、これまでにゲームが鳴らしていた 128 kb/s の MP3（再生は同じ）。SHA-256: `94e3dd499b5555d98e12188eec276159ed0f79a73e48bb5b6f4c4d13dc4f6c21`（2,954,597 bytes、44.1 kHz ステレオ、3:04.63）
- 以前 `asset_sources/music/kansetsu_shomei_to_black_coffee.mp3` にあった 320 kb/s の控え（7,377,948 bytes、約 3:04.45、SHA-256: `7d6e8aa1b1b36b33448b16b53a43b421bcc3ffc9e112157777270401ea9d4f22`）は、単体公開を避けるため公開ツリーから外した。必要なら公式ページから取り直せる。

再変換: `python3 remake/tools/pack_bgm.py <source.mp3> assets/audio/bgm/kansetsu_shomei_to_black_coffee.bgm` のあと `python3 remake/tools/build_manifest.py --audio-only`（目録の `bgm` だけ更新）。

## 残件（この曲以外）

TRPG「Shared Discovery」と斧投げ「Aiming groove」は、梱包源の ID3 が Suno 製・作者タグ `atk114514`（2026-10-20）。第三者の配布曲ではないので、使用楽曲（他人の曲）の欄には足していない。スタッフロールへ出すかはオーナー判断。
