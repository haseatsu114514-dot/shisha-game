# シーシャくじ原画 生成記録

2026-11-11。内蔵画像生成で1回に1枚ずつ生成。各回、PR #3212 の正本 `prompts.md` の STYLE 段落、対象画像段落の順で渡した。参照画像には画風・素材・色（構図は写さない）と、玉・札では形と配置の役割を明示した。各PNGは無加工。

原寸で視認し、Pillowで寸法・alpha・端画素を確認。不一致は同一プロンプトで計3回生成した。下記は保存した候補の値。生成器が指定寸法や完全な抜き・黒端を満たさないものは不合格として明記した。背景の代替マゼンタは使用していない。

| # | ファイル | ピクセル数 | bytes | SHA-256 | CHECK | 添付参照画像 |
|---:|---|---:|---:|---|---|---|
| 1 | `garagara-drum.png` | 1254×1254 | 1994259 | `38f46ae65f4d2b9ce1c59f98fd4950e46cfc8a1e19d3d8d2656a608f5ec9af49` | 不合格：3回とも1254×1254。六角・中心軸・1枚の出口は確認。 | `assets/backgrounds/bg_shop.png` |
| 2 | `garagara-frame.png` | 1254×1254 | 492054 | `1f2897ae15d04e733616ac73d8cc5e8429d1d9949db4ce79281ba46b47dbf60f` | 不合格：3回とも1254×1254。A字・中央の抜けは確認。 | `assets/backgrounds/bg_shop.png` |
| 3 | `garagara-base.png` | 2172×724 | 1491655 | `25bc7ae42978449c5ca6dba54ea7ba6935c3addd6790922afa8c6fd71e5d01d1` | 不合格：3回とも2172×724。板が約5.3:1で指定約7:1より厚く、外影も残る。 | `assets/backgrounds/bg_shop.png` |
| 4 | `garagara-handle.png` | 1254×1254 | 366542 | `d73d1766a1d0dd6b3622dd1cfc7c9a73d48224f6ac027b33314bb7f6c80be4b2` | 不合格：3回とも1254×1254。水平・左右の位置は概ね一致。 | `assets/backgrounds/bg_shop.png` |
| 5 | `garagara-tray.png` | 1536×1024 | 1716006 | `4a3876458d425d12deb938c44dad9643042f9ffeb1c98ec00b12d19ff3b0ffdf` | 不合格：3回とも1536×1024だが外側に影が残り、楕円も指定より厚い。 | `assets/backgrounds/bg_shop.png` |
| 6 | `ball-s.png` | 1254×1254 | 1181707 | `8fb7bcd633a441ccf28a591fe01a05a49ad381340d52ce705e37f662a63620b3` | 不合格：3回とも1254×1254。球径は約75%で指定66–74%を超える。 | `assets/backgrounds/bg_shop.png` |
| 7 | `ball-a.png` | 1254×1254 | 1133948 | `d271ff7b9aa924fe9c865cea4bd3c95d22f9e67b815400b74f22f8484a59da9d` | 不合格：3回とも1254×1254。赤色と球形は確認、基準玉とのピクセル単位一致なし。 | `assets/backgrounds/bg_shop.png`、`asset_sources/ui/kuji-gacha-20261111/raw/ball-s.png` |
| 8 | `ball-b.png` | 1254×1254 | 1101119 | `12c440d679fc905d120b8d010573cba391c3246da4cce12a2c7578f0a2cf217b` | 不合格：3回とも1254×1254。青色と球形は確認、基準玉とのピクセル単位一致なし。 | `assets/backgrounds/bg_shop.png`、`asset_sources/ui/kuji-gacha-20261111/raw/ball-s.png` |
| 9 | `ball-c.png` | 1254×1254 | 1055450 | `c06a50442178f191994f74355e12fdbac42360f0ae57281a3009e911590dcc20` | 不合格：3回とも1254×1254。白色と陰影は確認、基準玉とのピクセル単位一致なし。 | `assets/backgrounds/bg_shop.png`、`asset_sources/ui/kuji-gacha-20261111/raw/ball-s.png` |
| 10 | `ball-last.png` | 1254×1254 | 1087344 | `e3558c51013ac6f7673db7d3d4a3d45897f9fbaa2db14166e4a99d80dc7c9bc3` | 不合格：3回とも1254×1254。暗色と銀帯1本は確認、基準玉とのピクセル単位一致なし。 | `assets/backgrounds/bg_shop.png`、`asset_sources/ui/kuji-gacha-20261111/raw/ball-s.png` |
| 11 | `counter.png` | 1536×1024 | 1284055 | `fa73066eed5118508e9ecc814f4c8e9759842409466d827f167610c5c51926d3` | 不合格：3回とも1536×1024。背面端約56.5%、前面端約76%だが上部にalpha=1の微小な画素が残る。 | `assets/backgrounds/bg_shop.png` |
| 12 | `card-s.png` | 1934×813 | 2412125 | `d3e25a5a6691b8da92bddf39a75a84cd0468f6a8b5f1a54970d4d67f3ed09285` | 不合格：1回目1934×813、2・3回目1935×813。窓と右余白は空だが札本体が約2.6:1。 | `assets/backgrounds/bg_shop.png` |
| 13 | `card-a.png` | 1934×813 | 2224250 | `750d8f04b6d0701ba669eb54930f21705f451a7fce509dd1e398406918f52af3` | 不合格：3回とも1934×813。赤箔・空の余白は確認、基準札とのピクセル単位一致なし。 | `assets/backgrounds/bg_shop.png`、`asset_sources/ui/kuji-gacha-20261111/raw/card-s.png` |
| 14 | `card-b.png` | 1934×813 | 2118204 | `eb075fb6e036f4bd6b56012f8864d68be5b484809506b0531951a9af3629c7ce` | 不合格：3回とも1934×813。青箔・空の余白は確認、基準札とのピクセル単位一致なし。 | `assets/backgrounds/bg_shop.png`、`asset_sources/ui/kuji-gacha-20261111/raw/card-s.png` |
| 15 | `card-c.png` | 1934×813 | 2128648 | `4f1d421fd542d79a7c0c74af7f26f89c908135dc64baf9e4ef82592471db85db` | 不合格：3回とも1934×813。銀箔・空の余白は確認、基準札とのピクセル単位一致なし。 | `assets/backgrounds/bg_shop.png`、`asset_sources/ui/kuji-gacha-20261111/raw/card-s.png` |
| 16 | `card-last.png` | 1934×813 | 2126761 | `4f19dcb3f96f834fe26c3a0ea8a07869e39e68a46eda89afcf1db6bdb2daee97` | 不合格：3回とも1934×813。黒紙・銀箔・空の余白は確認、基準札とのピクセル単位一致なし。 | `assets/backgrounds/bg_shop.png`、`asset_sources/ui/kuji-gacha-20261111/raw/card-s.png` |
| 17 | `burst.png` | 1254×1254 | 1256294 | `06eca59853fcc0d0385bfe4ed8e7bdc8c9bdeff9f6fc3a2b4ed962e67ceace47` | 不合格：3回とも1254×1254。中心放射は確認、端に完全な#000000以外の微小画素あり。 | `assets/backgrounds/bg_shop.png` |
| 18 | `gift.png` | 1254×1254 | 1613946 | `e7585847a2dd1eceed6e99963f00d9b1cbd7fe178f93b4758e88e9838ca1e9ea` | 不合格：3回とも1254×1254。箱と無地札は確認、箱の外に影が残る。 | `assets/backgrounds/bg_shop.png` |
| 19 | `sign.png` | 1024×1536 | 1786556 | `7ac2e274fcd07821a2c707e4fbbbb3d8ee85a673f1222efd0b7f1c9c9620cb33` | 不合格：3回とも1024×1536。黒板は空だが周囲に茶色の半透明な光が残る。 | `assets/backgrounds/bg_shop.png` |
| 20 | `bell.png` | 1024×1536 | 1644691 | `6622657bea6f59b842d8265090baa6f8bc51339cf3280b6d40374f9849133773` | 不合格：3回とも1024×1536。取っ手は上端まで達するが鐘口が指定40%より広く、周囲に光が残る。 | `assets/backgrounds/bg_shop.png` |
| 21 | `rail.png` | 1536×1024 | 863731 | `baae4ed9ff4fe635f290030f37745e67a1fa145c0ec704f03d240eddde6037f3` | 不合格：1回目1536×1024、2・3回目2172×724。水平・空の溝は確認、外影が残る。 | `assets/backgrounds/bg_shop.png` |
| 22 | `banner.png` | 1536×1024 | 1208289 | `ceec2450a2fc2c88459c98385cd9b58b31489f655787d982625d06106bae57ff` | 不合格：3回とも1536×1024。中央は無地だが幅が指定70%より広く、外影が残る。 | `assets/backgrounds/bg_shop.png` |
| 23 | `sparkle.png` | 1254×1254 | 472505 | `1ed9711c8ccbf189661550cda3bc2cf28bf7945950a48687596841936e18cd69` | 不合格：3回とも1254×1254。中央の四方光は確認、端に完全な#000000以外の微小画素あり。 | `assets/backgrounds/bg_shop.png` |

## 検品の要点

- 23枚とも内容を原寸で確認。文字・数字・ロゴ・人物・手・シーシャ機材は見られない。店内背景と木・鉄・真鍮の画風は近い。
- 透過指定の21枚はRGBAでalpha=0の画素を持つが、周囲に微小な画素または半透明の外影が残る候補がある。黒地の2枚はRGBで、端に完全な黒以外の微小な画素が残る。
- 玉と札の色違いは肉眼では近い配置だが、輪郭に数pxの差があり、ピクセル単位での重ね合わせ条件は満たさない。
- 寸法不一致のPNGは指示に従って拡大縮小・切り出しをしていない。ゲームへの組み込みも未実施。
