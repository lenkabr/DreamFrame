'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createSeenBackup, mergeSeenMovies, readSeenBackup, readSeenMovies, updateSeenMovies, type SeenMovie } from '@/lib/seen-storage';

type SeenEntry = SeenMovie;

type MovieSuggestion = { id: number; title: string; year: string; posterUrl: string | null };
type ImportSource = 'letterboxd' | 'imdb';
type CsvFilm = { title: string; year: string; imdbId?: string };
type ImportMatch = MovieSuggestion & { importedTitle: string };
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

function extractImdbFilms(text: string): CsvFilm[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.trim().toLowerCase().replace(/^\uFEFF/, ''));
  const titleIndex = headers.findIndex((header) => ['title', 'name'].includes(header));
  const yearIndex = headers.indexOf('year');
  const idIndex = headers.findIndex((header) => ['const', 'imdb id', 'imdbid'].includes(header));
  const typeIndex = headers.findIndex((header) => ['title type', 'type'].includes(header));
  if (titleIndex < 0 && idIndex < 0) return [];

  const unique = new Map<string, CsvFilm>();
  rows.slice(1).forEach((row) => {
    const title = titleIndex >= 0 ? row[titleIndex]?.trim() ?? '' : '';
    const year = yearIndex >= 0 ? row[yearIndex]?.trim() ?? '' : '';
    const imdbId = idIndex >= 0 ? row[idIndex]?.trim() ?? '' : '';
    const titleType = typeIndex >= 0 ? row[typeIndex]?.trim().toLowerCase() ?? '' : '';
    const isNotFilm = /series|episode|video game|podcast/.test(titleType);
    if (!isNotFilm && (title || /^tt\d+$/.test(imdbId))) {
      unique.set(imdbId || `${title.toLowerCase()}|${year}`, { title, year, imdbId: imdbId || undefined });
    }
  });
  return [...unique.values()];
}

export default function SeenMoviesClient() {
  const [activeSource, setActiveSource] = useState<ImportSource | null>(null);
  const [movies, setMovies] = useState<SeenEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importMatches, setImportMatches] = useState<ImportMatch[]>([]);
  const [importTotal, setImportTotal] = useState(0);
  const [importError, setImportError] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const [backupMessage, setBackupMessage] = useState('');
  const [backupError, setBackupError] = useState('');

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
      const enriched = updateSeenMovies((current) => current.map((movie) => {
        const match = details.find((detail) => detail?.id === movie.id);
        return match ? { ...movie, year: match.year, posterUrl: match.posterUrl } : movie;
      }));
      setMovies(enriched);
    });
    return () => window.clearTimeout(readyTimer);
  }, []);

  function removeMovie(id: number) {
    const updated = updateSeenMovies((current) => current.filter((movie) => movie.id !== id));
    setMovies(updated);
  }

  async function importFilms(file: File, source: ImportSource) {
    setImportError('');
    setImportMatches([]);
    setImportProgress(0);
    setImportFileName(file.name);
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setImportError(source === 'letterboxd' ? 'Choose watched.csv from your Letterboxd export.' : 'Choose the CSV file exported from your IMDb Ratings.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImportError('That file is too large. Choose the film-history CSV from your export.');
      return;
    }

    const films = source === 'letterboxd' ? extractLetterboxdFilms(await file.text()) : extractImdbFilms(await file.text());
    if (films.length === 0) {
      setImportError(source === 'letterboxd'
        ? 'We couldn’t find any film titles. Make sure you selected watched.csv.'
        : 'We couldn’t find any films. Make sure you selected the CSV exported from Your Ratings or a watched-film list.');
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
    const existingIds = new Set(readSeenMovies().map((movie) => movie.id));
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
    const updated = mergeSeenMovies(added);
    setMovies(updated);
    setImportMatches([]);
    setImportTotal(0);
    setImportFileName('');
  }

  function downloadBackup() {
    setBackupError('');
    const current = readSeenMovies();
    const blob = new Blob([createSeenBackup(current)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dreamframe-watched-films-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setBackupMessage(`Backup downloaded — ${current.length} films saved.`);
  }

  async function restoreBackup(file: File) {
    setBackupMessage('');
    setBackupError('');
    if (!file.name.toLowerCase().endsWith('.json') || file.size > 5 * 1024 * 1024) {
      setBackupError('Choose a DreamFrame watched-films backup file.');
      return;
    }
    try {
      const restored = readSeenBackup(await file.text());
      const before = readSeenMovies().length;
      const updated = mergeSeenMovies(restored);
      setMovies(updated);
      setBackupMessage(`Backup restored — ${updated.length - before} new films added, ${updated.length} saved in total.`);
    } catch (caught) {
      setBackupError(caught instanceof Error ? caught.message : 'The backup could not be restored.');
    }
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
            <button type="button" className={`import-source imdb ${activeSource === 'imdb' ? 'active' : ''}`} aria-expanded={activeSource === 'imdb'} onClick={() => setActiveSource(activeSource === 'imdb' ? null : 'imdb')}>IMDb</button>
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
              if (file) importFilms(file, 'letterboxd');
              event.currentTarget.value = '';
            }} />
            <label htmlFor="letterboxd-file" className={importing ? 'disabled' : ''}>{importing ? 'Matching your films…' : movies.length > 0 ? 'Update watched films list' : 'Choose watched.csv'} <span aria-hidden="true">↑</span></label>
            <p>Your file isn’t saved. Only the matched film list is stored in this browser.</p>
          </div>
        </div>}
        {activeSource === 'imdb' && <div className="import-flow">
          <ol>
            <li><span>01</span><p>On IMDb, open <a href="https://www.imdb.com/list/ratings/" target="_blank" rel="noreferrer">Your Ratings</a> from your profile.</p></li>
            <li><span>02</span><p>Select <strong>Actions</strong>, then <strong>Export</strong>, to download the CSV file.</p></li>
            <li><span>03</span><p>Select that CSV in the upload panel. You can also use an exported IMDb list that contains only films you’ve watched.</p></li>
          </ol>
          <div className="import-action imdb-action">
            <input id="imdb-file" className="sr-only" type="file" accept=".csv,text/csv" disabled={importing} onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) importFilms(file, 'imdb');
              event.currentTarget.value = '';
            }} />
            <label htmlFor="imdb-file" className={importing ? 'disabled' : ''}>{importing ? 'Matching your films…' : movies.length > 0 ? 'Update watched films list' : 'Choose IMDb CSV'} <span aria-hidden="true">↑</span></label>
            <p>Don’t import your Watchlist—it contains films you still plan to see. Your file itself isn’t saved.</p>
          </div>
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

      <section className="library-backup" aria-labelledby="backup-title">
        <div>
          <p className="import-kicker">Keep it safe</p>
          <h2 id="backup-title">Back up your watched films</h2>
          <p>Download a small DreamFrame file now, then restore it here if your browser list is ever cleared.</p>
        </div>
        <div className="backup-actions">
          <button type="button" onClick={downloadBackup} disabled={movies.length === 0}>Download backup <span aria-hidden="true">↓</span></button>
          <input id="dreamframe-backup" className="sr-only" type="file" accept=".json,application/json" onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) restoreBackup(file);
            event.currentTarget.value = '';
          }} />
          <label htmlFor="dreamframe-backup">Restore backup <span aria-hidden="true">↑</span></label>
        </div>
        {(backupMessage || backupError) && <p className={`backup-status ${backupError ? 'error' : ''}`} role={backupError ? 'alert' : 'status'}>{backupError || backupMessage}</p>}
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
