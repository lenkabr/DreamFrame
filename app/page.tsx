'use client';

import { useEffect, useMemo, useState } from 'react';

type Mode = 'mood' | 'similar' | 'favorites';
type RecommendedMovie = { id: number; title: string; year: string; runtime: string; genres: string[]; overview: string; posterUrl: string | null; why: string; themes: string[]; feelings: string[] };
type TasteStatus = 'loved' | 'not-for-me' | 'seen';
type TasteEntry = { id: number; title: string; status: TasteStatus; updatedAt: number };
const prompts: Record<Mode, string> = { mood: 'I want something that makes me appreciate life...', similar: 'Lost in Translation', favorites: 'Add a film you love' };
const TASTE_STORAGE_KEY = 'dreamframe-taste-v1';

export default function Home() {
  const [mode, setMode] = useState<Mode>('mood');
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>(['Arrival', 'Perfect Days']);
  const [movie, setMovie] = useState<RecommendedMovie | null>(null);
  const [seenIds, setSeenIds] = useState<number[]>([]);
  const [seenTitles, setSeenTitles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [taste, setTaste] = useState<TasteEntry[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem(TASTE_STORAGE_KEY) || '[]') as TasteEntry[]; } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem(TASTE_STORAGE_KEY, JSON.stringify(taste));
  }, [taste]);

  const currentTaste = useMemo(() => taste.find((entry) => entry.id === movie?.id), [movie?.id, taste]);

  async function recommend(next = false, tasteOverride?: TasteEntry[]) {
    const rememberedTaste = tasteOverride ?? taste;
    const addedFavorite = mode === 'favorites' ? query.trim() : '';
    const requestFavorites = addedFavorite && !favorites.includes(addedFavorite) ? [...favorites, addedFavorite] : favorites;
    const lovedTitles = rememberedTaste.filter((entry) => entry.status === 'loved').map((entry) => entry.title);
    const tasteFavorites = Array.from(new Set([...requestFavorites, ...lovedTitles]));
    const rememberedIds = rememberedTaste.map((entry) => entry.id);
    const rememberedTitles = rememberedTaste.map((entry) => entry.title);
    if (addedFavorite && !favorites.includes(addedFavorite)) { setFavorites(requestFavorites); setQuery(''); }
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          query: mode === 'favorites' ? '' : query,
          favorites: tasteFavorites,
          excludeIds: Array.from(new Set([...rememberedIds, ...(next ? seenIds : [])])),
          excludedTitles: Array.from(new Set([...rememberedTitles, ...(next ? seenTitles : [])])),
        }),
      });
      const data = await response.json() as RecommendedMovie & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not load the movie.');
      setMovie(data);
      setSeenIds((ids) => next ? [...ids, data.id] : [data.id]);
      setSeenTitles((titles) => next ? [...titles, data.title] : [data.title]);
      setLoading(false);
      window.setTimeout(() => document.getElementById('recommendation')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
    } catch (caught) {
      setMovie(null);
      setError(caught instanceof Error ? caught.message : 'Could not load the movie.');
      setLoading(false);
    }
  }

  function rememberMovie(status: TasteStatus) {
    if (!movie) return;
    const updatedTaste = [...taste.filter((entry) => entry.id !== movie.id), { id: movie.id, title: movie.title, status, updatedAt: Date.now() }];
    setTaste(updatedTaste);
    if (status !== 'loved') void recommend(true, updatedTaste);
  }

  return <main>
    <header className="site-header"><a className="brand" href="#top" aria-label="DreamFrame home"><img className="brand-logo" src="./dreamframe-logo-white.svg" alt="" /><span>DreamFrame</span></a><span className="tagline">Every feeling has a film.</span></header>
    <section className="hero" id="top">
      <p className="eyebrow"><span /> One film. Chosen for you.</p>
      <h1>What do you feel<br />like <em>watching?</em></h1>
      <p className="intro">Describe a feeling, a story, or a movie you loved. We’ll find the one film worth your evening.</p>
      <form className="search-card" onSubmit={(event) => { event.preventDefault(); recommend(false); }}>
        <div className="tabs" role="tablist" aria-label="Recommendation type">
          {(['mood', 'similar', 'favorites'] as Mode[]).map((item) => <button key={item} type="button" role="tab" aria-selected={mode === item} className={mode === item ? 'active' : ''} onClick={() => { setMode(item); setQuery(''); }}>{item === 'mood' ? 'How I feel' : item === 'similar' ? 'Similar to' : 'My favorites'}</button>)}
        </div>
        <label className="sr-only" htmlFor="movie-prompt">{mode === 'mood' ? 'Describe how you want to feel' : 'Enter a movie title'}</label>
        {mode === 'favorites' && favorites.length > 0 && <div className="chips" aria-label="Favorite movies">{favorites.map((item) => <button type="button" key={item} onClick={() => setFavorites(favorites.filter((x) => x !== item))}>{item} <span aria-label={`Remove ${item}`}>×</span></button>)}</div>}
        <div className="input-row">
          {mode === 'mood' ? <textarea id="movie-prompt" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={prompts[mode]} rows={2} /> : <input id="movie-prompt" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={prompts[mode]} />}
          <button className="recommend-button" type="submit" disabled={loading || (mode !== 'favorites' && !query.trim())}>{loading ? 'Finding your film…' : 'Find my film'} <span aria-hidden="true">→</span></button>
        </div><p className="hint">Be as specific—or as vague—as you like.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </section>
    {movie && <section className="result-wrap" id="recommendation" aria-live="polite">
      <div className="result-label"><span>Tonight’s film</span><i /></div>
      <article className="film-card">
        {movie.posterUrl ? <img className="poster poster-image" src={movie.posterUrl} alt={`${movie.title} movie poster`} /> : <div className="poster" role="img" aria-label={`Poster unavailable for ${movie.title}`}><span className="poster-title"><b>{movie.title}</b></span><span className="poster-credit">Poster unavailable</span></div>}
        <div className="film-copy">
          <div className="film-heading"><div><p className="meta">{movie.year} <span>•</span> {movie.runtime}</p><h2>{movie.title}</h2></div><div className="genres">{movie.genres.map((genre) => <span key={genre}>{genre}</span>)}</div></div>
          <p className="overview">{movie.overview}</p>
          <p className="movie-source">Movie data and artwork provided by <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">TMDB</a>.</p>
          <div className="why"><p className="section-label">Why this matches</p><p>{movie.why}</p></div>
          <div className="tag-columns"><div><p className="section-label">Themes</p><div className="soft-tags">{movie.themes.map((tag) => <span key={tag}>{tag}</span>)}</div></div><div><p className="section-label">You’ll probably leave feeling</p><div className="feeling-list">{movie.feelings.map((tag) => <span key={tag}>✦ {tag}</span>)}</div></div></div>
          <div className="taste-actions" aria-label="Remember this recommendation">
            <p className="section-label">Help DreamFrame remember your taste</p>
            <div className="taste-buttons">
              <button type="button" className={currentTaste?.status === 'loved' ? 'selected' : ''} onClick={() => rememberMovie('loved')}>♡ Love this</button>
              <button type="button" onClick={() => rememberMovie('not-for-me')}>Not for me</button>
              <button type="button" onClick={() => rememberMovie('seen')}>Already seen</button>
            </div>
            <small>{currentTaste?.status === 'loved' ? 'Saved. DreamFrame will use this as a taste signal.' : 'Remembered only in this browser.'}</small>
          </div>
          <div className="actions"><button type="button" className="primary-action" onClick={() => recommend(true)}>Try another <span>→</span></button></div>
        </div>
      </article>
    </section>}
    <footer id="about"><span>DreamFrame</span><p>A calmer way to choose what to watch.</p><p>Made for the feeling after the credits.</p></footer>
  </main>;
}
