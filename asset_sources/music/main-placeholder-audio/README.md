# 本編の仮BGM・UI効果音（2026-11-10）

本編（会話・メニュー・地図・店・大会の待ち・第4・5章）に当てた仮の音源の出典。ゲーム側の差し替えは `remake/js/core/story-audio.js` の対応表と、下のファイルだけを変えればよい。

ライセンスはすべて CC0。クレジット義務はないが、スタッフロールとこの台帳に作者・曲名・配布元を載せる（オーナー指示）。

ラクダレース（PC側）と DJ（#2456）の音は対象外。TRPG・斧投げの仮音は別台帳（`trpg-audio/`、`minigame-se/`）。

## 再変換

`ffmpeg` が必要。OpenGameArt の原音を 44.1 kHz ステレオ 80 kbps MP3、目標およそ −16 LUFS / −1.5 dBTP に揃える。

```
ffmpeg -i SOURCE -af "loudnorm=I=-16:TP=-1.5:LRA=11" -ar 44100 -ac 2 -b:a 80k \
  -id3v2_version 3 -metadata title="TITLE" -metadata artist="AUTHOR" \
  -metadata copyright="CC0 1.0" assets/audio/bgm/KEY.mp3
```

SE は Kenney の原 ogg を 44.1 kHz モノラル PCM WAV にする。ゲームファイルのハッシュは [game_files.json](game_files.json)、URL と役割は [sources.json](sources.json)。Kenney の原ライセンス文もこのフォルダに置く。

原音のマスターはリポジトリに置かない（容量のため）。再入手は sources.json の page / file。

目録の更新: `python3 remake/tools/build_manifest.py --audio-only`（画像目録は触らない）。
