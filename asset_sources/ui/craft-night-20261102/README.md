# Craft night UI source record

Issue #2359 / CUI06〜09。生成は Codex 内蔵 imagegen、1回につきPNG 1枚。共通スタイルと個別文言は `prompts/`。

生成画像の出力サイズが指定と違う場合は、採用時に無地の中央を九分割で伸ばすか、用途に合わせてリサイズした。透過画像は alpha≥8 の外接範囲で切り出し、完全透明画素のRGBを黒にした。金ボタンのみ40pxの光彩余白。

| 原画 | サイズ | bytes | SHA-256 | 採用先 / crop後サイズ |
|---|---:|---:|---|---|
| `raw/board.png` | 1672×941 | 2374607 | `9334fe47e9342a2dccbf81c8c093ab57c982a76a616ddbd70ffc15555ff66311` | `assets/ui/craft-night/board.png` / 1536×1024 |
| `raw/backdrop.png` | 1672×941 | 2159497 | `b953b2bf98ad57e2ea7870cf2d1be6ff3ed1ea58605cdf46c5bb4fe786826f7d` | `assets/ui/craft-night/backdrop.png` / 1536×1024 |
| `raw/stage-kitchen.png` | 1536×1024 | 2153442 | `c9dd2e333468904764c04f7c10f0aa77857ec1ecae2062c104fbf23e2eb5934e` | `assets/ui/craft-night/stage-kitchen.png` / 1536×1024 |
| `raw/stage-workbench.png` | 1536×1024 | 2519109 | `8e7b0d19230cfaa59634f36bee47296a0acaf3530668985250a00bbc59d84a38` | `assets/ui/craft-night/stage-workbench.png` / 1536×1024 |
| `raw/window.png` | 2172×724 | 1904877 | `bc0333bf90a93dcf6f6ead075381a00dc721a38704b1b5ad7f5541ee2e77eef8` | `assets/ui/craft-night/window.png` / 1536×1024 |
| `raw/frame.png` | 1672×941 | 809083 | `2db3cf07b6ee2922ddeafc601622ed1242569a7a6de8f259215cfb457c354ce4` | `assets/ui/craft-night/frame.png` / 1637×906 |
| `raw/button-glass.png` | 1983×793 | 1926013 | `4fefa32b44d59e7a72d614bf88ffc56bee970aa8a44867cfa0e5b24877ecf982` | `assets/ui/craft-night/button-glass.png` / 1911×581 |
| `raw/button-white.png` | 1983×793 | 1370993 | `b38d549e8e4729f5f38bd6adaf17ce7778b84bd981a5c56e9165c4c5ecdffaf5` | `assets/ui/craft-night/button-white.png` / 1877×559 |
| `raw/button-gold.png` | 1961×802 | 1947639 | `4ea7645fbe7a9299732d811cda1a36f8d880716e09af13f9c523b34b9ba3874f` | `assets/ui/craft-night/button-gold.png` / 1945×685 |
| `raw/thermo-frame.png` | 1024×1536 | 1712283 | `a02ea348465f0525cd256e1168af1015258b6ca6384f2d3e9436afca5d3a3df5` | `assets/ui/craft-night/thermo-frame.png` / 396×1478 |
| `raw/step-done.png` | 1254×1254 | 1732451 | `9bb9fb0617e7c8aedfeafcab35b848a4f2fb6e09bf8608c62c96432b1b2250b4` | `assets/ui/craft-night/step-done.png` / 1081×1084 |
| `raw/step-now.png` | 1261×1247 | 1915866 | `c7cac3c176184e015ba129485c4e3481e8d8cab9d117f8eb7c2ad299b6be92b0` | `assets/ui/craft-night/step-now.png` / 1119×1121 |
| `raw/step-next.png` | 1263×1246 | 1249581 | `007495d5d18b668b087788febf8a98bdb8d982739f5f105bffd6168dd6305c29` | `assets/ui/craft-night/step-next.png` / 1007×1013 |

| `raw/rank-strip.png` | 2172×724 | 1751587 | `313959470e79eef02959a8b3c8d8e17ee65717544bf5f8294ac3ad09b5f0c40d` | `assets/ui/craft-night/rank-strip.png` / 2138×430 |
| `raw/medal-gold.png` | 1347×1167 | 2041699 | `717a42b94ace3899899fa8017bd06ccbc434e2bbc55a246aceff7987003a67d5` | `assets/ui/craft-night/medal-gold.png` / 1236×1040 |
| `raw/medal-silver.png` | 1347×1167 | 1932593 | `6d04c9c93e130337cda4ade934cfbc526db8f9051e9b3e66a29d2a6e4ea3cab0` | `assets/ui/craft-night/medal-silver.png` / 1252×1075 |
| `raw/medal-bronze.png` | 1347×1167 | 1815689 | `3c1b9e56e5378b83ad6a61500c4e92319c4c1221a60a66d8bd25425349c0ab8f` | `assets/ui/craft-night/medal-bronze.png` / 1189×1013 |
| `raw/medal-plain.png` | 1347×1167 | 1606531 | `4edc0859f5552787f6404187624ca5aa9c3e219fe393728949702ef7393a9519` | `assets/ui/craft-night/medal-plain.png` / 1237×1035 |
| `raw/cutin-band.png` | 1024×1536 | 1795005 | `e0b07922829106f06bd606f5f6c0d1cd4010f861b68e345a3b024a8da625a0df` | `assets/ui/craft-night/cutin-band.png` / 1009×1536 |
| `raw/entry-me.png` | 1254×1254 | 2088590 | `bb42cfea540d3b31f9881ab39e7c950432807cac05256dd17099ea90741f4e11` | `assets/ui/craft-night/entry-me.png` / 1133×1094 |
| `raw/entry-rival.png` | 1254×1254 | 1494042 | `dd15e0fa46cdb5c524b265687105f70198e63ed985e86f1a57be13035d711733` | `assets/ui/craft-night/entry-rival.png` / 1056×1022 |
温度計の採用画像は 396×1478。中央の透明窓は y=約121〜1358 (高さ8.2〜91.9%)、中央行の x=約138〜252 (幅34.8〜63.6%)。CSS の管は左右35%/36%、上下8.2%。
