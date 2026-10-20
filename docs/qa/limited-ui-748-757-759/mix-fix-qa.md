# PR759 actual two-flavor cascade repair

Candidate source CSS: blob7b1b8986196bcb0ec29f9609f7888885a4bef483 (12979bytes). Updated static script: blobed8d34854f6c000c0796553c89fcdbcdc3c5ec3c. See source-hashes.json. Parent stages this uncommitted candidate over pinned PR759 c709; this evidence does not prove a saved remote HEAD.

The actual DOM contains caption p plus two flavor rows, matching craft.css's nth-child3 special rule. Its higher specificity overrode the phone row grid, name grid-area/font, control height and gram label. Four +/- targets measured29.25physical px high and descriptions wrapped into a narrow column. The earlier three-row fixture missed this cascade.

Five overrides are confined to the existing phone landscape non-DS mix selector and the exact two-row special case. They restore the intended phone grid, full-width name area with package inset,16px physical name,44.1px control dimensions/min-height and16px gram labels. Shared craft.css/steps and the bench/preview/thermometer selectors are unchanged.

Validation: existing41 static cases plus12 two-flavor hidden/visible variants =53PASS (static-candidate/results.json). The same new phone844 case with old c709 CSS fails the target assertion as expected (expected-c709-failure.json). Placeholder/font limitations of the static fixture remain explicit.

Actual cached production modules/fonts/art,1920x1080 desktop and844x390 coarse touch, hidden tutorial and visible rehearsal preview:4/4PASS (actual-final/results.json). All +/- controls44.095physical px square; name16px; every row child within row. Real touch scroll moves list/side as applicable. Native +9, -1, +1, +3 and confirm produce {double_apple:9,mint:3}. Five bundled fonts loaded; all DOM images decoded; no missing resources, runtime errors or renderer external requests. CSS background/texture was previously explicitly Image.decode checked in the VN fresh run. Chrome has external resolver denial, no proxy and Fetch origin interception. Browser-wide transferred bytes were not instrumented.

comparison.json: PC mix hidden/visible decoded screenshot pixels identical before/after. Both viewport sizes keep bench-right and temperature-preview/legend/ideal/optimal geometry identical to base. Previous actual setup/pack/place geometry and native inputs passed; this fix only matches mix. Existing41 includes unaffected pack audience/body, initial three choices/footer, PC/narrow desktop/DS/outside-step gates, long explanation reach/focus and touch scrolling.

The initial candidate runner accidentally asserted plain label text as if it were a44px control after a harness selector edit. That invalid harness result remains under actual-candidate/. Removing non-control labels from the primary-target assertion yielded actual-final/; production CSS did not change between them. The strict actual target/name/row/scroll/input assertions remain.

This is limited actual component QA, not chapter playthrough, physical-device verification, line-resume, current-main integration or deployment. Existing mix shared guide/audience small text stays outside this scope. No production source, reservation, branch, settings or CI was changed directly by this worker; parent alone performs network save after review/preflight.
