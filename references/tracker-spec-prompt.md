# Brief: turning Blind Spot into a tracker

I have a working web app called Blind Spot and I want to plan the next version.
Read this whole brief, then give me an implementation plan. Do not write code
yet. Push back if you think the framing is wrong.

---

## 1. What exists today

A Next.js app that computes a person's annual mortality exposure from a
questionnaire. Repo: `github.com/amirlagasse/BlindSpot`, private, `main`.

- Next.js 16.3 (App Router), React 19, TypeScript strict, Tailwind v4
- A pure risk engine at `src/lib/risk/`: no React, no network, 107 tests green
- 16 sourced risk factors, every one citing a real published table
- The SSA 2023 period life table, ages 0 to 119
- A seven-step intake saving to `localStorage`
- A dashboard: headline number, an acute/chronic split, ranked fixes, coverage
- Supabase schema and row-level-security migrations written but NOT applied
- Not deployed anywhere yet

**The core is one pure function:**

```ts
computeRisk(profile: Profile) => EngineResult
```

`Profile` is age, sex, location, occupation, mobility, activities, habits.
`EngineResult` carries a headline in expected days of life lost per year, the
acute and chronic sides separately, a ranked list of controllable contributions,
and a coverage report of what it could not evaluate.

The unit rule that governs everything: micromorts (a one-in-a-million chance of
sudden death) and microlives (thirty minutes of life expectancy) are DIFFERENT
UNITS and are never added. Each converts separately into expected days of life
lost per year, and only those are summed. This is non-negotiable and there are
tests asserting it.

---

## 2. What I want

I want it to be a **tracker**, not a one-time calculator. Right now you fill in
a form once and get a number. I want something that keeps up with me.

---

## 3. The hard problem, which I want you to solve first

**Most of what drives the number cannot be read from a sensor.** Here is every
factor currently shipped, and how it could realistically stay current:

| Factor | Unit | Can a sensor get this? |
|---|---|---|
| `chronic.exercise_first_15_min` | per day | **Yes.** HealthKit / Health Connect / Strava / Garmin |
| `chronic.exercise_additional_15_min` | per day | **Yes.** Same |
| `chronic.bmi_excess_per_unit` | per day | **Yes**, with a smart scale writing to Health |
| `chronic.cigarette` | per day | **No sensor exists.** Manual log only |
| `chronic.alcohol_first_drink` | per day | **No.** Manual log only |
| `chronic.alcohol_additional_drink` | per day | **No.** Manual log only |
| `mobility.car_day` | per 100 miles | **Hard.** Health has no driving. Needs CarPlay/Bluetooth heuristics, Google Timeline, an OBD dongle, or a manual odometer reading |
| `mobility.car_night` | per 100 miles | **Harder.** Needs the time-of-day split, not just the distance |
| `mobility.motorcycle` | per 100 miles | Same as car, and harder to distinguish |
| `occupation.soc.*` (7 of them) | per year | **Static.** Changes maybe twice a decade |

So: roughly **3 of 16 factors are sensor-trackable**, three more are manual
daily logs, three are hard mobility problems, and seven are effectively
constant.

That means "tracker" probably means some blend of three different things, and I
want you to tell me which blend is right:

- **(a) A logger.** A fast daily check-in. Cigarettes, drinks, and not much
  else. Streaks and a trend line. No sensors at all.
- **(b) An integrator.** Read exercise, weight and sleep from Apple Health,
  Health Connect, Strava or Garmin, and keep those factors current with no
  input from me.
- **(c) A re-runner.** Prompt me every few months to revisit the answers that
  drift slowly (mileage, job, weight) and chart how the number moves.

My instinct is that (c) is nearly free, (a) covers the two biggest controllable
factors I have, and (b) is the one that actually feels like a tracker but needs
a native app or an OAuth integration. **Tell me if you disagree, and tell me
what the first shippable version should be.**

---

## 4. What already supports this

Do not redesign these; build on them.

- **The engine is already the tracker's core.** It is a pure function of a
  `Profile`. A tracker's whole job is keeping that `Profile` current without
  asking. Nothing about `computeRisk` has to change.
- **History is nearly free.** The unapplied `results` table already stores each
  computation as jsonb, timestamped, tagged with an engine version string. That
  design exists so a result stays reproducible after the factor data changes,
  which is exactly what a trend chart needs: last month's number must not
  silently rewrite itself when a source publishes a new year.
- **`ProfileStore`** (`src/lib/store/`) is an interface with a localStorage
  implementation. A Supabase implementation drops in beside it without any UI
  changing.
- **Row-level security is already written** in `supabase/migrations/0002`. Every
  policy ties to `auth.uid()`. There is a test planned that attempts cross-user
  access and asserts it fails.

---

## 5. Constraints that must survive

These are not negotiable. If a plan breaks one, say so explicitly and argue for
it rather than doing it quietly.

- **No unsourced numbers, ever.** Every factor cites a real published table. If
  a number cannot be sourced, the factor is omitted and logged in
  `MISSING_DATA.md`. Thirty sourced factors beat eighty with guesses in them.
- **Never sum micromorts and microlives directly.**
- **Never imply more coverage than the inputs support.** `EngineResult.coverage`
  exists for this and the dashboard renders it.
- **Every user-facing number is traceable to a citation within two clicks.**
- **Population averages, not personal predictions.** No medical advice framing.
- **Tone: an instrument panel, not a horror movie.** No skulls, no countdown
  timers, no red alarm styling. Magnitude is shown by bar length, never by a
  color that alarms. Acute is amber and chronic is indigo, consistently.
- **It must not look like AI.** No chunky rounded bars, no big empty padding, no
  small grey text, no fabricated or zero-filled data.
- American spelling. No emojis or em-dashes in anything a user reads.

---

## 6. The privacy question, which I want you to raise rather than assume

Today **nothing leaves the browser.** The engine is pure and runs client-side,
the intake sits in `localStorage`, and no request anywhere carries a health
profile. That is a real property and I did not plan it, it fell out of the
architecture.

Every version of "tracker" trades some of it away:

- Accounts mean the profile lives on a server.
- Health integrations mean continuous health data lives on a server.
- Anything location-derived is the most sensitive data in the whole product.

**Tell me what each option actually costs me here**, and whether there is a
design that keeps the computation local and syncs only the results.

---

## 7. What I want back

1. **A recommendation, not an option dump.** Pick the blend of (a), (b) and (c)
   and say why.
2. **The smallest thing worth shipping**, and what it needs.
3. **Whether this stays a web app.** Apple HealthKit needs a native iOS app.
   Health Connect needs native Android. Strava and Garmin are OAuth web APIs and
   do not. If the answer is native, say so plainly and tell me what that costs,
   because the current spec explicitly ruled out native for v1.
4. **How mileage gets tracked**, or an argument that it should not be and a
   periodic odometer reading is the honest answer.
5. **A phased build order** with a commit point at the end of each phase.
6. **What this breaks** in what already exists.

Ask me questions before planning if the brief is ambiguous.
