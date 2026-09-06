# Blind Spot

A personal mortality risk dashboard. It takes what you tell it about your life
and returns an honest estimate of your annual mortality exposure, split into
what you can change and what you cannot.

The thesis: people badly misjudge relative risk. They fear skydiving and ignore
their commute, their radon, and the fact that the nearest trauma center is forty
minutes away. This makes invisible risk legible and ranks it by size.

Decision support, not medical advice. Every number on screen links to the table
it came from.

---

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build. Must pass before any deploy. |
| `npm test` | Vitest. The risk engine, the seed data and the providers. |
| `npm run test:watch` | The same, watching |
| `npm run typecheck` | `next typegen` then `tsc --noEmit` |
| `npm run lint` | ESLint |

No environment variables are needed to run it. `.env.example` lists the ones
that will be, once Supabase is provisioned.

Nothing you enter leaves the browser. The engine is pure and runs client-side,
and the intake is stored in `localStorage`, so there is no request carrying a
health profile anywhere.

---

## The one thing that must not be wrong

There are two units in this domain and they are not interchangeable.

- A **micromort** is a one-in-a-million chance of sudden death. A probability of
  dying today.
- A **microlife** is thirty minutes of change in life expectancy. An erosion of
  expected lifespan.

**They are never added together.** Summing them is the standard error in this
field. Both convert separately into **expected days of life lost per year**, and
only those are combined:

```
acute_days   = micromorts × (remaining_life_days(age, sex) / 1,000,000)
chronic_days = microlives × 30 / 60 / 24
headline     = acute_days + chronic_days
```

The acute conversion is age-scaled by construction: a micromort costs a
millionth of whatever life you have left, so the same skydive costs a 25 year
old more than a 75 year old. The chronic conversion is not, because the
microlife definition already assumes a 57-year reference adult.

`src/lib/risk/units.ts` deliberately exposes no function that takes both
quantities, and `tests/risk/units.test.ts` asserts it.

---

## Layout

```
references/          Source documents. build-spec.md is the contract.
supabase/migrations/ Schema and RLS. Not yet applied to a project.
scripts/             Run by hand. derive-factors.mjs builds the seed data.
src/
  app/                 Routes
  components/
    ui/                Primitives
    intake/            The seven-step form
    dashboard/         Headline, split, ranked fixes, coverage
  lib/
    risk/              THE ENGINE. Pure. No React, no network.
    providers/         Environment adapters, seeded and live
    store/             Where the intake saves progress
tests/
```

`src/lib/risk/` imports nothing from `app/` or `components/`. It is a library
that happens to live here. If it ever needs a network call, the design is wrong.

---

## How to add a factor

**Never hand-edit `src/lib/risk/data/*.json`.** Those files are generated, and a
value with no line of code behind it is a value nobody can check.

1. **Find a primary source.** Not a blog, not a widely circulated micromort
   list. The table itself. If you cannot reach it, put the factor in
   `MISSING_DATA.md` and stop. Thirty sourced factors beat eighty with guesses
   in them.

2. **Add the source and the factor to `scripts/derive-factors.mjs`.** Quote the
   figure in the citation string, and derive the value by arithmetic in the file
   so a reader can follow it. Two helpers are already there:
   `hazardRatioToYearsLost` turns a published HR into years using a Gompertz
   slope fitted from the SSA life table in this repo, and
   `yearsLostToMicrolivesPerDay` spreads a lifetime effect over the 57-year
   reference adult.

3. **Bump the table's `version`.** Stored results carry the engine version
   string, which is how a dashboard from last month still explains itself after
   a number moves.

4. **Run it, then check it.**
   ```bash
   node scripts/derive-factors.mjs
   npm test
   ```
   Add a case to `tests/risk/seed-data.test.ts` checking the new value against
   an anchor you did **not** use to derive it. That test is the guard against a
   fat-fingered constant.

5. **Wire it up if it needs a new input.** The domain evaluators in
   `src/lib/risk/factors/` map a profile onto factor ids. A factor whose id
   nothing looks for will load and never be used.

The Zod schema in `src/lib/risk/schema.ts` refuses a factor without a complete
`source`, so an unsourced number cannot reach production even by accident. That
is a schema error, not a convention anyone has to remember.

### Which quantity is which

`contribute()` takes an exposure and a modifier, and the split differs by kind.

- **Acute:** the exposure is the quantity. Miles, events, hours. The modifier is
  usually 1, or a mitigation, or a state road-rate scaling.
- **Chronic:** the exposure is always 365.25 days and the **modifier** carries
  the intensity. Cigarettes a day, BMI points above the ceiling.

Anything asking "what if this were half as much" has to know which one to halve.
Getting it wrong once produced advice to cut down to "183 cigarettes a day".

---

## How to swap in a live environment provider

Environment data is address-derived. The seeded provider reads committed JSON;
the live one is stubbed, and every method throws `NotImplementedError` naming
the exact endpoint it will call.

1. Implement the method in `src/lib/providers/environment/live.ts`.
2. Set `ENVIRONMENT_PROVIDER=live`.

**There is no fallback from live to seeded and there must not be one.** A user
reading a number they believe came from the EPA must not in fact be reading a
state average. If live is configured and fails, it fails loudly.

---

## What this does not have yet

`MISSING_DATA.md` is the full accounting. The short version:

- **No activity factors.** Skydiving, scuba, climbing and the rest each need a
  rate from their own governing body on their own denominator. The circulating
  micromort lists would fill that screen in an afternoon and are not going in.
- **No environment factors.** State road fatality rates are sourced and applied;
  air quality, radon, flood and trauma-center access are not.
- **No cycling, walking, transit or commercial aviation.** FARS gives the
  deaths; there is no federal mileage table for bikes and pedestrians, and
  aviation needs passenger fatalities over enplanements across several years
  because most years have none.
- **No marginal figure and no cohort percentile.** Both return `null` and the
  UI hides them. There is no published distribution of this composite, because
  the composite is ours.
- **No accounts.** Supabase schema and RLS are written; no project is
  provisioned. Progress lives in `localStorage` on one device.

Three shipped numbers rest on a disclosed assumption, each stated in the
factor's own notes so it reaches the user and not just this file: the
per-cigarette dose divides a ten-year figure by an assumed pack a day, the
day-night driving split applies a 2005 ratio to 2024 rates, and occupation
covers six SOC major groups only.

---

## Hard rules

- No unsourced numbers, ever. `MISSING_DATA.md` instead.
- Never sum micromorts and microlives directly.
- Never imply more coverage than the inputs support. `EngineResult.coverage`
  exists for this and the dashboard renders it.
- Every user-facing number is traceable to a citation within two clicks.
- Population averages, not personal predictions. No medical advice framing.
