# くじ二重購入・LIME通常返信二重確定の実画面証跡（過去資料）

> 2026-10-18時点の再現記録です。LIMEは `6b2540c8`、くじは `982e27ee` で対策済みです。以下の数値・画面は修正前の観測結果で、現行の不具合や作業指示を示しません。Issue予約制度も2026-10-23に廃止されています。

再現SHA: `913520169855dbe90208fdfd8d7186bb88abf4e1`。
PC Chromium `154.0.8037.57`、1280×720、通常速度・通常motion。
各ケースは新しいブラウザcontextと隔離したテストセーブ。実通貨・実ユーザーのセーブを使用していない。
初期状態の準備を除き、実入力で操作。内部runItem/onclickの直接呼出しを実操作再現として使用していない。

元は再現調査の証拠保存専用ブランチで記録しました。ここには修正コードを含めていません。

## くじ（既存Issue #598への追加証拠）

同一の入力安全性要件が既に#598にあるため、別の修正Issueを作らない。
現行version2の有効な50枚箱（景品・lastOne snapshot込み）、有効枚数を保った固定順で比較。
所持金30,000円、対象drawn=0。

|対象|入力|最終money|drawn|結果カード|
|---|---|---:|---:|---:|
|500円|Tabフォーカス→Enter 1回|29,500|1|1|
|500円|Enter 1回＋演出中4回|27,500|5|1|
|1000円|Tabフォーカス→Enter 1回|29,000|1|1|
|1000円|Enter 1回＋演出中4回|25,000|5|1|
|500円最小再現|Enter→約128ms後Enter|29,000|2|1|

期待: 演出中の追加入力を拒否し、料金・drawn・景品は1回分のみ。
実際: 最初の演出中も背後の購入buttonがactiveElementのままで、各Enterが実購入になる。
500円は`[data-test="kuji-g500"]`、1000円は`kuji-g1000`にフォーカスが残る。
結果overlay/cardは置換され1枚のままなので、購入回数を見た目から把握しにくい。

獲得物:
- 500円単発: 限定コラボ・ガラスハガル1個。
- 500円5回: 同ハガル1個・ステンレストング2個・シリコンホース2個。
- 500円最小2回: 同ハガル1個・ステンレストング1個。
- 1000円単発: `home_rig_pro`。
- 1000円5回: `home_rig_pro`・クリアパイプ1個・grape100g・rose100g・mint50g。
  既存double_apple50gは不変。前回チャットの「葉の在庫変化なし」は誤りで、本JSONに訂正。

保存: `suien_remake_save`へmoney・drawn・景品/在庫が同じ値で記録。箱順は不変。
原因候補: kuji.jsの購入onclick/drawが演出前の同期ロックを持たず、演出開始時のfocus隔離もない。

最小操作: ショップ1F→くじタブ→Tabで購入ボタンへ→Enter→最初のガラガラ演出中にもう1回Enter。
当時の最小修正候補範囲: `remake/js/daily/kuji.js`と専用入力回帰テストのみ。

受入条件:
- 両価格で単発とEnter反復/同一ターン二重入力のmoney/drawn/実景品/保存値が1回分で一致。
- 表示中の追加入力で別購入や結果カード置換を起こさない。閉じた後の新たな明示購入は1回分だけ成立。
- 箱順、残数、金不足/空箱拒否、現行/旧箱の既存保存仕様を維持。
- 価格・景品・箱仕様・共通state/shop/stylesは変更しない。旧handler/破棄後の作用も専用回帰で拒否。

証拠: [500円最小の画面](kuji-500-minimal.png) / [短録画](kuji-500-minimal.webm) / [保存JSON](kuji-500-minimal-save.json)。
[1000円反復の画面](kuji-1000-repeat.png) / [短録画](kuji-1000-repeat.webm) / [保存JSON](kuji-1000-repeat-save.json)。
[通常と反復の数値・focus・カード数](kuji-summary.json)。

環境内原本: `/workspace/work/kuji-qa/results-current-box/`、`/workspace/work/kuji-qa/results-minimal/`。
予備の`/workspace/work/kuji-qa/results/`はfixture不備があったため本証拠から除外。
商品画像8点は既存cache不足でfallback表示、入力本体/演出/保存は実装のまま。実機Safari/タッチ未検証。

## LIME通常返信

対象: DAY5 `lime_minto_day5`「頑張ります」（定義affinity=1）。恋人・特別招待・ひよりではない。
初期好感度10、端数0.50。現行の0.85倍/端数繰越は変更せず記録。

|記録|通常1回|返信中に戻る→再入室→同返信|
|---|---:|---:|
|1点返信の処理回数|1|2|
|好感度整数|10→11|10→12|
|端数|0.50→0.35|0.50→0.20|
|整数＋端数の進捗差|+0.85|+1.70|
|自分「頑張ります」履歴|1|2|
|相手「うん、お互いにね」履歴/画面|1/1|2/2|
|最終read/done|true/true|true/true|
|replyState|replied|replied|
|limeRead内の対象ID|1|1|

最小操作: HUDのLIME→みんと→未返信会話を読む→「頑張ります」を実クリック→相手の「…」中に左上戻る→みんとへ再入室→同じ返信を実クリック。
最終実測: 初回返信=0ms、戻る384.6ms、再入室461.3ms、同返信859.0ms。全clickはisTrusted=true。
再入室時はread=true/done=false/replyState=waiting。古い処理が約575.2msにdone=trueとしても、
表示済みの選択は残り、約1825.2msにもう一度好感度が加算される。
期待: 1メッセージは1回だけ確定し、再入室/古い待機処理から二重報酬・二重履歴にならない。
実際: 返信・相手返答・報酬が2回。実操作でスマホを閉じると本編の保存経路で同じ重複が永続化される。

原因候補: phone.js runItem通常返信はui.chooseの前のdone判定後、待機後の確定状態再判定がない。
画面世代の確認は選択直後だけで、mine/theirs待機後の報酬/確定前に再確認されない。
キャンセルされた古い画面処理と、新画面の返信選択待ちが両方進行する。

当時の最小修正候補範囲: `remake/js/daily/phone.js`と独立した通常返信回帰テストのみ。

受入条件:
- 通常返信単発と「相手typing中に戻る→再入室→同返信」で報酬・履歴・返答が各1回に一致。
- 260ms前後/相手typing中/返答表示後の戻る・閉じる・再入室、選択待ち中に別処理がdoneになったケース、二重入力を拒否。
- read/limeRead/replyStateと実close保存が整合し、正常な未確定返信は再開できる。
- 古い画面/別セーブへの差替え後に旧非同期処理が新状態へ報酬/履歴を与えない。
- 好感度値・倍率・端数仕様・特別招待・ひよりイベント・CSSを変更しない。

[再現画面](lime-back-reenter.png) / [約12秒の短録画](lime-back-reenter.webm) / [保存JSON](lime-back-reenter-save.json) /
[比較・操作時刻](lime-summary.json) / [通常/再現のイベントログ](lime-events.json)。pageerror/失敗resourceは0。
環境内原本: `/workspace/work/lime-reply-qa/results-final/`。
