# DJ のフロアの観客（2026-11-02 採用）

DJS09。Codex（image_gen）の3案 `crowd-{a,b,c}.png`（各 2172×724 RGB、無加工。元のファイル名は `codex-IMAGE-MANIFEST.json`）。

- 採用: **b**。3案とも中東風のランタンやヤシが入っている（以前の指示文に「シーシャバーの雰囲気」と書いたため）。b は装飾がいちばん少なく、クラブSEAM（コンクリートの地下）と食い違いにくい。
- 加工: 1536×512 へ縮小して WebP（quality 88）→ `remake/img/ui/dj/floor-crowd.webp`（SHA-256 先頭 5874bab6d747be89）。
- 使い方: `remake/previews/dj/style.css` の `.floor:before` に群衆の頭が帯に入る高さ（center 80%）で敷き、FLOOR の値で明るさ・彩度を上げる。ドット絵の群衆は描かず、拍に合わせて流れる光だけ重ねる（`app.mjs` の drawCrowd）。
