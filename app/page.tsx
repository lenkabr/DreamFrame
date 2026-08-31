'use client';

import { useMemo, useState } from 'react';

type Mode = 'mood' | 'similar' | 'favorites';
type TmdbMovie = { id: number; title: string; year: string; runtime: string; genres: string[]; overview: string; posterUrl: string | null };
const films = [
  { title: 'Perfect Days', year: '2023', runtime: '2h 4m', genres: ['Drama'], overview: 'A cleaner in Tokyo finds quiet meaning in the rhythms of work, music, books, and the trees above him.', why: 'You’re looking for something hopeful without forced optimism. This is a gentle reminder that a meaningful life can be made from attention, ritual, and very small joys.', themes: ['presence', 'solitude', 'everyday beauty'], feeling: ['calm', 'restored', 'quietly hopeful'], palette: 'poster-perfect', mark: '木漏れ日' },
  { title: 'After Yang', year: '2021', runtime: '1h 36m', genres: ['Drama', 'Sci-fi'], overview: 'When a family’s android companion breaks down, a father discovers a hidden inner life in the memories he left behind.', why: 'This carries the tender futurism and emotional restraint you’re drawn to, while turning grief into a lucid appreciation of the moments we almost miss.', themes: ['memory', 'family', 'what makes us human'], feeling: ['tender', 'reflective', 'more awake'], palette: 'poster-yang', mark: 'AFTER\nYANG' },
  { title: 'Columbus', year: '2017', runtime: '1h 44m', genres: ['Drama', 'Romance'], overview: 'Two people at crossroads form an unlikely bond among the modernist buildings of a quiet Indiana town.', why: 'You asked for people finding their place. This is patient, visually precise, and emotionally generous about the lives we postpone—and the courage it takes to begin them.', themes: ['belonging', 'architecture', 'new beginnings'], feeling: ['understood', 'peaceful', 'gently moved'], palette: 'poster-columbus', mark: 'COLUMBUS' },
  { title: 'Petite Maman', year: '2021', runtime: '1h 12m', genres: ['Drama', 'Fantasy'], overview: 'While clearing out her grandmother’s home, an eight-year-old meets a girl in the woods who feels strangely familiar.', why: 'You want to cry and still leave with light in you. This tiny, magical film holds grief with extraordinary gentleness and lets love travel where explanations cannot.', themes: ['grief', 'motherhood', 'childhood'], feeling: ['comforted', 'wistful', 'held'], palette: 'poster-petite', mark: 'PETITE\nMAMAN' },
];
const prompts: Record<Mode, string> = { mood: 'I want something that makes me appreciate life...', similar: 'Lost in Translation', favorites: 'Add a film you love' };

export default function Home() {
  const [mode, setMode] = useState<Mode>('mood');
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>(['Arrival', 'Perfect Days']);
  const [index, setIndex] = useState<number | null>(null);
  const [tmdbMovie, setTmdbMovie] = useState<TmdbMovie | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const film = useMemo(() => index === null ? null : films[index % films.length], [index]);

  async function recommend(next = false) {
    if (mode === 'favorites' && query.trim() && !favorites.includes(query.trim())) { setFavorites((items) => [...items, query.trim()]); setQuery(''); }
    setLoading(true);
    setError('');
    try {
      const text = `${query} ${favorites.join(' ')}`.toLowerCase();
      let pick = next && index !== null ? (index + 1) % films.length : 0;
      if (!next) { if (/her|arrival|future|sci|memory/.test(text)) pick = 1; else if (/place|belong|lost in translation|quiet/.test(text)) pick = 2; else if (/cry|grief|mother|sad/.test(text)) pick = 3; }
      const response = await fetch(`/api/tmdb?title=${encodeURIComponent(films[pick].title)}`);
      const data = await response.json() as TmdbMovie & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not load the movie.');
      setTmdbMovie(data);
      setIndex(pick); setLoading(false);
      window.setTimeout(() => document.getElementById('recommendation')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
    } catch (caught) {
      setTmdbMovie(null);
      setError(caught instanceof Error ? caught.message : 'Could not load the movie.');
      setLoading(false);
    }
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
    {film && tmdbMovie && <section className="result-wrap" id="recommendation" aria-live="polite">
      <div className="result-label"><span>Tonight’s film</span><i /></div>
      <article className="film-card">
        {tmdbMovie.posterUrl ? <img className="poster poster-image" src={tmdbMovie.posterUrl} alt={`${tmdbMovie.title} movie poster`} /> : <div className={`poster ${film.palette}`} role="img" aria-label={`Poster unavailable for ${tmdbMovie.title}`}><span className="poster-title">{film.mark.split('\n').map((line) => <b key={line}>{line}</b>)}</span><span className="poster-credit">Poster unavailable</span></div>}
        <div className="film-copy">
          <div className="film-heading"><div><p className="meta">{tmdbMovie.year} <span>•</span> {tmdbMovie.runtime}</p><h2>{tmdbMovie.title}</h2></div><div className="genres">{tmdbMovie.genres.map((genre) => <span key={genre}>{genre}</span>)}</div></div>
          <p className="overview">{tmdbMovie.overview}</p>
          <p className="movie-source">Movie data and artwork provided by <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">TMDB</a>.</p>
          <div className="why"><p className="section-label">Why this matches</p><p>{film.why}</p></div>
          <div className="tag-columns"><div><p className="section-label">Themes</p><div className="soft-tags">{film.themes.map((tag) => <span key={tag}>{tag}</span>)}</div></div><div><p className="section-label">You’ll probably leave feeling</p><div className="feeling-list">{film.feeling.map((tag) => <span key={tag}>✦ {tag}</span>)}</div></div></div>
          <div className="actions"><button type="button" className="primary-action" onClick={() => recommend(true)}>Try another <span>→</span></button><button type="button" className="secondary-action" onClick={() => recommend(true)}>I’ve seen it</button></div>
        </div>
      </article>
    </section>}
    <footer id="about"><span>DreamFrame</span><p>A calmer way to choose what to watch.</p><p>Made for the feeling after the credits.</p></footer>
  </main>;
}
