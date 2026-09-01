import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'The story behind DreamFrame',
  description: 'Why Lenka decided to build DreamFrame—a more emotional way to discover what to watch.',
};

export default function StoryPage() {
  return <main className="story-page">
    <header className="site-header">
      <Link className="brand" href="/" aria-label="DreamFrame home"><img className="brand-logo" src="/dreamframe-logo-white.svg" alt="" /><span>DreamFrame</span></Link>
      <span className="tagline">Every feeling has a film.</span>
      <nav className="site-nav" aria-label="Main navigation"><Link className="active" href="/story" aria-current="page">The story behind DreamFrame</Link></nav>
    </header>

    <article className="story-article">
      <p className="story-kicker"><span /> A personal project</p>
      <h1>The story behind<br />DreamFrame</h1>

      <div className="story-body">
        <p className="story-lead">I love movies. I feel like they can transport me into another world and bring up all kinds of feelings and emotions.</p>

        <p>When I’m looking for my next watch, I often find myself wanting to feel something specific—or looking for a film that captures a particular feeling or state of mind. But the challenge with the services I was using was that their recommendations were never really based on how a movie would make me feel, or which films created similar feelings and emotions.</p>

        <p>I knew how to describe what I wanted: a movie about facing challenges, discovering new opportunities, feeling hopeless or lost—or simply a film that would leave me with a particular feeling afterward. But I was never able to search for movies that way.</p>

        <p className="story-emphasis">So I decided to build this little engine and brain, mostly for myself.</p>

        <p>If you’re reading this, perhaps you also look for your next movie in a similar way. Or maybe you’re simply curious. Either way, I hope you find something that leaves you feeling exactly how you hoped, matches your mood, or gives you whatever you’re looking for.</p>

        <p>This isn’t a commercial project. I wanted to learn by working with the latest technology and build something that solves a problem I had—a product I couldn’t find but wished existed.</p>

        <div className="story-signoff">
          <p>If you’d like to connect, you can find my LinkedIn and Instagram below.</p>
          <p>Cheers,<br /><strong>Lenka</strong></p>
          <div className="story-socials" aria-label="Connect with Lenka">
            <a href="https://www.linkedin.com/in/lenka-brozmanov%C3%A1-20b255a5" target="_blank" rel="noreferrer">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 8.2H3.2V21h3.3V8.2ZM4.85 3A1.93 1.93 0 1 0 4.85 6.86 1.93 1.93 0 0 0 4.85 3ZM21 13.65c0-3.85-2.05-5.64-4.79-5.64a4.14 4.14 0 0 0-3.74 2.05V8.2H9.18V21h3.29v-6.34c0-1.67.32-3.29 2.39-3.29 2.04 0 2.07 1.91 2.07 3.4V21H21v-7.35Z" /></svg>
              <span>LinkedIn</span>
            </a>
            <a href="https://www.instagram.com/lenka.br/" target="_blank" rel="noreferrer">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 2h9.6A5.2 5.2 0 0 1 22 7.2v9.6a5.2 5.2 0 0 1-5.2 5.2H7.2A5.2 5.2 0 0 1 2 16.8V7.2A5.2 5.2 0 0 1 7.2 2Zm-.18 2A3.02 3.02 0 0 0 4 7.02v9.96A3.02 3.02 0 0 0 7.02 20h9.96A3.02 3.02 0 0 0 20 16.98V7.02A3.02 3.02 0 0 0 16.98 4H7.02Zm10.23 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" /></svg>
              <span>Instagram</span>
            </a>
          </div>
        </div>
      </div>
    </article>

    <footer><span>DreamFrame</span><p>A calmer way to choose what to watch.</p><p><Link className="privacy-link" href="/privacy">Privacy</Link></p></footer>
  </main>;
}
