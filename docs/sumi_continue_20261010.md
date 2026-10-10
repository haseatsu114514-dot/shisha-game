# スミさんの大会コンティニュー（2026-10-10）

## 体験
大会で順位敗退・焦げ・冷え切り・フレーバー切れが起きたとき、従来の GAME OVER 画面を廃止してスミさんが割り込み、約20秒間プレイヤー本人を説得する。
- 「俺たちの負け」として、一緒に戦っている師匠が異常なほど必死になる。普段は寡黙なスミさんとのギャップが主眼
- セリフは3種類（共同責任／世界の終わり／反対多数）。続けて見るたびローテーション
- **大会に戻る**: 従来と同じ大会冒頭へ戻り、前に保存した在庫等からやり直す。**諦める**: タイトル画面へ
- 20秒を待たずに決断してよい。セリフのスキップ・音声ON/OFFが可能
- スミさんの正式な立ち絵の surprise / serious / normal を字幕キューごとに切り替える。口パク・収録音声追加が容易な構造

## 実装
- `remake/js/chapters/gameover.js`: 3パターンの `SUMI_CONTINUE_SCRIPTS`。キュー単位の字幕表示・立ち絵差分・簡易進行バー・音声再生
- `remake/css/daily.css`: 新しい全画面UI
- `remake/js/core/audio.js`: `bgm_continue_urgent`。現時点は音声と干渉しにくい軽い WebAudio ピンチ系ループ
- `remake/js/chapters/ch1.js`: コンティニュー呼出と既存大会リトライを接続
- `remake/js/main.js`: デバッグコンソール `__remake.dev.gameOver("rank", 0)`、最後の数字を0〜2へ変えて3種を確認できる。burnt/cold/leaf も指定可能

## 音声の差し替え
現在の仮音声は各端末の `SpeechSynthesisUtterance`（日本語、速度1.55、ピッチ0.68）。ブラウザの日本語音声ラインナップや自動再生制限のため、渋い男声が保証されない。音声が鳴らなくても字幕と操作は進行する。

録音済みの正式音声を入れる場合は、`gameover.js` の各 `SUMI_CONTINUE_SCRIPTS[*].audio` に、ゲームから読める相対URLを設定する（例: `../assets/audio/voice/continue/sumi_together.mp3`）。`audio` があれば音声ファイルを優先し、読み込めなければ仮音声へフォールバックする。voiceStatus も更新される。

候補の無料合成音声は **VOICEVOX:麒ヶ島宗麟**。渋いおっさん声の公式サンプルあり。商用・非商用とも使用できるが、ゲーム内のクレジット等に正確に `VOICEVOX:麒ヶ島宗麟` と表記し、最新版規約を確認すること。外部ソフトを本リポジトリに無断同梱しない。
- https://voicevox.hiroshiba.jp/product/kigashima_sourin/
- https://voicevox.hiroshiba.jp/term/
- https://github.com/VOICEVOX/voicevox_vvm/blob/main/TERMS.txt

将来の口パクは `cues[*].at` と `script.audio` の時間を基準として、立ち絵部をLive2D風の開口・閉口レイヤー/動画に交換する。完成音声の実測時間が20秒と異なるときは `duration` と各 `at` を更新する。Web Speechの音素イベントへの依存は避ける。

## フリーBGM候補
2026-09-15に旧DOVA-SYNDROMEはOpenTracksへ名称変更。主役は声なので **ピンチだ！どうする！？どうにかなれっ！！** のコミカルな緊迫感を第一候補に試聴比較する。
- ピンチだ！どうする！？どうにかなれっ！！ / マイマイシ（0:51） https://dova-s.jp/bgm/detail/23407
- ピンチ - 8bit / Hupple（0:24） https://dova-s.jp/bgm/detail/12977
- ピンチ / カピバラっ子（0:26） https://dova-s.jp/bgm/detail/18562
- 共通ライセンス: https://opentracks.com/help/articles/license/
- ゲームの利用条件: https://opentracks.com/help/articles/game_trpg/

重要: 規約上、音源ファイルが単体で抜き取れる形の再配布は不可。ブラウザゲームに生 MP3 を直接公開・GitHubに単なるBGM素材として並べることを安易にしない。採用する場合は、作者個別条件を確認し、ゲーム本編へ適切に組み込む方式を決めてから行う。現状は権利安全な自前のWebAudioループを使用し、第三者の音源は未同梱。

## 確認観点
1. `__remake.dev.gameOver("burnt",0)` でスミさんの立ち絵、字幕、理由、音声ボタン、スキップが表示される
2. 0 / 1 / 2 で3種のキュー・表情が切り替わる
3. 再挑戦操作は元の大会当日へ戻る。ボタンを20秒以内に押しても反応する
4. 諦めた場合はタイトルへ。途中の読み上げとBGMが停止する
5. 端末に日本語TTSがなくても字幕とコンティニューは正常。動きを減らす設定では揺れが止まる
6. モバイルの既存1280x720ステージ縮小でテキストがはみ出さないか確認する

## 追補: 指定BGM・VOICEVOX自動合成・恋人プレミア
2026-10-10に追加された仕様と実装・素材の許諾状況・Claude Code引継ぎ手順は [continue_voice_music_premium_20261010.md](continue_voice_music_premium_20261010.md) を参照。旧フリーBGM候補よりもオーナー指定のYouTube参考曲を優先検討する。ただし利用許諾を確認できるまでは指定音源を実装しない。

## 第3期の確定仕様（2026-10-10）
従来の「OS標準音声で仮読み上げ」方針を**撤回**。現在のコンティニューは声なし・立ち絵＋文字アニメーション＋BGMer「EMGコール」BGMで完成する。恋人プレミアは20%、同じ恋人連続出演は禁止。サメちゃんを追加。詳細は [continue_voice_music_premium_20261010.md](continue_voice_music_premium_20261010.md)。
