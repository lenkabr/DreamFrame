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
type CsvFilm = { title: string; year: string };
type ImportMatch = MovieSuggestion & { importedTitle: string };
const STORAGE_KEY = 'dreamframe-taste-v1';
const IMPORT_BATCH_SIZE = 25;

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  row.push(field);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function extractLetterboxdFilms(text: string): CsvFilm[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.trim().toLowerCase().replace(/^\uFEFF/, ''));
  const titleIndex = headers.findIndex((header) => ['name', 'title'].includes(header));
  const yearIndex = headers.indexOf('year');
  if (titleIndex < 0) return [];
  const unique = new Map<string, CsvFilm>();
  rows.slice(1).forEach((row) => {
    const title = row[titleIndex]?.trim();
    const year = yearIndex >= 0 ? row[yearIndex]?.trim() ?? '' : '';
    if (title) unique.set(`${title.toLowerCase()}|${year}`, { title, year });
  });
  return [...unique.values()];
}

function readSeenMovies(): SeenEntry[] {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as Array<SeenEntry & { status?: string }>;
    return stored.filter((entry): entry is SeenEntry => entry.status === 'seen' && Number.isFinite(entry.id) && Boolean(entry.title));
  } catch {
    return [];
  }
}

export default function SeenMoviesClient() {
  const [activeSource, setActiveSource] = useState<'letterboxd' | 'imdb' | null>(null);
  const [movies, setMovies] = useState<SeenEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importMatches, setImportMatches] = useState<ImportMatch[]>([]);
  const [importTotal, setImportTotal] = useState(0);
  const [importError, setImportError] = useState('');
  const [importFileName, setImportFileName] = useState('');

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

  async function importLetterboxd(file: File) {
    setImportError('');
    setImportMatches([]);
    setImportProgress(0);
    setImportFileName(file.name);
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setImportError('Choose the watched.csv file from your Letterboxd export.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImportError('That file is too large. Choose watched.csv from the export folder.');
      return;
    }

    const films = extractLetterboxdFilms(await file.text());
    if (films.length === 0) {
      setImportError('We couldn’t find any film titles. Make sure you selected watched.csv.');
      return;
    }

    setImporting(true);
    setImportTotal(films.length);
    const matched = new Map<number, ImportMatch>();
    try {
      for (let start = 0; start < films.length; start += IMPORT_BATCH_SIZE) {
        const batch = films.slice(start, start + IMPORT_BATCH_SIZE);
        const response = await fetch('/api/tmdb/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ films: batch }),
        });
        const data = await response.json() as { matches?: ImportMatch[]; error?: string };
        if (!response.ok) throw new Error(data.error || 'The import could not be completed.');
        (data.matches ?? []).forEach((match) => matched.set(match.id, match));
        setImportProgress(Math.min(start + batch.length, films.length));
      }
      setImportMatches([...matched.values()]);
    } catch (caught) {
      setImportError(caught instanceof Error ? caught.message : 'The import could not be completed.');
    } finally {
      setImporting(false);
    }
  }

  function confirmImport() {
    const existingIds = new Set(movies.map((movie) => movie.id));
    const added = importMatches
      .filter((match) => !existingIds.has(match.id))
      .map<SeenEntry>((match) => ({
        id: match.id,
        title: match.title,
        year: match.year,
        posterUrl: match.posterUrl,
        status: 'seen',
        updatedAt: Date.now(),
      }));
    const updated = [...movies, ...added];
    setMovies(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setImportMatches([]);
    setImportTotal(0);
    setImportFileName('');
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

      <section className="import-panel" aria-labelledby="import-title">
        <div className="import-intro">
          <div>
            <p className="import-kicker">Bring your history</p>
            <h2 id="import-title">{movies.length > 0 ? 'Update your watched films list' : 'Import films you’ve already seen'}</h2>
            <p>Use your existing film history so DreamFrame can avoid recommending movies you already know.</p>
          </div>
          <div className="import-sources" aria-label="Import source">
            <button type="button" className={`import-source letterboxd ${activeSource === 'letterboxd' ? 'active' : ''}`} aria-expanded={activeSource === 'letterboxd'} onClick={() => setActiveSource(activeSource === 'letterboxd' ? null : 'letterboxd')}>Letterboxd</button>
            <button type="button" className={`import-source imdb ${activeSource === 'imdb' ? 'active' : ''}`} aria-expanded={activeSource === 'imdb'} onClick={() => setActiveSource(activeSource === 'imdb' ? null : 'imdb')}>IMDb <small>Coming next</small></button>
          </div>
        </div>

        {activeSource === 'letterboxd' && <div className="import-flow">
          <ol>
            <li><span>01</span><p>Open <a href="https://letterboxd.com/user/exportdata/" target="_blank" rel="noreferrer">Letterboxd’s export page</a> and download your data.</p></li>
            <li><span>02</span><p>Unzip the downloaded folder and find <strong>watched.csv</strong>.</p></li>
            <li><span>03</span><p>Select <strong>watched.csv</strong> in the upload panel. DreamFrame will match the films with TMDB.</p></li>
          </ol>
          <div className="import-action">
            <input id="letterboxd-file" className="sr-only" type="file" accept=".csv,text/csv" disabled={importing} onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) importLetterboxd(file);
              event.currentTarget.value = '';
            }} />
            <label htmlFor="letterboxd-file" className={importing ? 'disabled' : ''}>{importing ? 'Matching your films…' : movies.length > 0 ? 'Update watched films list' : 'Choose watched.csv'} <span aria-hidden="true">↑</span></label>
            <p>Your file isn’t saved. Only the matched film list is stored in this browser.</p>
          </div>
        </div>}
        {activeSource === 'imdb' && <div className="import-coming-soon">
          <p>IMDb import is coming next.</p>
          <span>We’re building it on the same private, browser-only system as Letterboxd.</span>
        </div>}

        {importing && <div className="import-progress" role="status">
          <div><i style={{ width: `${importTotal ? (importProgress / importTotal) * 100 : 2}%` }} /></div>
          <p>Matching {importProgress} of {importTotal} films…</p>
        </div>}
        {importError && <p className="import-error" role="alert">{importError}</p>}
        {!importing && importMatches.length > 0 && <div className="import-review" role="status">
          <div>
            <p>Ready to import</p>
            <strong>{importMatches.length}<span> of {importTotal} films matched</span></strong>
            <small>{Math.max(0, importTotal - importMatches.length)} unmatched titles will be skipped. Existing films won’t be duplicated.</small>
          </div>
          <div>
            <button type="button" className="import-confirm" onClick={confirmImport}>Add to Already seen <span aria-hidden="true">→</span></button>
            <button type="button" className="import-cancel" onClick={() => { setImportMatches([]); setImportTotal(0); setImportFileName(''); }}>Cancel</button>
          </div>
          <p className="import-file">{importFileName}</p>
        </div>}
      </section>

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
