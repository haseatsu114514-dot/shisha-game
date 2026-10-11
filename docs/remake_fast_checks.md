# Fast remake checks

This workflow runs lightweight checks without installing a browser or Playwright.

- `python3 tools/check_active_json.py` validates syntax and UTF-8 decoding for active JSON data files.
- `python3 tools/check_dialogue_links.py` verifies dialogue choice links to local branches and event IDs.
- `python3 tools/audit_dialogue_art.py` reports potentially missing dialogue art (advisory).
- `node --experimental-vm-modules remake/test/data_loading.mjs` exercises the production JSON loader with real files and simulated network failures.
- `node remake/test/lover_dates.mjs` verifies six romance dates after PR #275.
- Runs for relevant data/loader changes and can also be started manually from Actions.
- Does not replace visual QA, full playthrough tests, or browser smoke tests.

## Local run

```sh
python3 tools/check_active_json.py
python3 tools/check_dialogue_links.py
python3 tools/audit_dialogue_art.py
node --experimental-vm-modules remake/test/data_loading.mjs
node remake/test/lover_dates.mjs
```

This CI intentionally avoids changing dialogue, romance, and game-state code so content work can proceed independently.
