export type SeenMovie = {
  id: number;
  title: string;
  year?: string;
  posterUrl?: string | null;
  status: 'seen';
  updatedAt: number;
};

type StoredLibrary = {
  version: 2;
  updatedAt: number;
  movies: SeenMovie[];
};

type BackupFile = {
  app: 'DreamFrame';
  type: 'watched-films-backup';
  version: 2;
  exportedAt: string;
  movies: SeenMovie[];
};

const STORAGE_KEY = 'dreamframe-taste-v1';
const RECOVERY_KEY = 'dreamframe-taste-recovery-v1';
const MAX_LIBRARY_SIZE = 10_000;

function normaliseMovies(value: unknown): SeenMovie[] {
  if (!Array.isArray(value)) return [];

  const unique = new Map<number, SeenMovie>();
  value.slice(0, MAX_LIBRARY_SIZE).forEach((candidate) => {
    if (!candidate || typeof candidate !== 'object') return;
    const entry = candidate as Partial<SeenMovie>;
    if (!Number.isFinite(entry.id) || typeof entry.title !== 'string' || !entry.title.trim()) return;

    const movie: SeenMovie = {
      id: Number(entry.id),
      title: entry.title.trim().slice(0, 300),
      status: 'seen',
      updatedAt: Number.isFinite(entry.updatedAt) ? Number(entry.updatedAt) : Date.now(),
    };
    if (typeof entry.year === 'string' && entry.year.trim()) movie.year = entry.year.trim().slice(0, 12);
    if (typeof entry.posterUrl === 'string') movie.posterUrl = entry.posterUrl.slice(0, 1_000);
    else if (entry.posterUrl === null) movie.posterUrl = null;

    const existing = unique.get(movie.id);
    if (!existing || movie.updatedAt >= existing.updatedAt) unique.set(movie.id, movie);
  });

  return [...unique.values()];
}

function moviesFromStoredValue(value: unknown): SeenMovie[] | null {
  // Version 1 stored a plain array. Keep accepting it so existing libraries survive.
  if (Array.isArray(value)) return normaliseMovies(value);
  if (!value || typeof value !== 'object') return null;
  const stored = value as Partial<StoredLibrary>;
  return Array.isArray(stored.movies) ? normaliseMovies(stored.movies) : null;
}

function parseStored(raw: string | null): SeenMovie[] | null {
  if (raw === null) return [];
  try {
    return moviesFromStoredValue(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function readSeenMovies(): SeenMovie[] {
  const primary = parseStored(localStorage.getItem(STORAGE_KEY));
  if (primary !== null) return primary;

  // If the current value ever becomes unreadable, retain the last valid saved version.
  return parseStored(localStorage.getItem(RECOVERY_KEY)) ?? [];
}

export function replaceSeenMovies(movies: SeenMovie[]): SeenMovie[] {
  const normalised = normaliseMovies(movies);
  const current = localStorage.getItem(STORAGE_KEY);
  if (current !== null && parseStored(current) !== null) localStorage.setItem(RECOVERY_KEY, current);

  const payload: StoredLibrary = { version: 2, updatedAt: Date.now(), movies: normalised };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  window.dispatchEvent(new Event('dreamframe-seen-change'));
  return normalised;
}

export function updateSeenMovies(change: (current: SeenMovie[]) => SeenMovie[]): SeenMovie[] {
  return replaceSeenMovies(change(readSeenMovies()));
}

export function mergeSeenMovies(incoming: SeenMovie[]): SeenMovie[] {
  return updateSeenMovies((current) => {
    const merged = new Map(current.map((movie) => [movie.id, movie]));
    normaliseMovies(incoming).forEach((movie) => {
      const existing = merged.get(movie.id);
      merged.set(movie.id, existing ? { ...movie, ...existing } : movie);
    });
    return [...merged.values()];
  });
}

export function createSeenBackup(movies: SeenMovie[]): string {
  const backup: BackupFile = {
    app: 'DreamFrame',
    type: 'watched-films-backup',
    version: 2,
    exportedAt: new Date().toISOString(),
    movies: normaliseMovies(movies),
  };
  return JSON.stringify(backup, null, 2);
}

export function readSeenBackup(text: string): SeenMovie[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('This doesn’t look like a DreamFrame backup file.');
  }

  const movies = moviesFromStoredValue(parsed);
  if (!parsed || typeof parsed !== 'object' || (parsed as Partial<BackupFile>).app !== 'DreamFrame' || movies === null) {
    throw new Error('Choose a watched-films backup downloaded from DreamFrame.');
  }
  if (movies.length === 0) throw new Error('This backup doesn’t contain any watched films.');
  return movies;
}
