# 画像生成実測記録

内蔵画像生成、各回1枚。原画は未加工で保存。参照: `card-back.webp`、`card-front-frame.webp`、`bg_uranaishi.webp`。

| # | 原画 | 実寸 px | モード | bytes | SHA-256 | CHECK |
|---:|---|---:|---|---:|---|---|
| 1 | `09-hermit.png` | 1024×1536 | RGB | 3900537 | `bb3a65558ffe751f74cfe19e7199e7d780c0b116ad9a60cf42678e84f00625b9` | 未確認 |
| 2 | `01-magician.png` | 1024×1536 | RGB | 3821834 | `fa41090aff2283e839a5b6cd67d104dc7b174a7ba12371054830878b69243c26` | 未確認 |
| 3 | `06-lovers.png` | 1024×1536 | RGB | 3742539 | `57520f3e244630ca553f2e70272434fda87b323ef241a28ec8280a07e996582a` | 未確認 |
| 4 | `03-empress.png` | 1024×1536 | RGB | 3693745 | `1bd649d317d9faad3536ca2cf6cf24791fa7718f44cab886e60089a5f1d610af` | 未確認 |
| 5 | `17-star.png` | 1024×1536 | RGB | 3547016 | `1d2fc467a5391d40fcbccb9aacde59482e335702168583937b6616899f01d0a0` | 未確認 |
| 6 | `02-high-priestess.png` | 1024×1536 | RGB | 3968807 | `21862b27c68f8a695e3ce2b32d4cef29c105bca22e3feb2ddc11d09d6f1b7173` | 未確認 |
| 7 | `08-strength.png` | 1024×1536 | RGB | 3689175 | `867c8c671d0792e8babd5f665fd50318ccfcf85595a467db22b22f362fe7a94f` | 未確認 |
| 8 | `10-wheel.png` | 1024×1536 | RGB | 3798447 | `6508858490b6e3918a55e9cb04b3180fd7b0bbadfa1cf10018137befc6e14c7e` | 未確認 |
| 9 | `19-sun.png` | 1024×1536 | RGB | 3353516 | `a525181338f63e8c6657307e769b4ecf71518e905145f7e040e707e3fc81198f` | 未確認 |
| 10 | `05-hierophant.png` | 1024×1536 | RGB | 3757301 | `6511cc18bf351ce563325ed891e415ec820e184b8ddb3c33b54d0e02bb960d02` | 未確認 |
| 11 | `18-moon.png` | 1024×1536 | RGB | 3650323 | `4f15c05e4eab5a5358e587b00a8ecb1b307780969da3c190a2bd967aaca7cc8e` | 未確認 |
| 12 | `00-fool.png` | 1024×1536 | RGB | 3649434 | `be90df16c79a9a908fa4664c9dbc3c02625032d5415e895f61cf9c3c08b630c3` | 未確認 |
| 13 | `14-temperance.png` | 1024×1536 | RGB | 3856253 | `c12fb6a723f7240970751d7fde59f890383d0d4b47f0ee6a48f0be4a9bf04510` | 未確認 |
| 14 | `04-emperor.png` | 1024×1536 | RGB | 3973219 | `289fab6c4a5b840c0d705cf3e05c0a9c2b160cec68268d4ff192ee22c0a58205` | 未確認 |
| 15 | `12-hanged.png` | 1024×1536 | RGB | 3782432 | `ee1b87a6e6c56a6f68f163c3b42c100981b8dcf0f73e5b9c23dcca174315bec2` | 未確認 |
| 16 | `20-judgement.png` | 1024×1536 | RGB | 3635119 | `9c8b4e1884e85b7b913fe1d7bede208743c2e1649bd105fb9af178af18c9729d` | 未確認 |
| 17 | `21-world.png` | 1024×1536 | RGB | 3333762 | `efd23bad035e1fba55c33c7ef2999052d7d4b61f945ae1e6cc53ab913c3ef544` | 未確認 |
| 18 | `11-justice.png` | 1024×1536 | RGB | 3934089 | `8e587a32c2761e3d8b58868787a0d9b024faf777a608d369f42ba1cc3de74fd6` | 未確認 |
| 19 | `07-chariot.png` | 1024×1536 | RGB | 3793456 | `88d3df63fa6948d95436503665fd037c09f6b26c5c25fd386eba3c6b5a8b21a6` | 未確認 |
| 4 再試行2 | `03-empress-attempt2.png` | 1024×1536 | RGB | 3842933 | `53521d2dcb4fdab638c6ef2cd40c1fab0ff31cfe8bf2bf439abdec2dc4eaf576` | 未確認 |
| 4 再試行3 | `03-empress-attempt3.png` | 1024×1536 | RGB | 3494466 | `37c0d8b41bcc48ca2f9fa373c9cc851fb833bf5865fdef8507226dd42f02c851` | 未確認 |
| 8 再試行2 | `10-wheel-attempt2.png` | 1024×1536 | RGB | 3748189 | `456efa487de9bb4fef3ccd0117e72127bffc2ccaccedf3492f24d04085366f0d` | 未確認 |
| 8 再試行3 | `10-wheel-attempt3.png` | 1024×1536 | RGB | 3870297 | `a620d5c352c7aa2ee7dbc86defb79fa717d2ecbcb4acee8cfa05e290b4b96941` | 未確認 |

## 採用候補と CHECK

初回候補19枚を実寸・破損確認済み。`03-empress` と `10-wheel` は同一プロンプトで各3回生成。`03-empress` は2回目、`10-wheel` は3回目を採用候補に選定。上表は生成時の実測記録で、下表は最終候補の実測値。再試行原画は単元フォルダの `presentation/` に保持。

| # | 最終候補 | 実寸 px | bytes | SHA-256 | CHECK |
|---:|---|---:|---:|---|---|
| 1 | `09-hermit.png` | 1024×1536 | 3900537 | `bb3a65558ffe751f74cfe19e7199e7d780c0b116ad9a60cf42678e84f00625b9` | PASS |
| 2 | `01-magician.png` | 1024×1536 | 3821834 | `fa41090aff2283e839a5b6cd67d104dc7b174a7ba12371054830878b69243c26` | PASS |
| 3 | `06-lovers.png` | 1024×1536 | 3742539 | `57520f3e244630ca553f2e70272434fda87b323ef241a28ec8280a07e996582a` | PASS |
| 4 | `03-empress.png` | 1024×1536 | 3842933 | `53521d2dcb4fdab638c6ef2cd40c1fab0ff31cfe8bf2bf439abdec2dc4eaf576` | 未達: 星11個（3回中の最良候補） |
| 5 | `17-star.png` | 1024×1536 | 3547016 | `1d2fc467a5391d40fcbccb9aacde59482e335702168583937b6616899f01d0a0` | PASS |
| 6 | `02-high-priestess.png` | 1024×1536 | 3968807 | `21862b27c68f8a695e3ce2b32d4cef29c105bca22e3feb2ddc11d09d6f1b7173` | PASS |
| 7 | `08-strength.png` | 1024×1536 | 3689175 | `867c8c671d0792e8babd5f665fd50318ccfcf85595a467db22b22f362fe7a94f` | PASS |
| 8 | `10-wheel.png` | 1024×1536 | 3870297 | `a620d5c352c7aa2ee7dbc86defb79fa717d2ecbcb4acee8cfa05e290b4b96941` | PASS |
| 9 | `19-sun.png` | 1024×1536 | 3353516 | `a525181338f63e8c6657307e769b4ecf71518e905145f7e040e707e3fc81198f` | PASS |
| 10 | `05-hierophant.png` | 1024×1536 | 3757301 | `6511cc18bf351ce563325ed891e415ec820e184b8ddb3c33b54d0e02bb960d02` | PASS |
| 11 | `18-moon.png` | 1024×1536 | 3650323 | `4f15c05e4eab5a5358e587b00a8ecb1b307780969da3c190a2bd967aaca7cc8e` | PASS |
| 12 | `00-fool.png` | 1024×1536 | 3649434 | `be90df16c79a9a908fa4664c9dbc3c02625032d5415e895f61cf9c3c08b630c3` | PASS |
| 13 | `14-temperance.png` | 1024×1536 | 3856253 | `c12fb6a723f7240970751d7fde59f890383d0d4b47f0ee6a48f0be4a9bf04510` | PASS |
| 14 | `04-emperor.png` | 1024×1536 | 3973219 | `289fab6c4a5b840c0d705cf3e05c0a9c2b160cec68268d4ff192ee22c0a58205` | PASS |
| 15 | `12-hanged.png` | 1024×1536 | 3782432 | `ee1b87a6e6c56a6f68f163c3b42c100981b8dcf0f73e5b9c23dcca174315bec2` | PASS |
| 16 | `20-judgement.png` | 1024×1536 | 3635119 | `9c8b4e1884e85b7b913fe1d7bede208743c2e1649bd105fb9af178af18c9729d` | PASS |
| 17 | `21-world.png` | 1024×1536 | 3333762 | `efd23bad035e1fba55c33c7ef2999052d7d4b61f945ae1e6cc53ab913c3ef544` | PASS |
| 18 | `11-justice.png` | 1024×1536 | 3934089 | `8e587a32c2761e3d8b58868787a0d9b024faf777a608d369f42ba1cc3de74fd6` | PASS |
| 19 | `07-chariot.png` | 1024×1536 | 3793456 | `88d3df63fa6948d95436503665fd037c09f6b26c5c25fd386eba3c6b5a8b21a6` | PASS |
