# LIMEアイコン 選別結果（Issue #1768, 2026-10-30）

オーナーが画像選別ツールで決定したLIMEアイコン（1人1枚）。既存のアダム／みんと／つむぎ（`assets/ui/lime/adam-b.png` 等）に続き、15人分を追加した。

## このフォルダの中身

- `*.preview.webp` … 選別ツールのプレビュー（原画をツール側で1600px以下のWebPに再エンコードしたもの。今回は原画と同じ1254×1254）。**原画そのものではない**。
- 原画PNG（1254×1254）はオーナーのPCにある。下表の sha256 は原画PNGの値。

## ゲーム用への変換

- プレビューを 256×256・RGB の PNG に縮小（LANCZOS、トリミングなし）して `assets/ui/lime/` に置き、`remake/js/daily/lime-icons.js` の `CUSTOM_LIME_ICONS` に登録した（既存3人と同じ形式）。
- **原画が届いたら**、原画PNGをこのフォルダに決定ファイル名のまま置き、同じ手順（256×256・RGB・LANCZOS）でゲーム用PNGを**同じファイル名**で作り直す。コードの変更は不要。

## 対応表

| キャラID | 決定ファイル（原画） | 原画 sha256 | プレビュー | ゲーム用 | 備考 |
|---|---|---|---|---|---|
| `pakki` | `pakki-a.png` | `a24480ddee8eb436979a51697de3cc49f6600fabe7e822df8d0376729549538a` | `pakki-a.preview.webp` | `assets/ui/lime/pakki-a.png` |  |
| `samechan` | `samechan-koro.png` | `ced516df8c4899fe6ad19a303fdd88ab89026fd75f44f2eef9afcf066e2aeb47` | `samechan-koro.preview.webp` | `assets/ui/lime/samechan-koro.png` |  |
| `rei` | `rei-b.png` | `8dedfc4bc6b63a5b58d92584719899a786fdca4c39d85eb99f9ab6d6e334964f` | `rei-b.preview.webp` | `assets/ui/lime/rei-b.png` |  |
| `mashiro` | `mashiro-b.png` | `a0519e9025287f52a3583f67947093a6c2ef30d575c1ddcf8ebb47c8ee830dfc` | `mashiro-b.preview.webp` | `assets/ui/lime/mashiro-b.png` |  |
| `kumicho` | `kumicho-b.png` | `4a07678e3c68e3326355ee5f7d222db2c1d7c3f57b6a1b50ad559cd4a826feb6` | `kumicho-b.preview.webp` | `assets/ui/lime/kumicho-b.png` |  |
| `ageha` | `ageha-a.png` | `0eb7e655700597f63b546cc13dd9ece1c748a5a697268c997a4f278ad1974928` | `ageha-a.preview.webp` | `assets/ui/lime/ageha-a.png` |  |
| `rin` | `rin-a.png` | `94de5ad525ab864a23ce8cb7d9250400d9f16b4b155367b4c618ea8c62843feb` | `rin-a.preview.webp` | `assets/ui/lime/rin-a.png` |  |
| `dr_kemuri` | `dr_kemuri-b.png` | `7676dc20e6aab096482a9b1e644f94ea6aec63d93de7c170e6c682840b86d40c` | `dr_kemuri-b.preview.webp` | `assets/ui/lime/dr_kemuri-b.png` |  |
| `hajime` | `hajime-b.png` | `346ab44baac824f96794114f9d817c7c355063709f0100fd05d865cc3a20f3ab` | `hajime-b.preview.webp` | `assets/ui/lime/hajime-b.png` | 主人公。ゲーム内で自分のアイコンを表示する画面は無い（登録のみ） |
| `naru` | `naru-private.png` | `f7a65a85ad9822dae1ddd28f34246b9f843150c865b028f0ba3dcb0c67fd9826` | `naru-private.preview.webp` | `assets/ui/lime/naru-private.png` | 私服（private）案をお仕事用アカウントに使う |
| `nagumo` | `nagumo-a.png` | `fb5a99ffaa4417894f56b4a1a539be405c9b705f39a9b32e37b6730331235808` | `nagumo-a.preview.webp` | `assets/ui/lime/nagumo-a.png` |  |
| `maezono` | `icon-maezono-08.png` | `2a4c036ad06aadf8384bf8056216da2061404196911c3cd5d13934ac017e77cb` | `icon-maezono-08.preview.webp` | `assets/ui/lime/maezono-08.png` | 私服セットの08番をお仕事用アカウントに使う |
| `hiyori` | `hiyori-a.png` | `edb85ddf772b65cc4357a795e8d78665b08ef67d91f77e5f83ee475c8c7e0284` | `hiyori-a.preview.webp` | `assets/ui/lime/hiyori-a.png` |  |
| `sumi` | `sumi-b.png` | `d8dac3d9950633a0068c71cd3dece1e8dea71f59bccc6a09617ec05b109b9765` | `sumi-b.preview.webp` | `assets/ui/lime/sumi-b.png` |  |
| `uranaishi` | `uranaishi-b.png` | `bc6fe011eb2d1bfc7153f8b5981d63b619f323e9c804a4bdc35f158827217a13` | `uranaishi-b.preview.webp` | `assets/ui/lime/uranaishi-b.png` |  |
