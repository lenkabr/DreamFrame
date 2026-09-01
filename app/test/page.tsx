'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Mode = 'mood' | 'similar' | 'favorites';
type Movie = { id: number; title: string; year: string; posterUrl: string | null; why: string; themes: string[]; feelings: string[] };
type Result = { movie?: Movie; rating?: number; note?: string; error?: string; loading?: boolean };

const TESTS: Array<{ id: string; label: string; mode: Mode; query: string; favorites?: string[]; checks: string }> = [
  { id: 'comfort', label: 'Comfort without sentimentality', mode: 'mood', query: 'I’ve had a rough week. Give me something comforting, but please not cheesy.', checks: 'Warm and restorative; not bleak, childish, or emotionally manipulative.' },
  { id: 'hopeful-cry', label: 'Moving but hopeful', mode: 'mood', query: 'I want to cry a bit, but I don’t want to end up miserable.', checks: 'Emotionally moving, but the ending or overall effect should not feel hopeless.' },
  { id: 'tense-safe', label: 'Exciting with boundaries', mode: 'mood', query: 'Something exciting, but nothing violent, scary, or cruel.', checks: 'Genuinely engaging while respecting every restriction.' },
  { id: 'disconnected', label: 'Vague emotional request', mode: 'mood', query: 'I feel strange and disconnected tonight.', checks: 'A thoughtful interpretation rather than a literal keyword match.' },
  { id: 'gentle-smart', label: 'Gentle and intelligent', mode: 'mood', query: 'I’m exhausted. I want something beautiful and smart, but calm and not sad.', checks: 'Low intensity, visually distinctive, thoughtful, and emotionally safe.' },
  { id: 'dark-comedy', label: 'Conflicting qualities', mode: 'mood', query: 'Maybe a weird dark comedy? Just nothing graphic or super depressing.', checks: 'Darkly funny and distinctive without violating the content limits.' },
  { id: 'similar-anna', label: 'Similar to a period drama', mode: 'similar', query: 'Anna Karenina', checks: 'Related in tone, themes, period, or emotional scale—not merely another famous drama.' },
  { id: 'similar-yang', label: 'Similar to quiet science fiction', mode: 'similar', query: 'After Yang', checks: 'Quiet, humane, reflective science fiction or a very close thematic match.' },
  { id: 'favorites-mixed', label: 'Mixed favorite-film taste', mode: 'favorites', query: '', favorites: ['Arrival', 'Perfect Days', 'Prisoners'], checks: 'Reflects the shared taste without recommending any of the three favorites.' },
  { id: 'favorites-artful', label: 'Artful favorite-film taste', mode: 'favorites', query: '', favorites: ['Black Swan', 'The Handmaiden', 'In the Mood for Love'], checks: 'Visually authored and psychologically rich without repeating a favorite.' },
];

const STORAGE_KEY = 'dreamframe-evaluation-v2';

export default function TestPage() {
  const [results, setResults] = useState<Record<string, Result>>({});
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try { setResults(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); } catch { setResults({}); }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
  }, [hydrated, results]);

  const rated = useMemo(() => Object.values(results).filter((result) => result.rating).length, [results]);

  async function runTest(test: (typeof TESTS)[number]) {
    setResults((current) => ({ ...current, [test.id]: { ...current[test.id], loading: true, error: undefined } }));
    const previousTitle = results[test.id]?.movie?.title;
    try {
      const response = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: test.mode,
          query: test.query,
          favorites: test.favorites ?? [],
          excludedTitles: previousTitle ? [previousTitle] : [],
        }),
      });
      const data = await response.json() as Movie & { error?: string };
      if (!response.ok) throw new Error(data.error || 'No recommendation returned.');
      setResults((current) => ({ ...current, [test.id]: { ...current[test.id], movie: data, loading: false, error: undefined } }));
    } catch (error) {
      setResults((current) => ({ ...current, [test.id]: { ...current[test.id], loading: false, error: error instanceof Error ? error.message : 'Test failed.' } }));
    }
  }

  function updateResult(id: string, patch: Partial<Result>) {
    setResults((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }

  async function copySummary() {
    const summary = TESTS.map((test, index) => {
      const result = results[test.id] ?? {};
      return `${index + 1}. ${test.label}\nPrompt: ${test.query || `Favorites: ${test.favorites?.join(', ')}`}\nRecommendation: ${result.movie?.title ?? 'Not tested'}\nRating: ${result.rating ?? 'Not rated'}/5\nNote: ${result.note?.trim() || '—'}`;
    }).join('\n\n');
    await navigator.clipboard.writeText(`DreamFrame recommendation test results\n\n${summary}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return <main className="test-page">
    <header className="test-header">
      <Link className="brand" href="/" aria-label="Back to DreamFrame"><img className="brand-logo" src="/dreamframe-logo-white.svg" alt="" /><span>DreamFrame</span></Link>
      <span className="test-badge">Internal evaluation</span>
    </header>

    <section className="test-intro">
      <div><p className="eyebrow"><span /> Recommendation engine V1</p><h1>Quality test</h1><p>Run each prepared situation, judge the recommendation, and leave a short note. Your progress stays in this browser.</p></div>
      <div className="test-progress"><strong>{rated}<span>/10</span></strong><small>recommendations rated</small><button type="button" onClick={copySummary} disabled={rated === 0}>{copied ? 'Copied ✓' : 'Copy results'}</button></div>
    </section>

    <section className="test-list">
      {TESTS.map((test, index) => {
        const result = results[test.id] ?? {};
        return <article className="test-case" key={test.id}>
          <div className="test-number">{String(index + 1).padStart(2, '0')}</div>
          <div className="test-details">
            <div className="test-title-row"><div><span className="mode-label">{test.mode === 'mood' ? 'How I feel' : test.mode === 'similar' ? 'Similar to' : 'My favorites'}</span><h2>{test.label}</h2></div><button className="run-test" type="button" onClick={() => runTest(test)} disabled={result.loading}>{result.loading ? 'Finding…' : result.movie ? 'Run again' : 'Run test'} <span>→</span></button></div>
            <blockquote>{test.query || test.favorites?.join(' · ')}</blockquote>
            <p className="test-check"><span>What to check</span>{test.checks}</p>
            {result.error && <p className="test-error" role="alert">{result.error}</p>}
            {result.movie && <div className="test-result">
              {result.movie.posterUrl ? <img src={result.movie.posterUrl} alt={`${result.movie.title} poster`} /> : <div className="test-poster-empty">No poster</div>}
              <div className="test-result-copy"><p className="result-kicker">DreamFrame recommended</p><h3>{result.movie.title} <span>{result.movie.year}</span></h3><p>{result.movie.why}</p><div className="mini-tags">{result.movie.themes.map((theme) => <span key={theme}>{theme}</span>)}</div></div>
            </div>}
            {result.movie && <div className="test-review">
              <fieldset><legend>Your rating</legend><div className="rating-row">{[1, 2, 3, 4, 5].map((rating) => <button key={rating} type="button" className={result.rating === rating ? 'selected' : ''} aria-label={`Rate ${rating} out of 5`} onClick={() => updateResult(test.id, { rating })}>{rating}</button>)}</div><small>1 = completely wrong · 5 = excellent match</small></fieldset>
              <label>What felt right or wrong?<textarea value={result.note ?? ''} onChange={(event) => updateResult(test.id, { note: event.target.value })} placeholder="Example: Good emotional match, but much too sad." rows={3} /></label>
            </div>}
          </div>
        </article>;
      })}
    </section>
  </main>;
}
