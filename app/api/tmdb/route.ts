import { NextRequest, NextResponse } from 'next/server';

const TMDB_API = 'https://api.themoviedb.org/3';
const POSTER_BASE = 'https://image.tmdb.org/t/p/w780';

type SearchResult = { id: number; title: string; release_date?: string; poster_path?: string | null; popularity?: number };
type MovieDetails = {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  release_date?: string;
  runtime: number | null;
  genres: Array<{ id: number; name: string }>;
};

export async function GET(request: NextRequest) {
  const apiKey = process.env.TMDB_API_KEY;
  const title = request.nextUrl.searchParams.get('title')?.trim();
  const query = request.nextUrl.searchParams.get('query')?.trim();

  if (!apiKey) return NextResponse.json({ error: 'TMDB is not configured.' }, { status: 500 });
  if (!title && !query) return NextResponse.json({ error: 'A movie title is required.' }, { status: 400 });
  if ((query || title || '').length > 100) return NextResponse.json({ error: 'Please keep movie titles under 100 characters.' }, { status: 400 });

  try {
    const searchUrl = new URL(`${TMDB_API}/search/movie`);
    searchUrl.searchParams.set('api_key', apiKey);
    searchUrl.searchParams.set('query', query || title || '');
    searchUrl.searchParams.set('include_adult', 'false');
    searchUrl.searchParams.set('language', 'en-US');
    const searchResponse = await fetch(searchUrl, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!searchResponse.ok) throw new Error(`TMDB search failed: ${searchResponse.status}`);

    const searchData = await searchResponse.json() as { results: SearchResult[] };
    if (query) {
      return NextResponse.json({
        results: searchData.results.slice(0, 7).map((movie) => ({
          id: movie.id,
          title: movie.title,
          year: movie.release_date?.slice(0, 4) || '—',
          posterUrl: movie.poster_path ? `${POSTER_BASE}${movie.poster_path}` : null,
        })),
      });
    }
    const result = searchData.results.find((movie) => movie.title.toLowerCase() === (title || '').toLowerCase()) ?? searchData.results[0];
    if (!result) return NextResponse.json({ error: 'Movie not found.' }, { status: 404 });

    const detailsUrl = new URL(`${TMDB_API}/movie/${result.id}`);
    detailsUrl.searchParams.set('api_key', apiKey);
    const detailsResponse = await fetch(detailsUrl, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!detailsResponse.ok) throw new Error(`TMDB details failed: ${detailsResponse.status}`);
    const movie = await detailsResponse.json() as MovieDetails;

    return NextResponse.json({
      id: movie.id,
      title: movie.title,
      year: movie.release_date?.slice(0, 4) || result.release_date?.slice(0, 4) || '—',
      runtime: movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : 'Runtime unavailable',
      genres: movie.genres.map((genre) => genre.name),
      overview: movie.overview || 'No synopsis is available yet.',
      posterUrl: movie.poster_path ? `${POSTER_BASE}${movie.poster_path}` : null,
    });
  } catch (error) {
    console.error('TMDB request failed', error);
    return NextResponse.json({ error: 'We couldn’t reach TMDB. Please try again.' }, { status: 502 });
  }
}
