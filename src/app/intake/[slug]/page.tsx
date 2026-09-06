import { notFound } from 'next/navigation';
import { IntakeFlow } from '@/components/intake/IntakeFlow';
import { STEP_SLUGS, metaForSlug } from '@/components/intake/steps';

/** Every step is a real URL, so a half-finished intake is bookmarkable. */
export function generateStaticParams() {
  return STEP_SLUGS.map((slug) => ({ slug }));
}

export default async function IntakeStepPage({ params }: PageProps<'/intake/[slug]'>) {
  const { slug } = await params;
  if (!metaForSlug(slug)) notFound();
  return <IntakeFlow slug={slug} />;
}
