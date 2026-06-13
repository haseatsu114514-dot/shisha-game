# PUFF!PUFF!パッキー（日常リール）— 仕様書 兼 組み込み手順書

**ステータス: 本編接続済み（2026-06-13）**。
ブラウザ版 ch1/ch2 の日常パートで稼働中。接続箇所は §10／`docs/pakki_slot_install_guide.md`、
動作確認用の試打台は `web/reel_demo.html`。確率の再調整はいつでも下記の定数で可能。

| ファイル | 内容 |
|---|---|
| `web/js/reel.js` | 本体（抽選コア＋ウィジェット＋演出）。単体で完結 |
| `web/css/reel.css` | スタイル。組み込み時に style.css へ連結する |
| `web/test/reel.mjs` | 抽選コアのテスト（node単体、ブラウザ不要）。`node web/test/reel.mjs` |
| このファイル | 仕様の正典＋組み込み手順 |

---

## 1. コンセプト（オーナー決定事項・2026-06-12）

- **Aタイプ＋天井**。ジャグラー型の完全告知1本——「パッキーの顔（ランプ）が光ったら大当たり」。
  スマスロ的なAT・上乗せ・ハラキリ系演出は**不採用**
- C.STATION公式マスコットアプリという体ではじめのスマホに入っている。
  **1行動=1回転**：日常パートで行動を消費するたび、マップ隅のミニ筐体が裏で1回転
- **お助けガチャ**：当たらなくてもクリアできる。外れても最低+1、天井で最終的に全員救われる
- **恩恵はステータスのみ**（現金・アイテムは出さない。「生々しい」ため廃止）。
  伸びる対象は**直前の行動で伸びたステータス**＝行動のアンコール抽選
  （行動がステを伸ばさなかった場合は一番低いステ。家シーシャと同じ思想）
- **初回のみパッキーがアプリの説明**をする（4行・タップ送り・1セーブ1回）
- リセマラ不可：抽選は決定論RNG（シード＋総回転数）。行動した瞬間に結果が確定保存され、
  ロードしても同じ結果が再生される

## 2. 図柄と役構成

リールは3本×16コマ（`STRIPS`）。中段が有効ライン。
ボーナスは**ハズレ目で止まってランプが教える**（ジャグラー流）。揃えるのは精算演出の中。

| 図柄 | 役 | 確率（基本） | 恩恵（対象ステへ） |
|---|---|---|---|
| ☁ 煙（ブランク） | ハズレ | 68.2% | **+1（サイレント）**＝最低保証 |
| 💧 リプレイ（水の青） | 再遊技 | **1/7.3**（実機オマージュ） | +1（サイレント）＋即もう1回転（連鎖上限4） |
| 🍒 チェリー（角） | 小役 | 1/9.1 | +2「少し上がった」 |
| └ チェリー**重複** | 同時当選 | チェリーの**約1/16** | 小役の後にひと呼吸おいてペカッ（BIG 45% / REG 55%） |
| 🍍 パイナップルのベル | レア小役 | 1/83 | +3「上がった」 |
| BAR | REG | 1/41.7 | +4「上がった」 |
| 赤7 | BIG | 1/38.5 | +6「大きく上がった」＋ジャグ連ゾーン |
| 🍒中段 / ぷ単独（パッキー柄） | **プレミア** | 1/200 | BIG確定（+6）＋虹ランプ告知 |
| （フリーズ） | ロングフリーズ | 制御役（§5） | +8「大きく上がった」＋ゾーン＋殿堂入り記録 |

1章=14日×2行動=**約28回転**しか回せない前提で逆算した数字（オーナー指示:
「回数に限りがあるので小役確率は慎重に」「天井もあるので程よくシブめに」）。
名目のペカ合算は **約1/15**。2026-06-12 にチェリー重複 1/8→1/16・REG/BIG/プレミアを
一段絞る再調整を実施。テスト実測の1章あたり期待値：

```
ハズレ18.7 ／ リプレイ3.9 ／ チェリー3.1（うち重複0.2） ／ ベル0.35 ／
REG 0.85 ／ BIG 1.0 ／ プレミア0.13 ／ ペカ合算 約2.1回
（長期実測 1/13 — ジャグ連・天井・裏確変込み。名目は1/15.2）
リール由来の総ステ上昇 ≒ 41pt/章（※リッチなら EFFECTS の exp を絞る。§9）
```

**フルプレイ体験値（28回転×4章=112行動を2万周シミュレート、2026-06-12実測）**:

```
ペカ総数         平均10.1（下位10%でも7回。リプレイ・ジャグ連・救済込みの体感値）
ペカ0の章        5.2%（持ち越し天井が次章序盤で拾う）
最大ハマり       中央値34G（天井40Gに「届きそうで届かない」を大半が体験、到達は32%）
ジャグ連体験     86%が1回以上（平均2.4回）
プレミア体験     98%が何かしら1回以上
  ├ フリーズ     46%（設計どおり「1プレイで1回あるかないか」）
  ├ 中段チェリー等 48% ／ チェリー重複 60%
  └ 先プカ73% ／ 遅れプゴッ66% ／ 無音回転60%
リール由来ステ   1プレイ合計 約190pt（±20）
```

## 3. 天井（持ち越し制）

| 種類 | 条件 | 保証 |
|---|---|---|
| ゾーン天井 | **8連続ハズレ** | 次の回転が小役以上（格上げ抽選。プレミアは出ない） |
| 本天井 | **ペカ間40回転** | 次の回転がペカ確定（REG/BIGの相対weight。「おたすけパッキー！」） |

- カウントは**日・章をまたいで持ち越す**（昨日のハマりが今日の期待になる）
- 表に数字は出さない示唆型。プレミア（フリーズ・中段チェリー）は天井救済からは**出ない**＝直撃のみ

## 4. ジャグ連ゾーン

BIG級（BIG／プレミア／重複BIG／フリーズ）の後**5回転**は REG/BIG の weight が**×1.5**
（増加分はハズレから移譲）。実測の連チャン感はテストログで確認できる。

## 5. フリーズ制御 —「完全確率に見せかけて管理」（オーナー指示）

ゲーム通して**1回あるかないか**にするための見えない制御。抑制・昇格ぶんの weight は
BIG に折り込むため、**外から見たペカ合算は常に一定**（テストが検算している）。

| 状態 | フリーズ weight |
|---|---|
| 序盤（総回転 < 20） | 0（序盤に+8が出ると強すぎるため） |
| 通常 | 4/1000（1/250） |
| 総回転110以上で未取得 | **12/1000（1/83）に裏昇格**＝引き弱でも終盤に出会える |
| 1回取得後 | **0（1セーブ1回まで）** |

演出：回転が「ガッ」と止まる→全SE消失→EN:CODEグリッチ（「運命、再コンパイル中……」）→
FREEZE BONUS＋パッキー乱舞→赤7揃い→「殿堂入り！スロノートに刻まれた」。
取得日は `state.reel.note.freezeLog` に永久記録（章・日・回転数）。

## 6. 裏確変（引き弱救済）（オーナー指示）

生涯ペカ数が期待値（回転数×7.5%）の**55%を割っている**と、こっそり REG/BIG weight を
**×1.7**（ハズレから移譲）。総回転30未満では発動しない。表示・示唆は一切なし。
決定論RNGなので「ロードして救済を引き直す」こともできない。

## 7. 告知バリエーション（プレミア演出）

ペカ時に variant を抽選（フリーズ・プレミア役は専用）：

| variant | 率 | 内容 |
|---|---|---|
| 後プカ | 64% | リール停止→ペカッ＋「ぷぷぷっ！」（基本） |
| 先プカ | 14% | レバオンで光る |
| 遅れ | 12% | レバオン後に低い「……プゴッ」（ガコッのパロ） |
| 無音回転 | 10% | SEが消えてスローに回る＝プレミア告知 |

- **ガックン**：章の最初の1回転だけリールがガクッと揺れる（リセット判別の小ネタ）
- 中段チェリー/単独パッキー：プゴッ→**虹ランプ**（BIG確定）
- ランプは点いたまま放置可。タップで「赤7（/BAR）を狙えっ！」→3コマ点灯→ファンファーレ。
  放置しても次の回転前に自動精算（報酬は取りこぼさない）

## 8. 表示ルール・テンポの整合（CLAUDE.md準拠）

- ステ数値は見せない。バナーは既存 gainBanner の3段階表現（+1〜2=少し／+3〜4=上がった／+5+=大きく）
- ハズレ/リプレイ/の+1は**サイレント**（毎行動バナーが出るスパムを防ぐ）
- ハズレの演出は約0.3秒で終わる（テンポ最優先）。CONFIGに「スロット演出 フル/簡易/OFF」を追加
  （OFFでも抽選と報酬は生きていて、バナーだけ出る）
- 演出はマップ画面でのみ再生。夜の行動分は翌朝マップで再生（結果はキューに永続化済み）

## 9. バランス調整のしかた

数字は全部 `web/js/reel.js` 冒頭の定数にまとまっている：
`ROLES`（weight/1000）・`EFFECTS`（exp）・`CEILING`・`JUG_REN`・`CHERRY_OVERLAP`・
`FREEZE_CONTROL`・`RESCUE`・`VARIANTS`。

- 分布確認: `node web/test/reel.mjs`（1章あたり期待値を出力）、または
  ブラウザのコンソールで `__reelDebug.simulate(100000)`
- 演出だけ確認: コンソールで `__reelDebug.force("big")` / `force("freeze")` /
  `force("rare")` / `force("cherry")` 等（カウンタ・報酬は動かない）
- 現状 exp 合計≒41pt/章はやや富裕。絞るなら `EFFECTS` の exp（特に miss/replay の+1は
  思想なので残し、ボーナス側を -1 ずつ）か、ペカ合算（reg/big weight）を下げる
- 長期実測（1/13）が名目（1/15.2）より甘く出るのはジャグ連・天井・裏確変のぶん。
  さらに絞るなら `JUG_REN.mult`（1.5→1.3）が次のノブ

## 10. 組み込み手順（GOが出たらこの順で）

> **実装者への引き渡しには `docs/pakki_slot_install_guide.md`（実行用の作業指示書）を使うこと。**
> 本節は同じ内容の要約版で、正は指示書側。
> 作業前に `docs/web_version_plan.md` の最新引き継ぎを読み、ブランチを確認すること。
> reel.js は game.js のグローバル（state / save / gainBanner / updateHud / STAT_KEYS /
> STAT_BADGE / config / faceIconHtml）を実行時参照する。読み込み順は engine.js の後・game.js の前。

### (1) index.html — スクリプト追加

```html
<script src="js/engine.js"></script>
<script src="js/reel.js"></script>   <!-- ← この行を追加 -->
<script src="js/game.js"></script>
```

### (2) CSS — style.css へ連結

```bash
cat web/css/reel.css >> web/css/style.css
```

（reel.css は原本として残してよい。二重連結にだけ注意）

### (3) game.js — 5箇所のフック

a. `newState()` の `practiceBest: {},` の直後に追加：

```js
    reel: (typeof REEL !== "undefined" ? REEL.newReelState() : null), // PUFF!PUFF!パッキー（日常リール）
```

b. `gainStat()` の `state.stats[en] = ...` の直後に追加（アンコール抽選の対象記録）：

```js
  if (typeof REEL !== "undefined") REEL.noteStat(en, amount);
```

c. `endAction()` の先頭（`state.ap -= 1;` の前）に追加：

```js
  // 1行動=1回転: 結果と報酬はこの場で確定して直後の save() に乗る（ロードしても同じ＝引き直し不可）
  if (typeof REEL !== "undefined") REEL.onAction();
```

d. `showMap()` 末尾の `save();` の直後に追加：

```js
  if (typeof REEL !== "undefined") REEL.onMapShown();
```

e. `continueGame()` の旧セーブ互換ブロックに追加：

```js
  // 日常リール（PUFF!PUFF!パッキー）導入前のセーブ互換
  if (!state.reel && typeof REEL !== "undefined") state.reel = REEL.newReelState();
```

さらに CONFIG：`const config = { textSpeed: 2, ... }` に `reelFx: "full"` を足し、
`showConfig()` のオート速度の行の下に追加：

```js
  seg("スロット演出", "reelFx", [["full", "フル"], ["lite", "簡易"], ["off", "OFF"]]);
```

### (4) sfx.js — リール用サウンドパック（推奨・無くても動く）

reel.js は存在しない SFX 名を黙ってスキップするので後回しでも可。入れる場合は
`pageTurn` の後・`setMuted` の前に貼り付け：

```js
    // ---------- 日常リール（PUFF!PUFF!パッキー） ----------
    reelLever: () => {
      blip({ freq: 900, type: "square", a: 0.001, d: 0.03, r: 0.05, peak: 0.10, filterFreq: 3200, wet: 0.15 });
      blip({ freq: 240, type: "triangle", a: 0.001, d: 0.05, r: 0.08, peak: 0.12, filterFreq: 1200, wet: 0.2, when: 0.01 });
    },
    reelStop: () => {
      blip({ freq: 1400, type: "triangle", a: 0.001, d: 0.03, r: 0.06, peak: 0.12, filterFreq: 4000, wet: 0.15 });
      blip({ freq: 320, type: "sine", a: 0.001, d: 0.04, r: 0.06, peak: 0.08, filterFreq: 1500, wet: 0.15, when: 0.005 });
    },
    puka: () => {
      // 告知「プカッ」: キュイン系の上昇音 + ベルの重なり + きらめき
      blip({ freq: 600, type: "sawtooth", a: 0.01, d: 0.30, r: 0.25, peak: 0.16, filterFreq: 5200, q: 2,
             wet: 0.5, slide: [520, 1860, 0.34] });
      [1175, 1568, 2093].forEach((f, i) =>
        blip({ freq: f, type: "sine", a: 0.003, d: 0.18, r: 0.45, peak: 0.16 - i * 0.03, filterFreq: 7000, wet: 0.55, when: 0.20 + i * 0.06 }));
      hiss({ dur: 0.4, a: 0.005, peak: 0.06, filterType: "highpass", filterFreq: 5000, wet: 0.6, when: 0.26 });
    },
    pugo: () => {
      // 遅れ「……プゴッ」: ガコッ系の低い衝撃音
      blip({ freq: 110, type: "square", a: 0.002, d: 0.14, r: 0.12, peak: 0.30, filterFreq: 600, q: 2, wet: 0.3,
             slide: [150, 78, 0.16] });
      hiss({ dur: 0.12, a: 0.002, peak: 0.16, filterType: "lowpass", filterFreq: 900, wet: 0.3 });
    },
    reelWin: () => {
      blip({ freq: 1319, type: "sine", a: 0.002, d: 0.10, r: 0.22, peak: 0.14, filterFreq: 6000, wet: 0.4 });
      blip({ freq: 1760, type: "sine", a: 0.002, d: 0.12, r: 0.26, peak: 0.10, filterFreq: 6000, wet: 0.45, when: 0.05 });
    },
    glitch: () => {
      for (let i = 0; i < 5; i++) {
        hiss({ dur: 0.05 + Math.random() * 0.06, a: 0.001, peak: 0.12, filterType: "bandpass",
               filterFreq: 800 + Math.random() * 4000, q: 4, wet: 0.25, when: i * 0.12 + Math.random() * 0.04 });
        blip({ freq: 300 + Math.random() * 2400, type: "square", a: 0.001, d: 0.02, r: 0.03, peak: 0.07,
               filterFreq: 6000, wet: 0.2, when: i * 0.12 });
      }
    },
    freezeBoom: () => {
      blip({ freq: 60, type: "sine", a: 0.003, d: 0.30, r: 0.40, peak: 0.32, filterFreq: 300, wet: 0.35,
             slide: [110, 48, 0.45] });
      hiss({ dur: 0.5, a: 0.003, peak: 0.14, filterType: "lowpass", filterFreq: 700, wet: 0.5 });
      blip({ freq: 880, type: "sine", a: 0.01, d: 0.4, r: 0.6, peak: 0.07, filterFreq: 5000, wet: 0.8, when: 0.15 });
    },
```

### (5) build_standalone.py — スタンドアロン版への同梱

`engine_js = ...` の行の下に：

```python
    reel_js = (WEB_DIR / "js" / "reel.js").read_text(encoding="utf-8")
```

`html.replace(...)` のスクリプト置換ブロックを、index.html と同じ並びになるよう
`js/reel.js` の行を追加した形に書き換える（engine の後に
`"<script>\n" + reel_js + "\n</script>\n"` を挟む）。

### (6) 既存playwrightテストへの対応（必須）

初回のアプリ説明 `#reel-intro` はモーダルなので、`playthrough.mjs` / `ch2.mjs` /
`screenshots.mjs` の各メインループ先頭（`#phone-overlay.show` の処理の直後）に追加：

```js
  // 日常リールの初回説明（パッキーのアプリ紹介）はタップで読み進める
  if (await page.locator("#reel-intro.show").count()) {
    await page.click("#reel-intro");
    await page.waitForTimeout(60);
    continue;
  }
```

ランプ・カットインは非ブロッキング（放置で自動精算）なのでテスト対応不要。
playthrough.mjs には回転の発生確認も足すとよい：

```js
const spins = await page.evaluate(() => state.reel && state.reel.count);
if (!spins) throw new Error("daily reel never spun");
```

### (7) 仕上げ

```bash
node web/test/reel.mjs                 # 抽選コア
python3 web/build_data.py && python3 web/build_standalone.py
npx http-server -p 8123 &              # リポジトリルートで
node web/test/playthrough.mjs && node web/test/screenshots.mjs && node web/test/ch2.mjs
```

## 11. 設計メモ（既知の割り切り）

- 報酬は**行動した瞬間に確定適用**（演出は後追いの祝祭）。演出前にリロードしても損はしないが、
  ペカの祝祭演出だけは飛ぶことがある（報酬は適用済みなので実害なし）
- リールのウィジェットは `#screen-map` 常駐・通常 pointer-events:none（ランプのみ押せる）。
  マップ左下（x=14px, y=bottom14px）はピン配置と干渉しない位置
- パッキーの顔は `D.face_icons.packii`（無ければ「ぷ」フォールバック）。図柄は絵文字/CSSの
  プレースホルダ——本番ドット絵に差し替える場合は `SYM_HTML` を書き換える

## 12. Phase 2 候補（未実装・アイデア置き場）

1. **設定1〜6＋設定看破**: 日替わり設定を `f(シード, 日付)` で決定論生成、
   DAYカードのパッキー一言・ランプ色・ベル確率で示唆
2. **スロノート画面**: `state.reel.note`（BIG/REG回数・合算・フリーズ殿堂入りログ）は
   既に記録している。スマホUIに履歴画面を足すだけで「自分の引きを観測する」遊びになる
3. ギャラリー連動（フリーズ取得で限定CG解放）／タイトルおまけモードでの試打台
