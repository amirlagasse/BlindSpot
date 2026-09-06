# Missing data

Numbers this app wanted and could not source, and what was searched. The rule
that produces this file: **if a real source cannot be found, the factor is
omitted rather than guessed at.** Thirty sourced factors beat eighty with
guesses in them.

Every entry says what was looked for, where, and what would close it.

A recurring obstacle worth stating once: **`bls.gov`, `nhtsa.gov`, `ssa.gov`
and `cdc.gov` all return HTTP 403 to non-browser clients.** Several figures
below were reachable only through the Internet Archive, a PDF endpoint, or a
body that republishes the same federal data (IIHS for FARS, FHWA for VMT).
Anyone refreshing this data will hit the same wall.

---

## Sourced and shipped

| Domain | Factors | Anchor |
|---|---|---|
| Mobility | 3 | FARS 2024 deaths over FHWA 2024 VM-1 miles |
| Occupation | 7 | BLS CFOI 2023, Table 4, SOC major groups |
| Chronic | 6 | Doll 2004, Wood 2018, Global BMI Collaboration 2016, Wen 2011 |
| Life table | 120 rows | SSA period life table, 2023 |
| State road rates | 51 | IIHS Fatality Facts 2024, state by state |

`scripts/derive-factors.mjs` produces the factor tables from those sources. Every
value is either quoted or derived by arithmetic in that file, so no number has
to be taken on trust.

---

## Open

### Activity domain: entirely unsourced

**Status: open. Zero factors shipped.** Skiing, scuba, climbing, motorsport,
general aviation, skydiving, horse riding, marathon, open water swimming and
hiking are all in the intake design and none has a rate behind it yet.

The obstacle is that no single body publishes these. Each needs its own
governing body or registry, and each has a different denominator:

| Activity | Where the rate lives | Denominator |
|---|---|---|
| Skydiving | United States Parachute Association annual fatality summary | Jumps |
| Scuba | Divers Alert Network annual diving report | Dives |
| Climbing | American Alpine Club, Accidents in North American Climbing | Climber-days |
| General aviation | NTSB annual review of US civil aviation accidents | Flight hours |
| Marathon | Published cohort studies of race-day cardiac arrest | Race starts |
| Motorsport | Series-specific; no consolidated source found | Varies |

**Do not fill these from the widely circulated micromort lists.** Those numbers
circulate without provenance and several are decades stale, which is exactly
what section 9 of the build spec warns about.

### Environment domain: no factors, one dataset

**Status: partly open.** State road fatality rates are sourced and committed at
`src/lib/providers/environment/data/state-road-fatality-rates.json`, and the
engine already applies them as a relative multiplier on car miles. Nothing else
in the domain has a factor.

Still needed, with the source each one points at:

- **PM2.5**, microlives per day per ug/m3. EPA Air Quality System annual
  summaries give the concentration; the mortality coefficient needs a separate
  cohort source, and the two have to be combined explicitly rather than taken
  from a single published "microlives per unit" figure, which does not exist.
- **Radon**, by EPA zone. EPA Map of Radon Zones gives the zone; the lung
  cancer risk per becquerel needs the pooled residential radon analyses.
- **Flood zone.** FEMA National Flood Hazard Layer gives the zone. **Whether a
  flood zone carries measurable individual mortality risk in the US is itself
  an open question** and may end up omitted on the merits rather than for lack
  of data.
- **Trauma center access.** American Trauma Society's database gives locations
  and a routing API gives drive time. The excess mortality from delayed
  definitive care needs a source of its own, and the golden-hour bands in
  `factors/environment.ts` are currently a structure with no numbers in it.

### Mobility: three modes and the aviation factor

**Status: open.**

- **Bicycle and walking, per mile.** FARS gives the deaths (1,075 bicyclists and
  7,080 pedestrians in 2024). The denominator is the problem: there is no
  bicycle or pedestrian equivalent of VM-1. The National Household Travel Survey
  is the usual source and its most recent round would need to be pulled and its
  mileage estimates justified.
- **Transit, per passenger mile.** Bureau of Transportation Statistics publishes
  both fatalities and passenger miles by mode, so this one is mostly legwork.
- **Commercial aviation, per flight.** This is a signature factor for the
  product and it is **deliberately absent**. NTSB publishes fatal accidents per
  100,000 departures (0.01 to 0.02 in the years that had any) but that is
  accidents, not passenger deaths, and converting needs survivability and load
  factor. Doing it properly means passenger fatalities over enplanements across
  a multi-year window, from BTS. A single-year figure is meaningless here: most
  years have zero.

### Population averages and cohort percentiles

**Status: open.** `src/lib/risk/data/population-averages.json` is empty, so
`headline.marginalDaysLostPerYear` and `cohort.percentile` both return `null`
and the dashboard hides those lines.

- The **marginal** figure needs an average American's inputs by age band and
  sex: annual vehicle miles (FHWA), smoking prevalence and intensity (NHIS),
  drinking (BRFSS), BMI (NHANES), exercise (NHIS), occupational mix (BLS OES).
  Each is separately available; the work is assembling them into one profile per
  band with a citation per field.
- The **percentile** needs a distribution, not an average, and no published
  distribution of "expected days of life lost per year" exists, because the
  composite is our own construction. Closing it honestly means deriving the
  distribution from the same surveys and labeling it derived.

**Deliberately not closed by estimating.** A percentile is the most
screenshot-worthy number in the app and the easiest to fabricate.

---

## Shipped with a disclosed assumption

These are in the tables, and each carries the caveat in its own `notes` field so
it reaches the user, not just this file.

### Cigarettes: the per-cigarette denominator is assumed

Doll et al. (BMJ 2004) is unambiguous that continuing cigarette smokers died
about 10 years younger than lifelong non-smokers. It does not give a
per-cigarette dose in the abstract, so `chronic.cigarette` divides that 10 years
by **an assumed pack a day**.

The result, 12.6 minutes per cigarette, sits below Spiegelhalter's 15 minutes
(BMJ 2012) and University College London's roughly 20 minutes (2024), so the app
currently **understates** smoking.

**What would close it:** the UCL paper in *Addiction* (2024), which gives 17
minutes for men and 22 for women directly. It could not be retrieved: BMJ
returns 429, and PubMed does not index it under the phrasings tried.

### Day and night driving: a 2005 ratio on 2024 rates

The overall passenger vehicle rate is 2024 data. The three-to-one night-to-day
split comes from NHTSA DOT HS 810 637, published in 2007 on 2005 data. Both
figures in it, the 25 percent night travel share and the three-fold rate, are
quoted verbatim in the citation. Confidence on the split is marked `medium`
against `high` for the overall rate.

**What would close it:** a current FARS analysis by light condition with a
matching current estimate of nighttime VMT share.

### Occupation: major groups only

BLS Table 4 publishes rates for six SOC major groups and the all-worker average.
Detailed occupations, which is where the interesting spread lives (logging and
commercial fishing run one to two orders of magnitude above a desk job), are at
`bls.gov/iif/fatal-injuries-tables.htm#rates`, which returns 403 and whose
Internet Archive snapshot captured navigation but not the table body.

**Groups with no rate shipped at all** include office and administrative
support, healthcare, education and sales. **They are omitted rather than given
the all-worker average**, which would badly overstate a desk job. An occupation
not in the table is reported through `coverage.factorsSkippedForMissingInput`.

### BMI: no underweight side

The Global BMI Mortality Collaboration found mortality rising below a BMI of 20
as well as above 25 (HR 1.51 below 18.5). The app models only the excess side.
Someone underweight sees nothing, which understates their risk.

### Alcohol: linear above the threshold, and nothing below it

`chronic.alcohol_additional_drink` uses the marginal slope between Wood et al.'s
100-200 and 200-350 g/week bands. Consumption above 350 g a week costs far more
per drink than a linear extrapolation implies, so **heavy drinking is
understated**. And because the study covered current drinkers only, the app makes
no claim about one drink a day versus none.
