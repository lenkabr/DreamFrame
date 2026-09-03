import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy — DreamFrame',
  description: 'A short, plain-language explanation of how the DreamFrame prototype handles information.',
};

export default function PrivacyPage() {
  return <main className="privacy-page">
    <header className="site-header">
      <Link className="brand" href="/" aria-label="DreamFrame home"><img className="brand-logo" src="/dreamframe-logo-white.svg" alt="" /><span>DreamFrame</span></Link>
      <span className="tagline">Every feeling has a film.</span>
      <nav className="site-nav" aria-label="Main navigation"><Link href="/story">The story behind DreamFrame <span aria-hidden="true">↗</span></Link></nav>
    </header>

    <article className="privacy-article">
      <p className="privacy-kicker"><span /> Prototype privacy</p>
      <h1>Privacy, in<br />plain language.</h1>
      <p className="privacy-intro">DreamFrame is a small, work-in-progress prototype. Here is what happens to the information you share while trying it.</p>

      <div className="privacy-sections">
        <section>
          <h2>When you ask for a film</h2>
          <p>Your prompt and the film titles you choose are processed by OpenAI to create a recommendation. DreamFrame uses TMDB to search for films and show accurate details and poster artwork.</p>
        </section>
        <section>
          <h2>What DreamFrame remembers</h2>
          <p>Your seen-film history and recommendation count are saved only in your browser. There are no user accounts or central profiles. Clearing this site’s browser data removes that information.</p>
        </section>
        <section>
          <h2>Basic technical information</h2>
          <p>Like most websites, the hosting services may process basic request information—such as an IP address, browser type, and request time—to operate and protect the site.</p>
        </section>
        <section>
          <h2>A small request</h2>
          <p>Please do not include sensitive personal information in your movie prompt. DreamFrame does not ask for your name or email address, and it does not sell personal information.</p>
        </section>
      </div>

      <p className="privacy-note">This notice may change as the prototype develops. External links, including LinkedIn and Instagram, follow their own privacy policies.</p>
      <p className="privacy-updated">Last updated: 1 September 2026</p>
    </article>

    <footer><span>DreamFrame</span><p>A calmer way to choose what to watch.</p><p><Link className="privacy-link active" href="/privacy" aria-current="page">Privacy</Link></p></footer>
  </main>;
}
