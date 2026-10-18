# #574 店ロゴの位置・緑の見え方

比較元main: `bac72b40c38ac0d4b6982da7d2eeb517ce746cdb`。
検証コード・CSS・原画のSHA256は[source-hashes.json](source-hashes.json)。完全な検証HEADはPRに記録する。

## 変更

- 看板の上下paddingを6/8pxから10/4pxへ振り替え、ロゴだけを4px下げた。看板外形・店名プレート・地図座標は固定。
- 横長ロゴ92pxに対して看板の内幅は88pxだった。Gridの列の最小幅を0にし、Dr.fookah・PEPPERMINT・KEMURIKUSAの2px右ずれを修正。Dr.fookahの元表示窓の左右alpha余白は15/16pxで、画像自体を切り直す必要はなかった。
- PEPPERMINTの元文字は既に暗緑。地図上の画像だけにbrightness(2)/saturate(1.25)を適用し、緑を読み取りやすくした。原画・形・店名・透過・入店表示は保持。

## 同一条件の変更前後

Chrome、seed=574、DAY4、全店主と面識あり、C.STATION通知、昼slot0/夜slot1。PC1280×720、タッチ844×390。beforeは比較元mainのCSSだけをレスポンス差し替えし、他コード・fixture・画像はafterと同一。JPEG品質80で撮影。新規イラスト生成・原画加工なし。

| 条件 | 変更前 | 変更後 |
| --- | --- | --- |
| PC昼 | [画像](before/pc-day.jpg) | [画像](after/pc-day.jpg) |
| PC夜 | [画像](before/pc-night.jpg) | [画像](after/pc-night.jpg) |
| タッチ昼 | [画像](before/touch-day.jpg) | [画像](after/touch-day.jpg) |
| タッチ夜 | [画像](before/touch-night.jpg) | [画像](after/touch-night.jpg) |

[実測差分](comparison.json)：全7ロゴ×4条件で下げ幅4px、店名プレート差0px。横長3店の中心ずれ2px→0px、他店も0pxを維持（端末の縮小誤差を除く）。C.STATIONのロゴ下端から店名プレートまで18→14px。

8枚を目視し、C.STATIONの間隔、Dr.fookahの中心、PEPPERMINTの緑・文字の可読性を確認した。

## 検証

- `node remake/test/browser/store_logo_layout.mjs`: PC/タッチ/狭幅591×1280の昼夜6ケースPASS。実ロゴの中心・画像読込・人物/通知との非重複、選択時の拡大、実クリック/タップ、入店前vetoで資源/保存不変、schema11相当の合成fixtureを実loadへ通した復帰、現schema再保存/再load、既存locked判定の「？」を確認。
- 同テスト内でPC/タッチの通常/AUTO/SKIPによる短い合成会話を実engineで送り、地図復帰と保存不変を確認。全章通しの代替ではない。
- `node remake/test/store_logos.mjs`: 既存18 UIケースPASS。7ブランド、実入店、遅延後の来店、匿名人物、SKIP/軽減、予約持越し防止、画像取得失敗時の名前fallback、pageerrorなし。
- 構文・`python3 tools/check_agent_docs.py`・`git diff --check`・Git Safety PASS。
- 原画7PNGのハッシュを記録。production差分は`remake/css/store-logos.css`のみ。

実行ログ: [専用回帰](574-layout.log)、[既存回帰](574-existing.log)。実機スマホ/Safari・全章通し・公開版QA・#481のDraftとの統合実行は未実施。

再現（repo root、localhost:8123で配信中）：

```sh
CHROME_EXECUTABLE_PATH=/usr/bin/chromium ARTIFACT_DIR=work/logo-layout node remake/test/browser/store_logo_layout.mjs
git show bac72b40c38ac0d4b6982da7d2eeb517ce746cdb:remake/css/store-logos.css > work/logo-before.css
MODE=before BASELINE_CSS=work/logo-before.css ARTIFACT_DIR=work/logo-before node remake/test/browser/store_logo_comparison.mjs
MODE=after ARTIFACT_DIR=work/logo-after node remake/test/browser/store_logo_comparison.mjs
```

## 予約・編集境界

worker `codex-574-map-20261018-9d4c7b21`、claim run `39078759844`成功、実CLAIMED_ISSUEと最新bot台帳6243022715のowner/run一致を確認後に編集。

#577本人回答6243083900でmap表示/store CSSの未公開差分・予定なしと確認。#577の解禁・保存は変更しない。#481は公開head `018a26193b94e9131a4984339fade9ecc1a35445`、map.js/street.js/daily.cssを保持。照会6241227660は未回答で、返信なしを合意・実停止とは扱わない。公開差分と重ならないCSSだけ先行した。

#579の本編接続・#590のタイマー/体力は未実装。既存予約を保持し、担当回答または正式移管を待つ。
