'use client';

/**
 * The seven step forms.
 *
 * Each one takes the payload it last saved and reports changes upward; none of
 * them owns persistence. They are deliberately plain: a form that a person is
 * filling in on a phone at a kitchen table should not have anything moving in it.
 *
 * Two conventions run through all of them.
 *
 * A BLANK FIELD MEANS UNKNOWN, NOT ZERO. Leaving annual mileage empty removes
 * the factor and is reported through coverage; typing 0 is a claim that you do
 * not drive. The engine treats those differently and so does the copy.
 *
 * NOTHING IS PRE-FILLED WITH A NATIONAL AVERAGE. A default would be invisible
 * once saved, and a number the user never entered would end up on their
 * dashboard looking like something they told us.
 */

import { useMemo } from 'react';
import { Choice, Field, NumberInput, Select, TextInput } from '@/components/ui/primitives';
import { factorsByDomain } from '@/lib/risk';
import { seededStates } from '@/lib/providers/environment/seeded';
import type { Profile, Sex } from '@/lib/risk/types';
import type { BaselinePayload } from '@/lib/store';

export interface StepFormProps<T> {
  value: T;
  onChange: (value: T) => void;
}

/** Parse a form field into a number, treating blank as unknown rather than zero. */
function num(raw: string): number | undefined {
  if (raw.trim() === '') return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function patch<T extends object>(value: T, key: keyof T, next: unknown): T {
  const updated = { ...value, [key]: next };
  // An undefined field is an absent field. Keeping the key with an undefined
  // value would serialize to null and read back as "answered, with nothing".
  if (next === undefined) delete updated[key];
  return updated;
}

/* -------------------------------------------------------------------------- */
/* 1. Baseline                                                                */
/* -------------------------------------------------------------------------- */

export function BaselineForm({ value, onChange }: StepFormProps<BaselinePayload>) {
  return (
    <div className="flex flex-col gap-6">
      <Field
        label="Age"
        htmlFor="age"
        hint="Sets your remaining life expectancy from the SSA period life table. The same acute exposure costs a 25 year old more than it costs a 75 year old, and the dashboard shows why."
      >
        <NumberInput
          id="age"
          min={18}
          max={110}
          suffix="years"
          value={value.age ?? ''}
          onChange={(e) => onChange(patch(value, 'age', num(e.target.value)))}
          placeholder="34"
        />
      </Field>

      <Field
        label="Sex at birth"
        hint="Life tables and nearly all published risk data are stratified on this axis and no other. It is a limitation of the sources, not a claim about anyone."
      >
        <Choice<Sex>
          name="Sex at birth"
          value={value.sex}
          onChange={(sex) => onChange({ ...value, sex })}
          options={[
            { value: 'female', label: 'Female' },
            { value: 'male', label: 'Male' },
          ]}
        />
      </Field>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Location                                                                */
/* -------------------------------------------------------------------------- */

export function LocationForm({
  value,
  onChange,
}: StepFormProps<NonNullable<Profile['location']>>) {
  const states = useMemo(() => seededStates(), []);

  return (
    <div className="flex flex-col gap-6">
      <Field
        label="State"
        htmlFor="state"
        hint="Road fatality rates run from 0.59 deaths per 100 million miles in Massachusetts to 1.81 in Mississippi. Your state scales every mile you drive."
      >
        <Select
          id="state"
          value={value.state ?? ''}
          onChange={(e) =>
            onChange(patch(value, 'state', e.currentTarget.value || undefined))
          }
        >
          <option value="">Not given</option>
          {states.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="ZIP code"
        htmlFor="zip"
        hint="Air quality, radon zone and distance to the nearest trauma center are all ZIP-derived. None of those datasets is loaded yet, so a ZIP buys you nothing today. It is here so that it does the moment they are."
      >
        <TextInput
          id="zip"
          inputMode="numeric"
          maxLength={5}
          placeholder="94103"
          value={value.zip ?? ''}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 5);
            onChange(patch(value, 'zip', digits || undefined));
          }}
        />
      </Field>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Work                                                                    */
/* -------------------------------------------------------------------------- */

export function WorkForm({
  value,
  onChange,
}: StepFormProps<NonNullable<Profile['occupation']>>) {
  // The picker is built from the factor table, so it can only ever offer
  // occupations that have a real BLS rate behind them.
  const occupations = useMemo(
    () =>
      factorsByDomain('occupation')
        .map((f) => ({ code: f.id.replace('occupation.soc.', ''), label: f.label, value: f.value }))
        .sort((a, b) => b.value - a.value),
    [],
  );

  return (
    <div className="flex flex-col gap-6">
      <Field
        label="Occupation group"
        htmlFor="soc"
        hint="These are the groups the Bureau of Labor Statistics publishes a fatal injury rate for. Office, healthcare, education and sales are missing because BLS did not publish a rate for them in this table, and giving them the all-worker average would badly overstate a desk job."
      >
        <Select
          id="soc"
          value={value.socCode ?? ''}
          onChange={(e) => {
            const socCode = e.currentTarget.value;
            if (!socCode) {
              onChange({ socCode: '' });
              return;
            }
            const found = occupations.find((o) => o.code === socCode);
            onChange({ ...value, socCode, label: found?.label });
          }}
        >
          <option value="">Not given, or not listed</option>
          {occupations.map((o) => (
            <option key={o.code} value={o.code}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Hours a week"
        htmlFor="hours"
        hint="BLS rates are per full-time-equivalent worker, so hours scale the exposure against a 40 hour year. Leave it blank and a full-time year is assumed."
      >
        <NumberInput
          id="hours"
          min={0}
          max={168}
          suffix="hours"
          placeholder="40"
          value={value.hoursPerWeek ?? ''}
          onChange={(e) => onChange(patch(value, 'hoursPerWeek', num(e.target.value)))}
        />
      </Field>

      <p className="border-l-2 border-rule pl-3 text-[13px] leading-relaxed text-ink-secondary">
        Occupation is never listed as something to fix. Changing career is not a
        dashboard suggestion, so it sits with the things worth seeing rather than
        the things worth doing.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. Getting around                                                          */
/* -------------------------------------------------------------------------- */

export function MobilityForm({
  value,
  onChange,
}: StepFormProps<NonNullable<Profile['mobility']>>) {
  const nightPercent =
    value.nightDrivingShare === undefined ? '' : Math.round(value.nightDrivingShare * 100);

  return (
    <div className="flex flex-col gap-6">
      <Field
        label="Car, miles a year"
        htmlFor="car"
        hint="The US average is around 13,500. Blank means unknown and removes the factor; 0 means you do not drive."
      >
        <NumberInput
          id="car"
          min={0}
          suffix="miles"
          placeholder="13,500"
          value={value.carMilesPerYear ?? ''}
          onChange={(e) => onChange(patch(value, 'carMilesPerYear', num(e.target.value)))}
        />
      </Field>

      <Field
        label="Share of that after dark"
        htmlFor="night"
        hint="A quarter of all US travel happens after dark, at about three times the daytime fatality rate per mile. Leaving this blank counts every mile as daylight, which understates the number."
      >
        <NumberInput
          id="night"
          min={0}
          max={100}
          suffix="%"
          placeholder="25"
          value={nightPercent}
          onChange={(e) => {
            const pct = num(e.target.value);
            onChange(
              patch(
                value,
                'nightDrivingShare',
                pct === undefined ? undefined : Math.min(Math.max(pct, 0), 100) / 100,
              ),
            );
          }}
        />
      </Field>

      <Field
        label="Motorcycle, miles a year"
        htmlFor="moto"
        hint="Per mile, this is about 36 times car travel. It is the single steepest number in the app."
      >
        <NumberInput
          id="moto"
          min={0}
          suffix="miles"
          value={value.motorcycleMilesPerYear ?? ''}
          onChange={(e) =>
            onChange(patch(value, 'motorcycleMilesPerYear', num(e.target.value)))
          }
        />
      </Field>

      <div className="flex flex-col gap-2 border-t border-rule pt-5">
        <p className="legend">Not scored yet</p>
        <p className="text-[13px] leading-relaxed text-ink-secondary">
          Cycling, walking, transit and flying are all in the intake design and
          none has a rate behind it yet. FARS gives the deaths; there is no
          equivalent of the federal vehicle-mileage tables for bikes and
          pedestrians, and commercial aviation needs passenger fatalities over
          enplanements across several years because most years have none.
          Entering them here would imply a number the app cannot produce, so the
          fields are absent rather than inert.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 5. Activities                                                              */
/* -------------------------------------------------------------------------- */

export function ActivitiesForm() {
  const activities = useMemo(() => factorsByDomain('activity'), []);

  if (activities.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-[15px] leading-relaxed text-ink">
          There is nothing to pick here yet, and that is deliberate.
        </p>
        <p className="text-[14px] leading-relaxed text-ink-secondary">
          Skydiving, scuba, climbing, motorsport, general aviation and the rest
          each need a rate from their own governing body, on their own
          denominator: jumps, dives, climber-days, flight hours. No single
          source publishes them together.
        </p>
        <p className="text-[14px] leading-relaxed text-ink-secondary">
          The widely circulated micromort lists would fill this screen in an
          afternoon. They also circulate without provenance and several are
          decades stale, so they are not going in. This step will stay empty
          until the numbers are real.
        </p>
        <p className="border-l-2 border-rule pl-3 text-[13px] leading-relaxed text-ink-secondary">
          Your result will say the activity domain was not evaluated, rather than
          implying you do nothing.
        </p>
      </div>
    );
  }

  // Reached once the activity table is populated; the picker is built then.
  return null;
}

/* -------------------------------------------------------------------------- */
/* 6. Habits                                                                  */
/* -------------------------------------------------------------------------- */

export function HabitsForm({
  value,
  onChange,
}: StepFormProps<NonNullable<Profile['habits']>>) {
  return (
    <div className="flex flex-col gap-6">
      <Field
        label="Cigarettes a day"
        htmlFor="cigs"
        hint="Around 13 minutes of life expectancy each, derived from the 50-year British doctors study. Independent estimates run to 20 minutes, so this figure is at the low end of a range the dashboard shows you."
      >
        <NumberInput
          id="cigs"
          min={0}
          max={200}
          suffix="a day"
          value={value.cigarettesPerDay ?? ''}
          onChange={(e) => onChange(patch(value, 'cigarettesPerDay', num(e.target.value)))}
        />
      </Field>

      <Field
        label="Alcoholic drinks a week"
        htmlFor="drinks"
        hint="US standard drinks. Up to about seven a week sits in the band where the largest study found no measured excess risk; each drink beyond that is scored."
      >
        <NumberInput
          id="drinks"
          min={0}
          max={200}
          suffix="a week"
          value={value.alcoholDrinksPerWeek ?? ''}
          onChange={(e) =>
            onChange(patch(value, 'alcoholDrinksPerWeek', num(e.target.value)))
          }
        />
      </Field>

      <Field
        label="Exercise, minutes a week"
        htmlFor="exercise"
        hint="The only thing in this app that gives days back. Ninety minutes a week, about fifteen a day, is worth three years of life expectancy against doing nothing, and most of the benefit is in that first quarter hour."
      >
        <NumberInput
          id="exercise"
          min={0}
          suffix="minutes"
          placeholder="90"
          value={value.exerciseMinutesPerWeek ?? ''}
          onChange={(e) =>
            onChange(patch(value, 'exerciseMinutesPerWeek', num(e.target.value)))
          }
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Height" htmlFor="height">
          <NumberInput
            id="height"
            min={50}
            max={280}
            suffix="cm"
            value={value.heightCm ?? ''}
            onChange={(e) => onChange(patch(value, 'heightCm', num(e.target.value)))}
          />
        </Field>
        <Field label="Weight" htmlFor="weight">
          <NumberInput
            id="weight"
            min={20}
            max={500}
            suffix="kg"
            value={value.weightKg ?? ''}
            onChange={(e) => onChange(patch(value, 'weightKg', num(e.target.value)))}
          />
        </Field>
      </div>
      <p className="-mt-2 text-[13px] leading-snug text-ink-secondary">
        Used for BMI, and only above 25. Mortality also rises below a BMI of 20
        and this app does not model that side yet, so someone underweight will
        see nothing here.
      </p>

      <Field
        label="Sleep, hours a night"
        htmlFor="sleep"
        hint="Recorded but not yet scored: there is no sourced factor for short or long sleep in the tables."
      >
        <NumberInput
          id="sleep"
          min={0}
          max={24}
          step={0.5}
          suffix="hours"
          value={value.sleepHoursPerNight ?? ''}
          onChange={(e) =>
            onChange(patch(value, 'sleepHoursPerNight', num(e.target.value)))
          }
        />
      </Field>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 7. Health import                                                           */
/* -------------------------------------------------------------------------- */

export function HealthForm() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[15px] leading-relaxed text-ink">
        Nothing to import. This is a web app, so there is no HealthKit or Health
        Connect bridge to read from.
      </p>
      <p className="text-[14px] leading-relaxed text-ink-secondary">
        If one existed it would fill in exercise minutes, sleep, height and
        weight, which is the whole of the previous step. Everything the import
        would provide can be typed, and skipping this changes nothing about your
        result.
      </p>
      <button
        type="button"
        disabled
        className="w-fit cursor-not-allowed border border-rule px-4 py-2 text-[14px] text-ink-tertiary"
        style={{ borderRadius: 2 }}
      >
        Import from Health
      </button>
      <p className="text-[13px] text-ink-tertiary">
        Disabled, and it will stay disabled until there is a native app behind it.
      </p>
    </div>
  );
}
