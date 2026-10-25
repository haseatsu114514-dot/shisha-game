# 久世朔・トリックスター立ち絵改訂

久世を23歳の若い成人として、童顔・悪戯っぽい表情と小柄なシルエットに描き直した。長い袖と手帳は残し、長い店員エプロンを非対称の短い腰エプロンとベストへ変更した。通常表情は無邪気な半笑い、大会用 `smug` は相手の予想外の行動さえ楽しむような鋭い笑み。ましろの金髪三つ編み・眠そうな目とは明確に分けた。

- `candidate-a-source.png`: 比較した最初の案。生成指示は `candidate-a-prompt.txt`。
- `normal-source.png`: 採用した通常表情の原画。生成指示は `normal-prompt.txt`。
- `smug-source.png`: 通常表情を参照して生成した大会用表情。生成指示は `smug-prompt.txt`。
- いずれも `image_gen.imagegen` で制作した透過PNG（候補Aは1084×1451、採用通常と `smug` は1086×1448）。最初の2案の参照は前版の久世原画のみで、画風・配色を継いで人物は再設計した。
- `build-sprites.py`: 原画を縦横比を保って896×1200の透過キャンバスへ収め、孤立した低アルファ画素を除く。人物や服を描き足さない。
- 配布素材は `assets/sprites/characters/kuze/chr_kuze_{normal,smug}.png`。WebPと目録は `python3 remake/tools/build_manifest.py --portraits-only kuze` で生成する。

両手は各5本の指、両足・靴は自然であることを原寸で目視確認した。顔と表情の差、ましろとの身長差を実VN 1280×720で確認し、初登場カットインも顔と文字の重なりがないことを確認した。`manifest` の可視高 `h` は約0.83。VNは可視高を自動正規化するため、実表示の身長差にはキャラの `spriteScale: 0.93` が必要。
