/**
 * Derives the seed factor tables from published primary sources and writes them
 * to src/lib/risk/data/.
 *
 * Run with:  node scripts/derive-factors.mjs
 *
 * WHY THIS EXISTS. Every value in the committed JSON is either quoted directly
 * from a source or derived from quoted values by arithmetic in this file. That
 * makes the derivation auditable: nobody has to trust a number in a JSON file,
 * they can read the line that produced it. When a source publishes a new year,
 * update the constants at the top of its section and re-run.
 *
 * The rule this file enforces is the repo's hardest one: no unsourced numbers.
 * Anything that could not be sourced is absent from the output and present in
 * MISSING_DATA.md instead.
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'src/lib/risk/data');

/* ========================================================================== */
/* Shared constants                                                           */
/* ========================================================================== */

const DAYS_PER_YEAR = 365.25;
const MINUTES_PER_MICROLIFE = 30;

/**
 * The microlife reference adult lifetime: 57 years, because one million half
 * hours is about 57 years. Every chronic derivation below spreads a lifetime
 * life-expectancy effect across this many days of exposure.
 */
const REFERENCE_ADULT_YEARS = 57;
const REFERENCE_ADULT_DAYS = REFERENCE_ADULT_YEARS * DAYS_PER_YEAR;

/**
 * Gompertz mortality slope, fitted here from the committed SSA 2023 period life
 * table over ages 40 to 85 (R^2 = 0.993 for each sex separately).
 *
 * This is what converts a published hazard ratio into years of life expectancy:
 * for a proportional hazard acting across adult life,
 *
 *     years lost = ln(hazard ratio) / b
 *
 * Deriving b from the life table already in this repo means the conversion
 * carries no external assumption of its own.
 */
function fitGompertzSlope() {
  const table = JSON.parse(
    readFileSync(join(DATA, 'ssa-period-life-table-2023.json'), 'utf8'),
  );
  const slopes = ['maleQx', 'femaleQx'].map((key) => {
    const rows = table.rows.filter((r) => r.age >= 40 && r.age <= 85);
    const xs = rows.map((r) => r.age);
    const ys = rows.map((r) => Math.log(r[key]));
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    const num = xs.reduce((acc, x, i) => acc + (x - mx) * (ys[i] - my), 0);
    const den = xs.reduce((acc, x) => acc + (x - mx) ** 2, 0);
    return num / den;
  });
  return (slopes[0] + slopes[1]) / 2;
}

const GOMPERTZ_B = fitGompertzSlope();

/** Years of life expectancy lost for a hazard ratio acting across adult life. */
const hazardRatioToYearsLost = (hr) => Math.log(hr) / GOMPERTZ_B;

/** A lifetime life-expectancy effect, spread over the reference adult's days. */
const yearsLostToMicrolivesPerDay = (years) =>
  (years * DAYS_PER_YEAR * 24 * 60) / REFERENCE_ADULT_DAYS / MINUTES_PER_MICROLIFE;

/** Round for the committed file. More precision than this is false confidence. */
const r = (n, places = 4) => Number(n.toFixed(places));

/* ========================================================================== */
/* Sources                                                                    */
/* ========================================================================== */

/**
 * A per-mile death rate is a ratio of two sources: FARS supplies the numerator
 * and FHWA the denominator. The citation names both, because citing only one
 * would send a reader to a table that does not contain the number.
 */
const FARS_OVER_FHWA_2024 = {
  citation:
    'Deaths from the US DOT Fatality Analysis Reporting System (FARS) 2024, via IIHS Fatality Facts 2024: Yearly snapshot. Vehicle miles from Federal Highway Administration, Highway Statistics 2024, Table VM-1: Annual Vehicle Distance Traveled in Miles and Related Data by Highway Category and Vehicle Type.',
  url: 'https://www.fhwa.dot.gov/policyinformation/statistics/2024/vm1.cfm',
  year: 2024,
  confidence: 'high',
};

const NHTSA_NIGHT = {
  citation:
    'Varghese C, Shankar U. Passenger Vehicle Occupant Fatalities by Day and Night: A Contrast. NHTSA National Center for Statistics and Analysis, Traffic Safety Facts Research Note DOT HS 810 637, May 2007. States that approximately 25 percent of travel occurs during hours of darkness and that the fatality rate per vehicle mile of travel is about three times higher at night than during the day.',
  url: 'https://crashstats.nhtsa.dot.gov/Api/Public/ViewPublication/810637',
  year: 2005,
  confidence: 'medium',
};

const IIHS_HELMETS = {
  citation:
    'Insurance Institute for Highway Safety, Fatality Facts 2024: Motorcycles and ATVs. States that helmets are about 37 percent effective in preventing motorcycle deaths.',
  url: 'https://www.iihs.org/research-areas/fatality-statistics/detail/motorcycles-and-atvs',
  year: 2024,
  confidence: 'high',
};

const BLS_CFOI_2023 = {
  citation:
    'US Bureau of Labor Statistics, National Census of Fatal Occupational Injuries in 2023, USDL-24-2564, released 19 December 2024, Table 4: Fatal work injury rates per 100,000 full-time equivalent workers by selected occupations, 2021-23.',
  url: 'https://www.bls.gov/news.release/cfoi.t04.htm',
  year: 2023,
  confidence: 'high',
};

const DOLL_2004 = {
  citation:
    'Doll R, Peto R, Boreham J, Sutherland I. Mortality in relation to smoking: 50 years observations on male British doctors. BMJ 2004;328:1519. Men who smoked only cigarettes and continued smoking died on average about 10 years younger than lifelong non-smokers.',
  url: 'https://pubmed.ncbi.nlm.nih.gov/15213107/',
  year: 2004,
  confidence: 'high',
};

const GLOBAL_BMI_2016 = {
  citation:
    'Global BMI Mortality Collaboration. Body-mass index and all-cause mortality: individual-participant-data meta-analysis of 239 prospective studies in four continents. Lancet 2016;388:776-86. Hazard ratio per 5 kg/m2 higher BMI above 25 was 1.29 in North America.',
  url: 'https://pubmed.ncbi.nlm.nih.gov/27423262/',
  year: 2016,
  confidence: 'high',
};

const WEN_2011 = {
  citation:
    'Wen CP, Wai JPM, Tsai MK, et al. Minimum amount of physical activity for reduced mortality and extended life expectancy: a prospective cohort study. Lancet 2011;378:1244-53. 92 minutes a week, about 15 a day, gave a 14 percent lower all-cause mortality and a 3 year longer life expectancy than being inactive; every additional 15 minutes a day reduced all-cause mortality by a further 4 percent.',
  url: 'https://pubmed.ncbi.nlm.nih.gov/21846575/',
  year: 2011,
  confidence: 'high',
};

const WOOD_2018 = {
  citation:
    'Wood AM, Kaptoge S, Butterworth AS, et al. Risk thresholds for alcohol consumption: combined analysis of individual-participant data for 599,912 current drinkers in 83 prospective studies. Lancet 2018;391:1513-23. Minimum all-cause mortality risk was around or below 100 g per week; relative to 0-100 g per week, life expectancy at age 40 was lower by about 6 months at 100-200 g, 1-2 years at 200-350 g, and 4-5 years above 350 g.',
  url: 'https://pubmed.ncbi.nlm.nih.gov/29676281/',
  year: 2018,
  confidence: 'high',
};

/* ========================================================================== */
/* Mobility                                                                   */
/* ========================================================================== */

// FARS 2024 deaths, by road user type.
const PV_OCCUPANT_DEATHS = 22_713;
const MOTORCYCLIST_DEATHS = 6_228;

// FHWA VM-1 2024 travel, millions of vehicle miles.
const LIGHT_DUTY_SHORT_WB_M = 2_222_415;
const LIGHT_DUTY_LONG_WB_M = 701_693;
const MOTORCYCLE_M = 22_241;

const PASSENGER_VEHICLE_MILES = (LIGHT_DUTY_SHORT_WB_M + LIGHT_DUTY_LONG_WB_M) * 1e6;
const MOTORCYCLE_MILES = MOTORCYCLE_M * 1e6;

/** Deaths per 100 miles, expressed in micromorts (one micromort = 1e-6). */
const micromortsPer100Miles = (deaths, miles) => (deaths / miles) * 100 * 1e6;

const CAR_OVERALL = micromortsPer100Miles(PV_OCCUPANT_DEATHS, PASSENGER_VEHICLE_MILES);
const MOTORCYCLE = micromortsPer100Miles(MOTORCYCLIST_DEATHS, MOTORCYCLE_MILES);

/**
 * Splitting the overall car rate into day and night.
 *
 * NHTSA gives two figures: night carries about 25% of travel, and the night rate
 * per mile is about three times the day rate. Those two together fix both rates
 * against the overall rate R with no further assumption:
 *
 *   R = (1 - n) * day + n * (3 * day)   =>   day = R / (1 + 2n)
 */
const NIGHT_TRAVEL_SHARE = 0.25;
const NIGHT_TO_DAY_RATIO = 3;
const CAR_DAY = CAR_OVERALL / (1 + NIGHT_TRAVEL_SHARE * (NIGHT_TO_DAY_RATIO - 1));
const CAR_NIGHT = CAR_DAY * NIGHT_TO_DAY_RATIO;

const HELMET_EFFECTIVENESS = 0.37;

const mobility = {
  version: '1.0.0',
  domain: 'mobility',
  factors: [
    {
      id: 'mobility.car_day',
      label: 'Driving, daylight',
      domain: 'mobility',
      kind: 'acute',
      unit: 'per_100_miles',
      value: r(CAR_DAY),
      controllable: true,
      source: FARS_OVER_FHWA_2024,
      notes: `Derived: ${PV_OCCUPANT_DEATHS.toLocaleString()} passenger vehicle occupant deaths in 2024 over ${(PASSENGER_VEHICLE_MILES / 1e12).toFixed(3)} trillion passenger vehicle miles gives ${r(CAR_OVERALL, 3)} micromorts per 100 miles overall. Split into day and night using NHTSA's finding that a quarter of travel happens after dark at about three times the daytime rate per mile. The night ratio is from 2005 data applied to 2024 rates, so the split is less certain than the overall figure.`,
    },
    {
      id: 'mobility.car_night',
      label: 'Driving, after dark',
      domain: 'mobility',
      kind: 'acute',
      unit: 'per_100_miles',
      value: r(CAR_NIGHT),
      controllable: true,
      source: NHTSA_NIGHT,
      notes: `Three times the daylight rate, per NHTSA DOT HS 810 637. The underlying overall rate is the 2024 FARS and FHWA figure of ${r(CAR_OVERALL, 3)} micromorts per 100 miles.`,
    },
    {
      id: 'mobility.motorcycle',
      label: 'Riding a motorcycle',
      domain: 'mobility',
      kind: 'acute',
      unit: 'per_100_miles',
      value: r(MOTORCYCLE, 2),
      controllable: true,
      source: FARS_OVER_FHWA_2024,
      mitigations: {
        helmet: { multiplier: r(1 - HELMET_EFFECTIVENESS, 2), source: IIHS_HELMETS },
      },
      notes: `Derived: ${MOTORCYCLIST_DEATHS.toLocaleString()} motorcyclist deaths in 2024 over ${(MOTORCYCLE_MILES / 1e9).toFixed(1)} billion motorcycle miles. That is ${(MOTORCYCLE / CAR_OVERALL).toFixed(0)} times the passenger vehicle rate per mile. IIHS separately states the ratio is "almost 27 times" for cars specifically; the difference is that this figure's denominator includes light trucks and SUVs. The range is 27 to ${(MOTORCYCLE / CAR_OVERALL).toFixed(0)} times.`,
    },
  ],
};

/* ========================================================================== */
/* Occupation                                                                 */
/* ========================================================================== */

/**
 * BLS publishes rates per 100,000 full-time equivalent workers per year.
 * One per 100,000 is ten per million, so the rate times ten is micromorts.
 */
const ratePer100kToMicromorts = (rate) => rate * 10;

/**
 * Only the SOC major groups BLS published rates for in Table 4 are here.
 * Detailed occupations, and the groups not in that table, are in MISSING_DATA.md:
 * assigning an unlisted occupation the all-worker average would badly overstate
 * a desk job and understate a hazardous one.
 */
const OCCUPATION_GROUPS = [
  ['45-0000', 'Farming, fishing and forestry', 24.4],
  ['53-0000', 'Transportation and material moving', 13.6],
  ['47-0000', 'Construction and extraction', 12.9],
  ['49-0000', 'Installation, maintenance and repair', 9.0],
  ['33-0000', 'Protective service', 8.2],
  ['37-0000', 'Building and grounds cleaning and maintenance', 7.1],
  ['00-0000', 'All workers, average across every occupation', 3.5],
];

const occupation = {
  version: '1.0.0',
  domain: 'occupation',
  factors: OCCUPATION_GROUPS.map(([soc, label, rate]) => ({
    id: `occupation.soc.${soc}`,
    label,
    domain: 'occupation',
    kind: 'acute',
    unit: 'per_year',
    value: r(ratePer100kToMicromorts(rate), 1),
    // Changing career is not a dashboard suggestion. Occupation belongs to the
    // structural band: worth seeing, not worth being told to fix.
    controllable: false,
    source: BLS_CFOI_2023,
    notes: `${rate} fatal work injuries per 100,000 full-time equivalent workers in 2023. Covers fatal injuries only, not occupational disease. The all-worker rate that year was 3.5.`,
  })),
};

/* ========================================================================== */
/* Chronic                                                                    */
/* ========================================================================== */

// Smoking. Doll gives 10 years lost for a continuing smoker but does not give a
// per-cigarette dose in the abstract, so the per-cigarette figure below assumes
// a pack a day. That assumption is disclosed in the note and in MISSING_DATA.md.
const SMOKER_YEARS_LOST = 10;
const ASSUMED_CIGARETTES_PER_DAY = 20;
const SMOKER_MICROLIVES_PER_DAY = yearsLostToMicrolivesPerDay(SMOKER_YEARS_LOST);
const MICROLIVES_PER_CIGARETTE = SMOKER_MICROLIVES_PER_DAY / ASSUMED_CIGARETTES_PER_DAY;

// BMI. Hazard ratio per 5 kg/m2 above 25, North America.
const BMI_HR_PER_5_UNITS = 1.29;
const BMI_MICROLIVES_PER_UNIT_PER_DAY =
  yearsLostToMicrolivesPerDay(hazardRatioToYearsLost(BMI_HR_PER_5_UNITS)) / 5;

// Exercise. Negative values are life gained.
const EXERCISE_FIRST_BLOCK_YEARS_GAINED = 3;
const EXERCISE_ADDITIONAL_BLOCK_HR = 0.96;
const EXERCISE_FIRST_BLOCK = -yearsLostToMicrolivesPerDay(EXERCISE_FIRST_BLOCK_YEARS_GAINED);
const EXERCISE_ADDITIONAL_BLOCK = yearsLostToMicrolivesPerDay(
  hazardRatioToYearsLost(EXERCISE_ADDITIONAL_BLOCK_HR),
);

// Alcohol. Wood gives life expectancy at 40 by weekly consumption band. The
// marginal slope is taken between the two lowest bands above the threshold,
// where the data are densest and the dose response is closest to linear.
const GRAMS_PER_US_STANDARD_DRINK = 14;
const BAND_LOW = { gramsPerWeek: 150, yearsLost: 0.5 };   // 100-200 g/wk
const BAND_MID = { gramsPerWeek: 275, yearsLost: 1.5 };   // 200-350 g/wk
const YEARS_LOST_PER_GRAM_WEEK =
  (BAND_MID.yearsLost - BAND_LOW.yearsLost) /
  (BAND_MID.gramsPerWeek - BAND_LOW.gramsPerWeek);
const YEARS_LOST_PER_WEEKLY_DRINK =
  YEARS_LOST_PER_GRAM_WEEK * GRAMS_PER_US_STANDARD_DRINK;
// One extra drink a week, sustained, is one extra drink on 52.18 occasions a year.
const DRINKS_PER_REFERENCE_LIFETIME = REFERENCE_ADULT_YEARS * 52.1786;
const MICROLIVES_PER_ADDITIONAL_DRINK =
  (YEARS_LOST_PER_WEEKLY_DRINK * DAYS_PER_YEAR * 24 * 60) /
  MINUTES_PER_MICROLIFE /
  DRINKS_PER_REFERENCE_LIFETIME;

const chronic = {
  version: '1.0.0',
  domain: 'chronic',
  factors: [
    {
      id: 'chronic.cigarette',
      label: 'Cigarettes',
      domain: 'chronic',
      kind: 'chronic',
      unit: 'per_day',
      value: r(MICROLIVES_PER_CIGARETTE),
      controllable: true,
      source: DOLL_2004,
      notes: `Derived: 10 years of life expectancy spread over a ${REFERENCE_ADULT_YEARS} year adult lifetime is ${r(SMOKER_MICROLIVES_PER_DAY, 2)} microlives a day for a smoker, or ${r(MICROLIVES_PER_CIGARETTE * MINUTES_PER_MICROLIFE, 1)} minutes per cigarette at an assumed pack a day. THE PACK-A-DAY DENOMINATOR IS AN ASSUMPTION, not a published figure. Independent estimates put a cigarette at 15 minutes (Spiegelhalter, BMJ 2012) and about 20 minutes (University College London, 2024), so the plausible range is roughly 13 to 20 minutes.`,
    },
    {
      id: 'chronic.alcohol_first_drink',
      label: 'The first drink of the day',
      domain: 'chronic',
      kind: 'chronic',
      unit: 'per_day',
      value: 0,
      controllable: true,
      source: WOOD_2018,
      notes:
        'Zero, not omitted. Wood et al. found the lowest all-cause mortality at or below 100 g of alcohol a week, which is about one US standard drink a day, so no excess is measured in this band. The study covered current drinkers only, so it cannot say whether one drink a day is better or worse than none, and this app does not claim either.',
    },
    {
      id: 'chronic.alcohol_additional_drink',
      label: 'Each drink beyond the first of the day',
      domain: 'chronic',
      kind: 'chronic',
      unit: 'per_day',
      value: r(MICROLIVES_PER_ADDITIONAL_DRINK),
      controllable: true,
      source: WOOD_2018,
      notes: `Derived from the marginal slope between the 100-200 and 200-350 g per week bands: ${r(YEARS_LOST_PER_WEEKLY_DRINK, 3)} years of life expectancy per sustained extra drink a week. Consumption above 350 g a week costs far more per drink than this linear figure implies; heavy drinking is understated here.`,
    },
    {
      id: 'chronic.bmi_excess_per_unit',
      label: 'Body mass above a BMI of 25',
      domain: 'chronic',
      kind: 'chronic',
      unit: 'per_day',
      value: r(BMI_MICROLIVES_PER_UNIT_PER_DAY),
      controllable: true,
      source: GLOBAL_BMI_2016,
      notes: `Derived: a hazard ratio of ${BMI_HR_PER_5_UNITS} per 5 kg/m2 becomes ${r(hazardRatioToYearsLost(BMI_HR_PER_5_UNITS), 2)} years of life expectancy using a Gompertz slope of ${r(GOMPERTZ_B, 5)} per year, itself fitted from the SSA 2023 life table in this repo over ages 40 to 85. The meta-analysis excluded smokers and anyone with pre-existing disease, so this is the association in otherwise healthy people. Below a BMI of 20 mortality also rises; this app does not yet model the underweight side.`,
    },
    {
      id: 'chronic.exercise_first_15_min',
      label: 'The first 15 minutes of daily exercise',
      domain: 'chronic',
      kind: 'chronic',
      unit: 'per_day',
      value: r(EXERCISE_FIRST_BLOCK),
      controllable: true,
      source: WEN_2011,
      notes: `Negative because it is life gained. Derived: 3 years of life expectancy over a ${REFERENCE_ADULT_YEARS} year adult lifetime. This is the single largest positive factor in the app, and it comes from the smallest dose anyone has measured.`,
    },
    {
      id: 'chronic.exercise_additional_15_min',
      label: 'Each additional 15 minutes of daily exercise',
      domain: 'chronic',
      kind: 'chronic',
      unit: 'per_day',
      value: r(EXERCISE_ADDITIONAL_BLOCK),
      controllable: true,
      source: WEN_2011,
      notes: `Derived from the further 4 percent reduction in all-cause mortality per additional 15 minutes a day, converted through the same Gompertz slope. About a sixth of the first block's benefit, which is the point: the return falls away sharply after the first quarter hour.`,
    },
  ],
};

/* ========================================================================== */
/* Domains with nothing sourced yet                                           */
/* ========================================================================== */

// Environment and activity factors are not yet sourced. Empty is the honest
// state; see MISSING_DATA.md for what each one needs.
const environment = { version: '0.0.0', domain: 'environment', factors: [] };
const activity = { version: '0.0.0', domain: 'activity', factors: [] };

/* ========================================================================== */

const tables = { mobility, occupation, chronic, environment, activity };

for (const [name, table] of Object.entries(tables)) {
  writeFileSync(join(DATA, `${name}.json`), `${JSON.stringify(table, null, 2)}\n`);
  console.log(`${name}.json  ${table.factors.length} factors  v${table.version}`);
}

console.log(`\nGompertz slope b = ${GOMPERTZ_B.toFixed(5)} per year (doubling time ${(Math.log(2) / GOMPERTZ_B).toFixed(2)} years)`);
console.log('Car, overall     ', CAR_OVERALL.toFixed(3), 'micromorts / 100 mi');
console.log('Car, day / night ', CAR_DAY.toFixed(3), '/', CAR_NIGHT.toFixed(3));
console.log('Motorcycle       ', MOTORCYCLE.toFixed(2), `(${(MOTORCYCLE / CAR_OVERALL).toFixed(1)}x car)`);
