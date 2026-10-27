# Issue #582: playthrough purchase confirmation

Scope: driver only; runtime, data, rewards, seeds and save/load flow unchanged.
Dedicated branch base: `1d19f2be95aabbf8376acc1c09e8bd2143cdf967`.
Claim/status supplied and verified by parent: claim `38743415060`, worker
`codex-b-582-20261015-455464dfbc`, resume status `38746812542` SUCCESS.

## Evidence and limits

Before this change, the map incremented `planIdx` before shop navigation, ignored
the boolean checkout click result, then unconditionally cleared `pendingShopBuy`.
Thus a failed checkout could lose the lemon plan; this is a driver failure path,
not proof that it caused the reported main failures or proof of a runtime defect.
The existing final lemon/practice/preparation assertions remain intact.

The real driver now uses `purchasePlannedFlavor`: selection must produce quantity
1, checkout must return true, screen/day/slot must stay consistent, stock must
increase by 50g, ownership must be present, money must fall by the loaded price,
and cart quantity must become zero before consuming the plan. Any failed input or
unexpected state stops the run without consuming the purchase plan. There is no
automatic retry or injected inventory/money. Shop navigation failures also stop.

Node regressions inject false tab/buy/checkout clicks, a screen transition, a
successful click with no purchase, and wrong payment. All preserve the plan and
report incomplete. Other cases cover successful consumption, existing lottery
stock not counting as purchase, and rejection of a preselected cart.

## Validation

- PASS: `node --test remake/test/playthrough-shopping.test.mjs` (9 tests).
- PASS: `node --check remake/test/playthrough.mjs`.
- PASS: `node --check remake/test/playthrough-shopping.mjs`.
- PASS: `git diff --check`.
- FAILED (pre-existing, untouched): `python3 tools/agent_quota_guard.py check codex`,
  SyntaxError on line 45.
- NOT RUN here: browser direct/street; localhost bind and Chromium are prohibited
  by this session's known runtime constraints. Parent performs authorized runs.

## Parent browser runs

Parent verification (2026-10-15 JST): Node 24.13.0 on macOS, Playwright 1.62.1,
Chromium 151.0.7922.34. The reported CI used Node 22.23.3. Codex B retained its
workspace-write sandbox; the parent ran headless tests through separately
approved terminal execution with an isolated browser and localhost server.
No user browser/profile was used.

- Unmodified main direct: PASS once, including lemon 50g. This baseline did not
  reproduce the reported intermittent CI failure; it does not disprove it.
- Modified direct: PASS, including defeat/retry/win, save/load and original asserts.
- Modified street: PASS, including street entrances and the same original asserts.
- Both observed lemon stock 0g -> 50g and payment 1,550 yen before plan index
  advanced 19 -> 20 and pending purchase cleared. No forced stock/money changes.
- Parent independently reran all nine Node regressions and syntax/diff checks.
- Agent-docs check PASS after fetching existing main Markdown and its internal
  reference symlink excluded by sparse checkout; those reference files unchanged.

The actual historical CI failure cause and whether any runtime fault exists
remain unproven. These tests establish the repaired failed-input handling and
successful current direct/street purchases without weakening final assertions.

Portable run commands, retaining the prepared PLAYWRIGHT_BROWSERS_PATH:

```sh
QA_DIR=/tmp/shisha-582-qa
mkdir -p "$QA_DIR"
NODE_PATH="$PWD/remake/test/browser/node_modules" BASE_URL=http://127.0.0.1:8132/remake/ STREET_MODE=0 node remake/test/playthrough.mjs > "$QA_DIR/direct.log" 2>&1
NODE_PATH="$PWD/remake/test/browser/node_modules" BASE_URL=http://127.0.0.1:8132/remake/ STREET_MODE=1 node remake/test/playthrough.mjs > "$QA_DIR/street.log" 2>&1
```

Log interpretation:

- `shopping-plan`: plan index/pending item and screen/day/slot at navigation.
- `shopping-click`: selector, boolean result/error, plan index/pending item and
  state immediately after input, including money and stock.
- `shopping-purchase`: each input's before/after state; only `completed:true`
  means confirmed purchase (index advanced and pending item cleared).
- `shopping-kuji`: before/after box order and drawn count, money, all flavor stock,
  goods and equipment. `order[before.drawn]` identifies the drawn prize index in
  `data/kuji.json`. Math.random is intentionally unchanged; record the actual box
  rather than claiming fixed weather/reel seeds fix the lottery.

Parent owns commit/push/PR and subsequent direct/street results; this session
does not perform those Git/GitHub operations.
