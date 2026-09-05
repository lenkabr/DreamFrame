'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type SeenEntry = {
  id: number;
  title: string;
  year?: string;
  posterUrl?: string | null;
  status: 'seen';
  updatedAt: number;
};

type MovieSuggestion = { id: number; title: string; year: string; posterUrl: string | null };
const STORAGE_KEY = 'dreamframe-taste-v1';

function readSeenMovies(): SeenEntry[] {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as Array<SeenEntry & { status?: string }>;
    return stored.filter((entry): entry is SeenEntry => entry.status === 'seen' && Number.isFinite(entry.id) && Boolean(entry.title));
  } catch {
    return [];
  }
}

export default function SeenMoviesClient() {
  const [movies, setMovies] = useState<SeenEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readSeenMovies();
    const readyTimer = window.setTimeout(() => {
      setMovies(stored);
      setReady(true);
    }, 0);

    const incomplete = stored.filter((movie) => !movie.year || !movie.posterUrl);
    if (incomplete.length === 0) return () => window.clearTimeout(readyTimer);

    Promise.all(incomplete.map(async (movie) => {
      try {
        const response = await fetch(`/api/tmdb?query=${encodeURIComponent(movie.title)}`);
        const data = await response.json() as { results?: MovieSuggestion[] };
        return data.results?.find((result) => result.id === movie.id) ?? null;
      } catch {
        return null;
      }
    })).then((details) => {
      const enriched = stored.map((movie) => {
        const match = details.find((detail) => detail?.id === movie.id);
        return match ? { ...movie, year: match.year, posterUrl: match.posterUrl } : movie;
      });
      setMovies(enriched);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(enriched));
    });
    return () => window.clearTimeout(readyTimer);
  }, []);

  function removeMovie(id: number) {
    const updated = movies.filter((movie) => movie.id !== id);
    setMovies(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  return <main className="seen-page">
    <header className="site-header">
      <Link className="brand" href="/" aria-label="DreamFrame home"><img className="brand-logo" src="/dreamframe-logo-white.svg" alt="" /><span>DreamFrame</span></Link>
      <span className="tagline">Every feeling has a film.</span>
      <nav className="site-nav" aria-label="Main navigation"><Link className="active" href="/seen" aria-current="page">Already seen</Link><Link href="/story">The story behind DreamFrame</Link></nav>
    </header>

    <section className="seen-content">
      <div className="seen-heading">
        <p className="story-kicker"><span /> Your film memory</p>
        <h1>Already seen</h1>
        <p>DreamFrame won’t recommend these films to you again.</p>
      </div>

      {ready && movies.length === 0 && <div className="seen-empty">
        <p>No films here yet.</p>
        <span>When you choose “I’ve already seen this,” the film will appear here.</span>
        <Link href="/">Find a film <span aria-hidden="true">→</span></Link>
      </div>}

      {movies.length > 0 && <div className="seen-grid">
        {[...movies].sort((a, b) => b.updatedAt - a.updatedAt).map((movie) => <article className="seen-card" key={movie.id}>
          {movie.posterUrl ? <img src={movie.posterUrl} alt={`${movie.title} movie poster`} /> : <div className="seen-poster-empty"><span>Poster unavailable</span></div>}
          <div className="seen-card-copy"><div><h2>{movie.title}</h2>{movie.year && <p>{movie.year}</p>}</div><button type="button" onClick={() => removeMovie(movie.id)} aria-label={`Remove ${movie.title} from already seen`}>Remove</button></div>
        </article>)}
      </div>}

      <p className="seen-note">Stored only in this browser. This list won’t follow you to another device and may disappear if you clear your browser data.</p>
    </section>
  </main>;
}
