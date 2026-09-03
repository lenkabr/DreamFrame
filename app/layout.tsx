import type { Metadata } from 'next';
import './globals.css';
import './recommendation.css';
import './story.css';
import './limits.css';
import './privacy.css';

const SITE_URL = 'https://dream-frame-eight.vercel.app';
const SITE_DESCRIPTION = 'Describe a feeling, your mood, how you want to feel, or the kind of story you would like to see. DreamFrame will find the one film worth your evening.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'DreamFrame — Every feeling has a film',
  description: SITE_DESCRIPTION,
  applicationName: 'DreamFrame',
  alternates: { canonical: '/' },
  keywords: ['movie recommendations', 'film recommendations', 'mood-based movies', 'what to watch', 'film discovery'],
  authors: [{ name: 'Lenka Brozmanova' }],
  creator: 'Lenka Brozmanova',
  verification: { google: 'ZkvAYj7WCiDlkxiufJzxbWEn4QuZlx8r8kQGT3ccsDc' },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
  },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'DreamFrame',
    title: 'DreamFrame — Every feeling has a film',
    description: 'One thoughtful movie recommendation, chosen for how you want to feel.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'DreamFrame — Every feeling has a film.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DreamFrame — Every feeling has a film',
    description: 'One thoughtful movie recommendation, chosen for how you want to feel.',
    images: ['/og.png'],
  },
};

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'DreamFrame',
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: 'EntertainmentApplication',
  operatingSystem: 'Any',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  creator: { '@type': 'Person', name: 'Lenka Brozmanova' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      </body>
    </html>
  );
}
