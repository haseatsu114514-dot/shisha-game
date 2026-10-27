# TRPG roll UI / Issue 596

オーナー採用の `adopted-concept.png` と原生成指示、現在画面の参照、Issue仕様を保存。完成UIのスクリーンショットをそのままゲームへ貼らず、枠/布/外周紙の装飾だけを使用する。

装飾3点は親orchestratorがbuilt-in image_genで生成し、CLI Bが実物/透過/ハッシュを確認したネイティブPNG。`decoration-prompts.json` に正確な指示、`provenance.json` に参照/元/配信のSHA-256、寸法、透過、生成出力basename、変換条件を保存。第三者ストック素材や追加有料サービスは使っていない。Libraryの転送URL・認証情報は含めない。

`assets/ui/trpg/*.png` は元PNGとbyte-identical。`remake/img/ui/trpg/*.webp` は1024px以内への機械的縮小・形式変換のみ。原画・アルファを塗り直さない。枠のmax alpha254も生成原本のまま。角と中心はalpha0。紙のcanvas境界には微小なnear-zero fringeがあるが、alpha>16は境界に接しない。文字・出目・人物・空肖像枠は素材に含めず、既存DOM・正規人物素材を利用する。
