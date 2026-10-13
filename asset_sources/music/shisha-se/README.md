# 制作・UIの録音SE

水音は oresamp の実際のシーシャ録音を使い、吸い始めから連続区間をループし、停止時に最後の泡を鳴らす。ループの継ぎ目は120msのクロスフェード。吸引の強さで音量と泡の速度を少し変える。

炭をつかむ音は DJ_SoMaR の加工済みキッチントングを短く、小さくする。HMS設置は RutgerMuller の柔らかい金属ノック2種、穴あけは AmberdeMeillon の薬包装のアルミを押し破る録音の短尺候補を使う。HMSと針の直接録音ではない。葉を取る操作はオーナー指定に合わせてほぼ無音とし、乾いた葉や粘着音を足さない。

UIクリックと戻る音は Kenney、入店ベルは 3bagbrew、LIMEは Joseph SARDIN のガラス接触音を短い2音に編集したもの。長い会話の文字送り・大会演出・BGMは既存の音処理を維持する。穴あけは毎穴の評価音を重ねず、リング完成時にだけ短い締めを鳴らす。

同梱の音源はすべてCC0。商用利用・加工・ゲーム同梱・GitHubへの原音再配布を許可し、クレジット義務なし。確認日、作者、配布ページ、取得URL、原音と加工の区別は [sources.json](sources.json)、ゲーム用音源のハッシュは [game_files.json](game_files.json)。Kenneyの原ライセンスも保存する。

Freesoundの原音は公開HQプレビューMP3で、元WAV/AIFFは未取得。候補は作者の録音説明と波形から選定しており、耳での音色評価は未実施。薬包装の短尺区間は包装操作も混在する代用候補として扱う。実機スマホ/Safariでの聴感確認は未実施。

再生成は `python3 asset_sources/music/shisha-se/prepare.py`（ffmpegが必要）。最終音源は `assets/audio/se/`。SEのファイル一覧は `remake/js/core/audio.js` で明示しており、画像/BGM用のmanifestは変更しない。
