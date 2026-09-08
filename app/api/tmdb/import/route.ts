import { NextRequest, NextResponse } from 'next/server';

const TMDB_API = 'https://api.themoviedb.org/3';
const POSTER_BASE = 'https://image.tmdb.org/t/p/w342';
const MAX_BATCH_SIZE = 25;

type ImportFilm = { title?: string; year?: string };
type SearchResult = {
  id: number;
  title: string;
  original_title?: string;
  release_date?: string;
  poster_path?: string | null;
  popularity?: number;
};

function normalize(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function matchFilm(film: Required<ImportFilm>, apiKey: string) {
  try {
    const url = new URL(`${TMDB_API}/search/movie`);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('query', film.title);
    url.searchParams.set('include_adult', 'false');
    url.searchParams.set('language', 'en-US');
    if (/^\d{4}$/.test(film.year)) url.searchParams.set('year', film.year);

    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5_000) });
    if (!response.ok) return null;
    const data = await response.json() as { results: SearchResult[] };
    const wanted = normalize(film.title);
    const candidates = data.results.filter((result) => (
      normalize(result.title) === wanted || normalize(result.original_title ?? '') === wanted
    ));
    const match = candidates.find((result) => result.release_date?.startsWith(film.year))
      ?? candidates.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))[0]
      ?? null;
    if (!match) return null;

    return {
      id: match.id,
      title: match.title,
      year: match.release_date?.slice(0, 4) || film.year || '—',
      posterUrl: match.poster_path ? `${POSTER_BASE}${match.poster_path}` : null,
      importedTitle: film.title,
    };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'TMDB is not configured.' }, { status: 500 });

  try {
    const body = await request.json() as { films?: ImportFilm[] };
    const films = (body.films ?? [])
      .map((film) => ({ title: film.title?.trim() ?? '', year: film.year?.trim() ?? '' }))
      .filter((film) => film.title && film.title.length <= 150)
      .slice(0, MAX_BATCH_SIZE);
    if (films.length === 0) return NextResponse.json({ error: 'No films were supplied.' }, { status: 400 });

    const matches = await Promise.all(films.map((film) => matchFilm(film, apiKey)));
    return NextResponse.json({ matches: matches.filter(Boolean) });
  } catch (error) {
    console.error('TMDB import matching failed', error);
    return NextResponse.json({ error: 'We couldn’t match this part of the import. Please try again.' }, { status: 502 });
  }
}
