# スマホ横持ち制作UI・静的配置確認 (#756)

## 対象と限界
最新main `7d8e1f81ab47d244134666d38d1b5c910b180b83`（0fefからの#751差分は今回の入力ソースと非重複）のCSS、および`steps.js` / `session.js` / `audience.js` / `thermometer.js`に対応する**実DOM構造の隔離static fixture**。本編進行・制作フロー・第1章試遊は実行していない。純粋な`text.js` / `budoux_ja.js`の改行helperと`audience.js`のwrapNoteと同じ処理だけをcomponent内で実行する。画像はplaceholder、同梱fontは取得せずsystem fallback。保存画像は実ゲーム画面ではない。

CSSはスマホ横持ち (landscape / <=1024px / <=520px / coarse pointer / hover:none) と通常表示だけに適用。setup/mix/pack/placeの4工程。setupは機材gridがある場合だけで水入れ#743は別境界。将来の水入れDOMは決定後に再照合が必要。

スマホにDSを自動適用するコードはない。保存キー`suien_title_layout`が厳密に`ds`の場合だけDS、既定はnormal。明示DS設定済み端末へは今回のCSSを適用せず、設定も変更しない。

## sourceの境界
setup/pack/placeは左幅260設計px、右を278設計pxからとして説明/操作へ幅を渡す。今回調整した本文は実表示14px、主要選択/確定操作は44px以上。packは元の器の最低300設計pxを保ち、器/3選択肢を横並びにし、下段stickyの確定footerを初期表示に残す。captionは独立scroll。

mixは内部の説明・一覧scroll・増減/確定だけ。外枠座標/幅/overflow、ヘルプ、適温プレビュー/legend/labelとclip祖先は前後不変。器300x332設計pxも保持。既存mixヘルプと左人物欄は今回のサイズ調整対象外で、844×390では人物本文約8.67px、guide約18pxの既存サイズが残る。これらの共通説明/ガイド改善は#694/#703等との担当調整待ちで、全ての文字14px/全操作44pxを保証する変更ではない。

人物欄の顔/名前/headingは省略しない。setup/pack/placeだけ、顔と名前を上段、本文を下段全幅へ再配置する。高さ280設計pxとworker名札bottomを同じCSS変数に結び、名札/顔/名前/本文が親内で互いを覆わないことを確認する。本文はmin-height:0の独立scroll領域で、長い実文も最後まで到達できる。

FOIL/HEAT/timer/steam/pull/care/serve、DS、VN2px、共通button、採点/熱モデル、#732炭発光/授業/トング、#703温度計条件、水入れ、新素材候補は対象外。追加依頼4全体の完了ではない。

## P2修正と回帰証拠
旧head `f18fa461` のfixtureは顔/headingを省いていたため、説明クリップを見落としていた。この旧fixtureを最終検証の根拠にはしない。

更新fixtureは`audience.js`のaside / people / figure / face / img / figcaption / speech / heading / rating / name / caption / noteと、実際の工程briefを使う。sourceと同じ純粋autoWrapでbrを生成する。

f18相当CSSを新fixtureの844x390 packへ適用すると期待どおりFAIL：実文「詰め方を見比べて決めよう。迷ったらノーマル」でnote幅59.58px、高さ121.77px、clientHeight=scrollHeight=225。自身でscrollできず親外へ出る。修正後は本文幅115.92px、note高さ91pxで親内に収まり、顔44.42px角・headingも表示される。長い本文だけnote内scrollとなる。

## 最終検証
`node tools/test_craft_landscape_static.mjs`。既存system Chrome / Node CDP pipe、依存追加なし。`CHROME_BIN` / `CRAFT_CACHE` / `CRAFT_ARTIFACTS`で経路指定可。既定成果物先は`/tmp/shisha-craft-landscape-static`。生成profile/cacheはGitHub保存対象外。

41条件PASS：基本38条件＋本番ヘルプの長い実文をnoteへ置くcomponent stress case3条件。

- setup / mix-hidden / mix-visible / pack / place × PC1920x1080、mouse844x390、coarse844x390・915x412・740x360、DS = 30条件。
- 対象外7工程 + setup-water非一致DOM = 8条件。
- 長いpack実説明 × coarse3寸法 = 3条件。
- 今回変更対象の本文14px、主要選択/確定操作44px以上、カード/子要素非重複、pack初期3択/確定可視、末尾scroll/focus。
- 人物欄の顔/heading/note/worker名札が親内で非遮蔽。長文noteへChrome合成touch gestureでscroll末尾まで到達し、独立scroll領域へfocusも可能。実機の証明ではない。
- 祖先touch-actionはmanipulationでnoneによる阻止なし。対象工程のmain/session/steps/core UI/utilにscrollを止めるpreventDefaultは見つからない。章移行専用swallowは対象componentのものではない。
- mixのpreview表示/hidden両方で外枠/ヘルプ/プレビュー/ラベル/clip祖先不変。stage倍率/寸法も不変。
- PC・mouse狭画面・DS・対象外工程/水DOMは前後geometry完全一致。更新したPC mix/pack前後のWebPをPillowでpixel比較し1920x1080完全一致。
- 8枚の最終前後画像はすべて実人物欄DOMへ更新済み。旧い簡略DOMや初稿画像は保存していない。

詳細は`summary.json`。8枚WebPはPCと844x390のmix/pack前後だけ。旧headの期待FAILもcompact記録へ保持する。

## 未実施
実素材/同梱fontの本編表示、実機iPhone/Safari、制作フロー・SAVE/LOAD・AUTO/SKIP・全章/第1章試遊は未実施。Chromeのcoarse/touch emulationとnative focusは他ブラウザ/実機の証明ではない。

source commitは`[skip ci]`。CI・依存/browser installは起動せず、CIをPASS扱いしない。API非checkoutのためlocal Git root/hooks検査は対象外。更新branchの期待head/最新main/元tree/予約を照合し、同じDraft PRへ保存する。
