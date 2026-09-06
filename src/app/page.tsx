import Link from 'next/link';
import { allFactors } from '@/lib/risk';
import { FIRST_SLUG } from '@/components/intake/steps';

/**
 * The landing page.
 *
 * It has one job: say what the number means before anyone sees theirs. A
 * mortality figure with no frame around it is a number people either dismiss or
 * panic at, and both reactions miss the point.
 *
 * The counts at the bottom are read from the factor tables at build time rather
 * than written into the copy, so the page cannot claim coverage the app does
 * not have.
 */
export default function Home() {
  const factors = allFactors();
  const sourced = factors.length;
  const domains = new Set(factors.map((f) => f.domain)).size;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-5 py-16 sm:px-6 sm:py-24">
      <header className="flex flex-col gap-5">
        <p className="legend">Blind Spot</p>
        <h1 className="text-[clamp(1.75rem,5.5vw,2.5rem)] font-medium leading-[1.15] tracking-tight text-ink">
          Most of what is likely to kill you is already in your week.
        </h1>
        <p className="max-w-xl text-[16px] leading-relaxed text-ink-secondary">
          People fear skydiving and ignore the commute. This works out your
          annual mortality exposure from what you actually do, converts it into
          expected days of life, and sorts it by size. Usually the top line is
          something you did this morning.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          href={`/intake/${FIRST_SLUG}`}
          className="w-fit bg-ink px-5 py-2.5 text-[14px] font-medium text-ground hover:opacity-90"
          style={{ borderRadius: 2 }}
        >
          Start
        </Link>
        <span className="text-[13px] text-ink-secondary">
          Two questions are required. Everything else can be skipped.
        </span>
      </div>

      <section className="flex flex-col gap-4 border-t border-rule pt-8">
        <h2 className="legend">How the number is built</h2>
        <dl className="flex flex-col divide-y divide-rule">
          <Row
            term="Two units, never added"
            detail="A micromort is a one-in-a-million chance of dying today. A microlife is thirty minutes off your life expectancy. Summing them is the standard mistake in this field. Both are converted separately into expected days of life lost per year, and only then combined."
          />
          <Row
            term="Age changes the answer"
            detail="A micromort costs a millionth of whatever life you have left, so the same exposure costs a 25 year old more than a 75 year old. Chronic habits do not work that way and are not scaled."
          />
          <Row
            term="Nothing is invented"
            detail={`Every factor cites a real table. Where a number could not be sourced it is absent, not estimated, and your result says which domains it could not evaluate. ${sourced} factors across ${domains} domains today; the gaps are listed in the repository.`}
          />
          <Row
            term="This is not a prediction"
            detail="These are population averages applied to what you told us. Nothing here knows anything about you specifically, and none of it is medical advice."
          />
        </dl>
      </section>
    </main>
  );
}

function Row({ term, detail }: { term: string; detail: string }) {
  return (
    <div className="flex flex-col gap-1.5 py-4 sm:flex-row sm:gap-8">
      <dt className="text-[14px] font-medium text-ink sm:w-48 sm:shrink-0">{term}</dt>
      <dd className="text-[14px] leading-relaxed text-ink-secondary">{detail}</dd>
    </div>
  );
}
