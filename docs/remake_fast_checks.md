# Fast remake checks

This workflow runs lightweight checks without installing a browser or Playwright.

- `node --experimental-vm-modules remake/test/data_loading.mjs` exercises the production JSON loader with real files and simulated network failures.
- `node remake/test/lover_dates.mjs` runs when that test exists on the checked-out branch. It is currently proposed separately in PR #275.
- Runs for relevant data/loader changes and can also be started manually from Actions.
- Does not replace visual QA, full playthrough tests, or browser smoke tests.

## Local run

```sh
node --experimental-vm-modules remake/test/data_loading.mjs
```

This PR intentionally avoids dialogue, romance, and game-state code so Claude's content work can proceed independently.
