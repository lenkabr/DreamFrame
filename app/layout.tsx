import type { Metadata } from 'next';
import './globals.css';
import './recommendation.css';
import './story.css';
import './limits.css';
import './privacy.css';

export const metadata: Metadata = {
  title: 'Dreamframe — Every feeling has a film',
  description: 'Describe a feeling, a story, or a movie you loved. Dreamframe recommends the one film worth your evening.',
  openGraph: {
    title: 'Dreamframe — Every feeling has a film',
    description: 'One thoughtful movie recommendation, chosen for how you want to feel.',
    images: [{ url: 'https://lenkabr.github.io/DreamFrame/og.png', width: 1200, height: 630, alt: 'Dreamframe — Every feeling has a film.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dreamframe — Every feeling has a film',
    description: 'One thoughtful movie recommendation, chosen for how you want to feel.',
    images: ['https://lenkabr.github.io/DreamFrame/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
