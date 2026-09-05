import type { Metadata } from 'next';
import SeenMoviesClient from './SeenMoviesClient';

export const metadata: Metadata = {
  title: 'Already seen — DreamFrame',
  description: 'Movies you have already seen and DreamFrame will not recommend again.',
  alternates: { canonical: '/seen' },
  robots: { index: false, follow: false },
};

export default function SeenPage() {
  return <SeenMoviesClient />;
}
