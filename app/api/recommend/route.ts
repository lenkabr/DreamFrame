import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API = 'https://api.openai.com/v1/responses';
const TMDB_API = 'https://api.themoviedb.org/3';
const POSTER_BASE = 'https://image.tmdb.org/t/p/w780';

type RequestBody = {
  mode?: 'mood' | 'similar' | 'favorites';
  query?: string;
  favorites?: string[];
  excludeIds?: number[];
  excludedTitles?: string[];
  sourceTitle?: string;
  candidateTitles?: string[];
};

type Intent = {
  title: string;
  mood: string;
  desiredFeelings: string[];
  genres: number[];
  themes: string[];
  tone: string;
  intensity: 'low' | 'medium' | 'high';
  why: string;
};

type TmdbMovie = {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  release_date?: string;
  vote_average?: number;
};

type MovieDetails = TmdbMovie & {
  runtime: number | null;
  genres: Array<{ id: number; name: string }>;
  vote_average: number;
};

const intentSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    mood: { type: 'string' },
    desiredFeelings: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3 },
    genres: { type: 'array', items: { type: 'integer' }, minItems: 1, maxItems: 4 },
    themes: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3 },
    tone: { type: 'string' },
    intensity: { type: 'string', enum: ['low', 'medium', 'high'] },
    why: { type: 'string' },
  },
  required: ['title', 'mood', 'desiredFeelings', 'genres', 'themes', 'tone', 'intensity', 'why'],
};

const GENRES = 'Action 28, Adventure 12, Animation 16, Comedy 35, Crime 80, Documentary 99, Drama 18, Family 10751, Fantasy 14, History 36, Horror 27, Music 10402, Mystery 9648, Romance 10749, Science Fiction 878, Thriller 53, War 10752, Western 37';
const MINIMUM_RATING = 5;
const BAD_MOVIE_REQUEST = /\b(so[ -]?bad[ -]?it['’]?s[ -]?good|deliberately bad|terrible movie|awful movie|worst movie|trash(?:y)? movie|laugh(?:ing)? at (?:how )?bad)\b/i;

function permitsLowRating(query: string) {
  return BAD_MOVIE_REQUEST.test(query);
}

async function analyzeIntent(apiKey: string, body: RequestBody): Promise<Intent> {
  const response = await fetch(OPENAI_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-5-mini',
      store: false,
      reasoning: { effort: 'minimal' },
      max_output_tokens: 700,
      instructions: `You are DreamFrame's film curator. Interpret the emotional intent and recommend exactly one real, released feature film. Never recommend the source film, a favorite, or an excluded title. Favorites are taste references only. When a verified candidate list is supplied for Similar mode, choose only from that list and return its title exactly.

First identify the user's core positive request—the experience the film must deliver, such as exciting, funny, romantic, strange, comforting, tense, beautiful, or intellectually engaging. This is a required quality, not a preference. Then identify every negative instruction. A valid recommendation must satisfy both sides at the same time. Never obey restrictions by choosing a merely safe film that loses the requested energy, genre, or emotional experience. For example, “exciting but not violent or scary” still requires genuine excitement; look to investigation, competition, adventure, survival against nature, heists, discovery, or problem-solving rather than defaulting to a gentle family film.

Treat every negative instruction as a hard constraint: if the user says not violent, frightening, cruel, graphic, bleak, sad, depressing, stressful, or similar, reject films meaningfully associated with that quality instead of merely preferring an alternative. Before answering, silently check the selected film against the core positive request and every restriction; reject it if either side fails. The user's current request is primary, and favorite films are only a secondary style signal. For gentle or low-intensity requests, avoid stressful, bleak, violent, or emotionally punishing films unless explicitly requested. Return the exact commonly used English title, a concise explanation in warm everyday language, emotional preferences, and 1-4 TMDB genre IDs. Avoid academic, therapeutic, or overly polished wording. Valid genres: ${GENRES}.`,
      input: `Mode: ${body.mode ?? 'mood'}\nRequest: ${body.query?.trim() || '(none)'}\nVerified source film: ${body.sourceTitle || '(none)'}\nVerified candidate titles: ${(body.candidateTitles ?? []).join(' | ') || '(none)'}\nFavorite films (taste references only; never recommend these): ${(body.favorites ?? []).join(', ') || '(none)'}\nOther excluded titles: ${(body.excludedTitles ?? []).join(', ') || '(none)'}`,
      text: { format: { type: 'json_schema', name: 'film_intent', strict: true, schema: intentSchema } },
    }),
  });

  if (!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
  const data = await response.json() as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  const text = data.output?.flatMap((item) => item.content ?? []).find((item) => item.type === 'output_text')?.text;
  if (!text) throw new Error('OpenAI returned no analysis.');
  return JSON.parse(text) as Intent;
}

async function tmdbJson<T>(url: URL): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`TMDB request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export async function POST(request: NextRequest) {
  const openAiKey = process.env.OPENAI_API_KEY;
  const tmdbKey = process.env.TMDB_API_KEY;
  if (!openAiKey || !tmdbKey) return NextResponse.json({ error: 'The recommendation engine is not configured.' }, { status: 500 });

  try {
    const body = await request.json() as RequestBody;
    const query = body.query?.trim() ?? '';
    const favorites = (body.favorites ?? []).filter(Boolean).slice(0, 8);
    const allowLowRating = permitsLowRating(query);
    if (!query && favorites.length === 0) return NextResponse.json({ error: 'Tell us how you feel or add a film you love.' }, { status: 400 });

    let sourceTitle = '';
    let candidateTitles: string[] = [];
    if (body.mode === 'similar') {
      const sourceSearchUrl = new URL(`${TMDB_API}/search/movie`);
      sourceSearchUrl.searchParams.set('api_key', tmdbKey);
      sourceSearchUrl.searchParams.set('query', query);
      sourceSearchUrl.searchParams.set('include_adult', 'false');
      sourceSearchUrl.searchParams.set('language', 'en-US');
      const sourceSearch = await tmdbJson<{ results: TmdbMovie[] }>(sourceSearchUrl);
      const source = sourceSearch.results[0];
      if (!source) return NextResponse.json({ error: 'We could not find that film. Check the title and try again.' }, { status: 404 });
      sourceTitle = source.title;

      const relatedUrl = new URL(`${TMDB_API}/movie/${source.id}/recommendations`);
      relatedUrl.searchParams.set('api_key', tmdbKey);
      relatedUrl.searchParams.set('language', 'en-US');
      const related = await tmdbJson<{ results: TmdbMovie[] }>(relatedUrl);
      candidateTitles = related.results
        .filter((movie) => movie.title !== source.title && (allowLowRating || (movie.vote_average ?? 0) >= MINIMUM_RATING))
        .slice(0, 18)
        .map((movie) => movie.title);
      if (candidateTitles.length === 0) {
        const similarUrl = new URL(`${TMDB_API}/movie/${source.id}/similar`);
        similarUrl.searchParams.set('api_key', tmdbKey);
        similarUrl.searchParams.set('language', 'en-US');
        const similar = await tmdbJson<{ results: TmdbMovie[] }>(similarUrl);
        candidateTitles = similar.results
          .filter((movie) => movie.title !== source.title && (allowLowRating || (movie.vote_average ?? 0) >= MINIMUM_RATING))
          .slice(0, 18)
          .map((movie) => movie.title);
      }
      if (candidateTitles.length === 0) return NextResponse.json({ error: 'No related films were found for that title yet.' }, { status: 404 });
    }

    const rejectedTitles = [...(body.excludedTitles ?? [])];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const intent = await analyzeIntent(openAiKey, { ...body, query, favorites, sourceTitle, candidateTitles, excludedTitles: rejectedTitles });
      const searchUrl = new URL(`${TMDB_API}/search/movie`);
      searchUrl.searchParams.set('api_key', tmdbKey);
      searchUrl.searchParams.set('query', intent.title);
      searchUrl.searchParams.set('include_adult', 'false');
      searchUrl.searchParams.set('language', 'en-US');
      const search = await tmdbJson<{ results: TmdbMovie[] }>(searchUrl);
      const eligibleResults = search.results.filter((item) => !(body.excludeIds ?? []).includes(item.id));
      const movie = eligibleResults.find((item) => item.title.toLowerCase() === intent.title.toLowerCase()) ?? eligibleResults[0];
      if (!movie) {
        rejectedTitles.push(intent.title);
        continue;
      }

      const detailsUrl = new URL(`${TMDB_API}/movie/${movie.id}`);
      detailsUrl.searchParams.set('api_key', tmdbKey);
      detailsUrl.searchParams.set('language', 'en-US');
      const details = await tmdbJson<MovieDetails>(detailsUrl);
      if (!allowLowRating && details.vote_average < MINIMUM_RATING) {
        rejectedTitles.push(details.title);
        continue;
      }

      const feelings = intent.desiredFeelings.map((item) => item.toLowerCase());
      return NextResponse.json({
        id: details.id,
        title: details.title,
        year: details.release_date?.slice(0, 4) || '—',
        runtime: details.runtime ? `${Math.floor(details.runtime / 60)}h ${details.runtime % 60}m` : 'Runtime unavailable',
        genres: details.genres.map((genre) => genre.name),
        overview: details.overview || 'No synopsis is available yet.',
        posterUrl: details.poster_path ? `${POSTER_BASE}${details.poster_path}` : null,
        rating: details.vote_average,
        why: intent.why,
        themes: intent.themes,
        feelings,
        interpretation: { mood: intent.mood, tone: intent.tone, intensity: intent.intensity },
      });
    }

    return NextResponse.json({ error: 'We could not find a strong enough match. Try describing what you want a little differently.' }, { status: 404 });
  } catch (error) {
    console.error('Recommendation request failed', error);
    return NextResponse.json({ error: 'DreamFrame couldn’t create a recommendation. Please try again.' }, { status: 502 });
  }
}
