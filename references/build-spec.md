# Build Spec: Blind Spot

Personal Mortality Risk Dashboard. Working name: Blind Spot. See section 13 for naming rationale
and alternates.

You are building a complete, deployable web application. Work autonomously. Do not stop to ask
me questions unless you hit a genuine blocker. Build in the phase order given at the bottom, and
commit after each phase.

---

## 1. What this is

A web app that takes what a person tells it about their life and returns an honest estimate of
their annual mortality exposure, broken into what they can change and what they cannot.

The insight the product exists to deliver: people badly misjudge relative risk. They fear
skydiving and ignore their commute, their radon, and the fact that the nearest trauma center is
40 minutes away. The app makes invisible risk legible and ranks it by size.

This is a decision-support tool, not medical advice. Every screen that shows a number must be
able to show its sources.

---

## 2. Stack

- Next.js 15, App Router, TypeScript, strict mode on
- Tailwind CSS
- Supabase: Postgres plus Auth (email/password and Google OAuth)
- Recharts for visualization
- Zod for all input and config validation
- Vitest for the risk engine tests
- Deploy target: Vercel

Do not add a state management library. Server components plus URL state plus React state is
enough.

---

## 3. The unit math: read this section twice

This is the core of the product. Getting it wrong makes everything downstream meaningless.

### Two incompatible units

A **micromort** is a one-in-a-million chance of sudden death from an acute event. Assigned per
event or per unit of exposure. Example: one skydive.

A **microlife** is 30 minutes of change in life expectancy from a chronic habit or exposure.
Roughly one millionth of a 57-year adult lifetime. Example: two cigarettes.

**These cannot be added together.** One is a probability of dying now. The other is an erosion
of expected lifespan. Summing them is the standard error in this space. Do not do it.

### The common currency

Convert both to **expected days of life lost per year**. This is legitimate and it is what the
headline number displays.

Acute conversion:

```
remaining_life_expectancy_days = life_table_lookup(age, sex)
days_lost_per_micromort = remaining_life_expectancy_days / 1_000_000
acute_days_lost = total_annual_micromorts * days_lost_per_micromort
```

A micromort is a one-in-a-million chance of losing everything you have left. Its expected cost
is one millionth of your remaining life. This means the same micromort costs a 20 year old more
than it costs an 80 year old. That is correct and the app should surface it.

Chronic conversion:

```
chronic_days_lost = (annual_microlives_lost * 30) / 60 / 24
```

A microlife is 30 minutes by definition. No age scaling: the definition already bakes in a
57-year reference adult.

Headline:

```
total_expected_days_lost_per_year = acute_days_lost + chronic_days_lost
```

Now they are in the same unit and the addition is honest.

### Baseline versus marginal

Everyone dies. A dashboard showing that a 22 year old loses days per year is meaningless without
a reference. So compute two things for every user:

1. **Absolute exposure**: their total, as above
2. **Marginal exposure**: their total minus the population average for their age and sex

Marginal is the number that answers "am I doing something unusual." Display both. Lead with
marginal in the ranked-fixes view and absolute in the headline.

### Baseline hazard

Pull the age-and-sex-specific annual probability of death from the SSA period life table. This is
the floor. Nothing the user does removes it. Show it as its own dashboard segment labeled clearly
as unavoidable, so users can see how much of their number is simply being alive.

---

## 4. Risk engine architecture

Build this first and build it standalone. It must be a pure TypeScript module with no React and
no network calls, fully unit tested.

```
/lib/risk/
  types.ts          // RiskFactor, RiskContribution, Profile, EngineResult
  engine.ts         // pure: (Profile) => EngineResult
  lifetables.ts     // SSA period life table, age x sex
  factors/
    mobility.ts     // driving, motorcycle, cycling, flying, transit
    occupation.ts   // BLS fatal injury rate by SOC code
    environment.ts  // air, radon, flood, seismic, trauma access
    activities.ts   // sports and recreation, per-event
    chronic.ts      // smoking, alcohol, BMI, exercise, sleep
  data/
    *.json          // versioned seed data, one file per domain
```

### Every risk factor is this shape

```typescript
interface RiskFactor {
  id: string;
  label: string;
  domain: 'mobility' | 'occupation' | 'environment' | 'activity' | 'chronic';
  kind: 'acute' | 'chronic';        // determines which conversion applies
  unit: 'per_event' | 'per_hour' | 'per_100_miles' | 'per_year' | 'per_day';
  value: number;                     // micromorts if acute, microlives if chronic
  controllable: boolean;             // can the user realistically change this
  source: {
    citation: string;
    url: string;
    year: number;
    confidence: 'high' | 'medium' | 'low';
  };
  notes?: string;
}
```

**The `source` field is mandatory and not nullable.** If you cannot find a real source for a
number, do not invent the number. Omit the factor and add it to a `MISSING_DATA.md` file at the
repo root listing what you could not source and where you looked. I would rather ship 30 sourced
factors than 80 with guesses in them.

**The `controllable` flag drives the whole product.** Splitting exposure into unavoidable
baseline, structural (job, where you live, commute you cannot skip), and discretionary is what
makes the dashboard actionable instead of fatalistic.

### Engine output

```typescript
interface EngineResult {
  headline: {
    totalDaysLostPerYear: number;
    marginalDaysLostPerYear: number;   // vs population average, age+sex matched
    baselineDaysLostPerYear: number;   // unavoidable
  };
  acute: {
    totalMicromorts: number;
    daysLost: number;
    contributions: RiskContribution[];
  };
  chronic: {
    totalMicrolives: number;
    daysLost: number;
    contributions: RiskContribution[];
  };
  ranked: RiskContribution[];   // controllable only, sorted by daysLost desc
  cohort: {
    percentile: number;
    comparisonBasis: string;   // must state it is against published averages
  };
  coverage: {
    factorsEvaluated: number;
    factorsSkippedForMissingInput: string[];
  };
}
```

`coverage` matters: the app must never imply completeness it does not have. If the user skipped
occupation, the dashboard says so.

---

## 5. Data adapter layer

Environment data is address-derived. Live government APIs are the eventual source but are not
wired up in v1. Build the interface now so swapping them in is a one-file change.

```typescript
interface EnvironmentProvider {
  getPM25(zip: string): Promise<{ value: number; source: SourceRef }>;
  getRadonZone(zip: string): Promise<{ zone: 1 | 2 | 3; source: SourceRef }>;
  getFloodZone(zip: string): Promise<{ zone: string; source: SourceRef }>;
  getTraumaCenterMinutes(zip: string): Promise<{ minutes: number; level: 1|2|3; source: SourceRef }>;
  getStateRoadFatalityRate(state: string): Promise<{ perHundredMillionVMT: number; source: SourceRef }>;
}
```

Ship two implementations:

- `SeededEnvironmentProvider`: reads from committed JSON. Real values at state level, plus ZIP
  level for the 100 largest US metros. Falls back to state average with a visible confidence
  downgrade when a ZIP is unknown.
- `LiveEnvironmentProvider`: full method stubs that throw `NotImplementedError` with a comment
  naming the exact API and endpoint each one will call. Selected by env var.

Never silently fall back from live to seeded. If live is configured and fails, surface it.

Real sources for the stubs to name:
- PM2.5: EPA AQS API, or EPA Air Quality System annual summary files
- Radon: EPA Map of Radon Zones, county level
- Flood: FEMA National Flood Hazard Layer
- Trauma centers: American Trauma Society trauma center database, plus a routing API for drive time
- Road fatality: NHTSA FARS, state-level VMT-normalized

---

## 6. Input flow

Multi-step form, saves progress to the database after each step, resumable. Mobile-first layout:
this will be filled out on a phone as often as a laptop.

**Step 1: Baseline.** Age, sex at birth. Required. Nothing else works without these.

**Step 2: Where you live.** ZIP code. Optionally full address for better trauma center routing
later. This single field unlocks the entire environment domain and it is the highest
insight-per-keystroke input in the app. Make that clear in the UI.

**Step 3: Work.** Occupation, searchable against BLS SOC codes. Hours per week. Occupation is the
largest discrete factor available: logging and commercial fishing run one to two orders of
magnitude above a desk job.

**Step 4: Getting around.** Annual miles by mode: car, motorcycle, bicycle, walking, transit.
Vehicle year and type. Percentage of driving at night. Commercial flights per year.

**Step 5: What you do.** Activity picker with per-event or per-hour frequency. Skiing, scuba,
climbing, motorsport, general aviation, skydiving, horse riding, marathon, open water swimming,
hiking. Mitigation checkboxes per activity where they apply: helmet, harness, life vest, buddy
system, certified instruction.

**Step 6: Habits.** Smoking, alcohol, exercise minutes per week, sleep hours, height and weight
for BMI. This is the chronic domain.

**Step 7: Optional health import.** Read-only HealthKit or Health Connect import if available.
Detect capability, do not require it. If absent, everything still works. Skip the native bridge
in v1 and build the manual entry path plus a clearly stubbed import button.

Every step must be skippable. Skipped steps degrade coverage, never break the result.

---

## 7. Dashboard

Three views on one page, no tabs.

**Headline.** One large number: expected days of life lost per year. Directly under it, in
smaller type, the marginal figure versus age-and-sex-matched population average. Under that, one
sentence naming the single largest controllable contributor.

**The split.** Two columns side by side, acute and chronic, each with its own total in days and
a stacked bar broken down by domain. They must be visually distinct and labeled with what each
unit means. A tooltip on each explains micromorts and microlives in one sentence each.

**Ranked fixes.** A sorted list of controllable contributions, largest first. Each row: the
factor, days lost per year, what the number would become if changed, and the source citation. If
driving 15,000 miles is the top line, show what 10,000 miles looks like. This is the screen
people will screenshot.

**Cohort.** Percentile against published population averages for their age and sex. Label the
basis explicitly: this is not a comparison against other users of the app in v1, and the UI must
not imply that it is.

Design notes: this is a serious subject. Restrained typography, no skulls, no countdown timers,
no red alarm styling. The tone is a well-made instrument panel, not a horror movie. Numbers
should feel measured, not accusatory.

Read `/mnt/skills/public/frontend-design/SKILL.md` before building any UI.

---

## 8. Database schema

```
profiles          user_id (fk auth.users), age, sex, zip, created_at, updated_at
inputs            profile_id, step, payload jsonb, completed_at
results           profile_id, engine_version, computed_at, result jsonb
factor_versions   version, published_at, changelog
```

Store the full `EngineResult` as jsonb on every compute, tagged with the engine version. When
factor data updates, past results stay reproducible and users can see their trend.

Row-level security on everything. A user reads and writes only their own rows. Verify RLS
policies with a test that attempts cross-user access and asserts failure.

---

## 9. Seed data starting points

Use these as anchors only. **Verify every single one against a primary source before committing
it, and record the real citation.** Some are widely repeated numbers of uncertain provenance and
several are stale. Where sources disagree, use the more recent and note the range in `notes`.

Acute, micromorts:
- Driving, US average: roughly 1 per 100 miles, but state variation is about 3x. Derive from
  NHTSA FARS deaths per 100M VMT rather than copying a blog figure.
- Motorcycle: roughly 30x car per mile
- Commercial aviation: well under 1 per flight
- Skydiving: single digits per jump
- BASE jumping: hundreds per jump
- Scuba: single digits per dive
- Marathon: single digits per race
- Everest summit attempt: tens of thousands
- Night in hospital: widely cited around 75, verify provenance, flag low confidence if unclear

Chronic, microlives per day:
- 2 cigarettes: -1
- 5kg overweight: -1 per day
- First alcoholic drink: slightly positive, subsequent drinks negative
- 20 minutes exercise: positive, with diminishing returns after the first 40 minutes

Occupation: pull directly from BLS Census of Fatal Occupational Injuries, fatal injury rate per
100,000 full-time equivalent workers. Convert to micromorts per working year.

---

## 10. Build order

Commit at the end of each phase.

1. **Risk engine, pure, tested.** No UI. Vitest suite covering unit conversion, age scaling,
   baseline subtraction, and the acute/chronic separation. Include a test that asserts micromorts
   and microlives are never summed directly.
2. **Seed data, sourced.** Every factor with a real citation. Write `MISSING_DATA.md` as you go.
3. **Next.js scaffold, Supabase auth, schema, RLS.** Verify auth end to end before proceeding.
4. **Input flow.** All seven steps, resumable, skippable.
5. **Dashboard.** All four sections.
6. **Environment adapter.** Seeded provider live, live provider stubbed.
7. **Deploy to Vercel.** Confirm it works on a phone browser.
8. **README.** How to run, how to add a factor, how to swap in a live provider.

---

## 11. Explicit non-goals for v1

Do not build these. Do not scaffold them speculatively.

- Phone sensors, background location, motion classification
- Native iOS or Android
- Live government API calls
- Cross-user cohort comparison
- Leaderboards or social features
- Any push notification

---

## 12. Hard rules

- No unsourced numbers. Ever. `MISSING_DATA.md` instead.
- Never sum micromorts and microlives directly.
- Never display a result implying more coverage than the inputs support.
- Every user-facing number is traceable to a citation within two clicks.
- The app states plainly that these are population averages, not personal predictions.
- No medical advice framing anywhere in the copy.

---

## 13. Naming

Working name: **Blind Spot**.

### Why it fits

A blind spot is a real hazard, close to you, that you cannot see, and you do not know you cannot
see it. Two sources for the phrase:

- Driving: the zone beside the car that the mirrors miss. There is a vehicle there. You just
  cannot see it.
- Vision: the eye has a literal hole where the optic nerve attaches, with no photoreceptors. The
  brain fills it in, so the gap is never noticed.

That is the product thesis exactly. A user's largest risks are their commute, their radon, their
drive time to a trauma center. These are not exotic or far away. They are in the daily routine
and completely invisible, while attention goes to plane crashes and shark attacks.

The app is a mirror for what the mirrors miss.

The driving association is a bonus, since mobility will rank first for most users.

### Weaknesses to check

The phrase is common, so the domain and App Store name are likely taken. It is also worn from
loose business usage meaning any general oversight. Verify availability before committing.

### Alternates

- Rigor-forward: Micromort, Millionth, One in a Million
- Output-forward: Days Lost, Expected Days, Life Ledger
- Acquisition-safe and neutral: Baseline, Exposure, Sightline, Vector

Note on tone: the original working concept was "death glasses." Do not use that or anything in
that register in product copy, UI, or repo naming. The interface tone is an instrument panel,
not a horror movie, per section 7.
