import type { Metadata } from 'next';
import { Inter, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

/*
 * A monospace with a real zero and unambiguous digits, for anywhere a figure
 * needs to be read character by character: a factor id, a ZIP, a citation year.
 */
const plexMono = IBM_Plex_Mono({
  variable: '--font-mono-stack',
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Blind Spot',
  description:
    'An honest estimate of your annual mortality exposure, split into what you can change and what you cannot.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${inter.variable} ${plexMono.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
