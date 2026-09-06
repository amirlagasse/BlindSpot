# Missing data

Numbers this app wanted and could not source, and what was searched. The rule
that produces this file: **if a real source cannot be found, the factor is
omitted rather than guessed at.** Thirty sourced factors beat eighty with
guesses in them.

Every entry says what was looked for, where, and what would close it.

---

## Open

### The entire factor set, pending build phase 2

**Status: expected.** The five domain tables in `src/lib/risk/data/` are
committed empty at engine version 0.1.0. The engine, its conversions and its
tests are complete and run against fixtures. Phase 2 sources and fills:

| Domain | Primary source to work from |
|---|---|
| Mobility | NHTSA FARS, deaths per 100 million VMT, day and night split, by mode |
| Occupation | BLS Census of Fatal Occupational Injuries, fatal injury rate per 100,000 FTE, by SOC code |
| Environment | EPA AQS (PM2.5), EPA Map of Radon Zones, FEMA NFHL, American Trauma Society |
| Activity | Per-event and per-hour rates from the governing body or registry for each sport |
| Chronic | Published microlife estimates, traced to the underlying cohort studies rather than to secondary summaries |

Until they are filled, `EngineResult.coverage` reports zero factors evaluated
and the dashboard must say so rather than showing a zero as if it were a result.

### Population averages and cohort percentiles

**Status: open.** `src/lib/risk/data/population-averages.json` is empty, so
`headline.marginalDaysLostPerYear` and `cohort.percentile` both return `null`.

- The **marginal** figure needs an average American's inputs by age band and
  sex: annual vehicle miles (FHWA), smoking prevalence and intensity (NHIS),
  drinking (BRFSS), BMI (NHANES), exercise (NHIS), occupational mix (BLS OES).
  Each is separately available; the work is assembling them into one profile per
  band with a citation per field.
- The **percentile** needs a distribution, not an average, and no published
  distribution of "expected days of life lost per year" exists because this
  composite is our own construction. Closing it honestly means computing the
  distribution ourselves from the same population surveys and labeling it as a
  derived figure. Until then the engine returns null and the UI hides the line.

**Deliberately not closed by estimating.** A percentile is the single most
screenshot-worthy number in the app and the easiest to fabricate.

---

## Resolved, with a caveat worth keeping

### SSA period life table, 2023

**Sourced and committed** as `src/lib/risk/data/ssa-period-life-table-2023.json`,
120 rows, ages 0 to 119, death probability and life expectancy for both sexes.

Caveat: `ssa.gov` returns **HTTP 403 to non-browser clients**, so the table was
retrieved from the Internet Archive snapshot of the same page
(`web.archive.org/web/20260904121030/`). Values are unmodified and the citation
points at the canonical SSA URL. **Anyone refreshing this table annually will
hit the same 403** and should expect to go through the Archive or download the
Actuarial Study spreadsheet by hand.
