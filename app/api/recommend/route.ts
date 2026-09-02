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
  sourceId?: number;
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

type TmdbPoster = {
  file_path: string;
  width: number;
  height: number;
  aspect_ratio: number;
  vote_average: number;
  vote_count: number;
  iso_639_1: string | null;
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
const SERVER_REQUEST_LIMIT = 5;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
type RateEntry = { count: number; resetAt: number };
const rateLimitStore = new Map<string, RateEntry>();

function clientAddress(request: NextRequest) {
  return request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

function consumeRequestAllowance(request: NextRequest) {
  if (process.env.NODE_ENV !== 'production') return { allowed: true, retryAfter: 0 };
  const now = Date.now();
  const key = clientAddress(request);
  const current = rateLimitStore.get(key);
  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  if (current.count >= SERVER_REQUEST_LIMIT) return { allowed: false, retryAfter: Math.ceil((current.resetAt - now) / 1000) };
  current.count += 1;
  return { allowed: true, retryAfter: 0 };
}

function permitsLowRating(query: string) {
  return BAD_MOVIE_REQUEST.test(query);
}

function normalizeMovieTitle(title: string) {
  return title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function analyzeIntent(apiKey: string, body: RequestBody): Promise<Intent> {
  const response = await fetch(OPENAI_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(25_000),
    body: JSON.stringify({
      model: 'gpt-5-mini',
      store: false,
      reasoning: { effort: 'minimal' },
      max_output_tokens: 700,
      instructions: `You are DreamFrame's film curator. Interpret the emotional intent and recommend exactly one real, released feature film. Never recommend the source film, a favorite, or an excluded title. Favorites are taste references only. When a verified candidate list is supplied for Similar mode, choose only from that list and return its title exactly.

First identify the user's core positive request—the experience the film must deliver, such as exciting, funny, romantic, strange, comforting, tense, beautiful, or intellectually engaging. This is a required quality, not a preference. Then identify every negative instruction. A valid recommendation must satisfy both sides at the same time. Never obey restrictions by choosing a merely safe film that loses the requested energy, genre, or emotional experience. For example, “exciting but not violent or scary” still requires genuine excitement; look to investigation, competition, adventure, survival against nature, heists, discovery, or problem-solving rather than defaulting to a gentle family film.

For Similar mode, “similar” primarily means emotionally similar: how the film feels while watching it, its emotional focus, central themes, atmosphere, tone, intensity, and the feeling it leaves afterward. Treat the verified TMDB titles only as a candidate pool, then choose the candidate with the strongest emotional and thematic connection to the source. Plot resemblance or a shared genre is not enough by itself.

For Favorites mode, infer the emotional fingerprint shared across the favorite films: recurring themes, emotional tensions, atmosphere, visual or narrative sensibility, intensity, and the kind of after-feeling they create. Recommend a film that fits that combined emotional fingerprint. Do not simply copy one favorite's genre or choose a broadly popular title.

In Similar and Favorites modes, never optimize primarily for popularity, box-office success, franchise connections, shared cast or crew, keywords, or surface-level plot similarity. These may support a choice, but emotional experience and themes must be the decisive reasons.

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
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`TMDB request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

function posterConfidence(poster: TmdbPoster) {
  return poster.vote_average + Math.log2(poster.vote_count + 1) * 0.75;
}

async function selectPosterPath(movieId: number, defaultPath: string | null, tmdbKey: string) {
  try {
    const imagesUrl = new URL(`${TMDB_API}/movie/${movieId}/images`);
    imagesUrl.searchParams.set('api_key', tmdbKey);
    imagesUrl.searchParams.set('include_image_language', 'en,null');
    const images = await tmdbJson<{ posters: TmdbPoster[] }>(imagesUrl);
    const alternative = images.posters
      .filter((poster) => (
        poster.file_path !== defaultPath
        && poster.width >= 780
        && poster.height >= 1100
        && poster.aspect_ratio >= 0.62
        && poster.aspect_ratio <= 0.72
        && (poster.vote_count >= 2 || poster.vote_average >= 4)
      ))
      .sort((a, b) => posterConfidence(b) - posterConfidence(a))[0];
    return alternative?.file_path ?? defaultPath;
  } catch (error) {
    console.warn('Alternative poster selection failed; using TMDB default.', error);
    return defaultPath;
  }
}

export async function POST(request: NextRequest) {
  const openAiKey = process.env.OPENAI_API_KEY;
  const tmdbKey = process.env.TMDB_API_KEY;
  if (!openAiKey || !tmdbKey) return NextResponse.json({ error: 'The recommendation engine is not configured.' }, { status: 500 });

  try {
    const body = await request.json() as RequestBody;
    const query = body.query?.trim() ?? '';
    if (query.length > 300) return NextResponse.json({ error: 'Please keep your request under 300 characters.' }, { status: 400 });
    if ((body.favorites ?? []).length > 5) return NextResponse.json({ error: 'You can add up to 5 favorite films.' }, { status: 400 });
    const favorites = (body.favorites ?? []).filter(Boolean).slice(0, 5);
    const excludedIds = new Set(body.excludeIds ?? []);
    const excludedTitleKeys = new Set(
      [...(body.excludedTitles ?? []), ...favorites]
        .map(normalizeMovieTitle)
        .filter(Boolean),
    );
    const allowLowRating = permitsLowRating(query);
    if (!query && favorites.length === 0) return NextResponse.json({ error: 'Tell us how you feel or add a film you love.' }, { status: 400 });
    const allowance = consumeRequestAllowance(request);
    if (!allowance.allowed) {
      return NextResponse.json({ error: 'DreamFrame is still a work-in-progress prototype. You’ve reached the limit of 5 recommendations. Thank you for trying it.' }, { status: 429, headers: { 'Retry-After': String(allowance.retryAfter) } });
    }

    let sourceTitle = '';
    let candidateTitles: string[] = [];
    if (body.mode === 'similar') {
      let source: TmdbMovie | undefined;
      if (body.sourceId) {
        const sourceUrl = new URL(`${TMDB_API}/movie/${body.sourceId}`);
        sourceUrl.searchParams.set('api_key', tmdbKey);
        sourceUrl.searchParams.set('language', 'en-US');
        source = await tmdbJson<TmdbMovie>(sourceUrl);
      } else {
        const sourceSearchUrl = new URL(`${TMDB_API}/search/movie`);
        sourceSearchUrl.searchParams.set('api_key', tmdbKey);
        sourceSearchUrl.searchParams.set('query', query);
        sourceSearchUrl.searchParams.set('include_adult', 'false');
        sourceSearchUrl.searchParams.set('language', 'en-US');
        const sourceSearch = await tmdbJson<{ results: TmdbMovie[] }>(sourceSearchUrl);
        source = sourceSearch.results[0];
      }
      if (!source) return NextResponse.json({ error: 'We could not find that film. Check the title and try again.' }, { status: 404 });
      sourceTitle = source.title;

      const relatedUrl = new URL(`${TMDB_API}/movie/${source.id}/recommendations`);
      relatedUrl.searchParams.set('api_key', tmdbKey);
      relatedUrl.searchParams.set('language', 'en-US');
      const related = await tmdbJson<{ results: TmdbMovie[] }>(relatedUrl);
      candidateTitles = related.results
        .filter((movie) => (
          movie.id !== source.id
          && !excludedIds.has(movie.id)
          && !excludedTitleKeys.has(normalizeMovieTitle(movie.title))
          && (allowLowRating || (movie.vote_average ?? 0) >= MINIMUM_RATING)
        ))
        .slice(0, 18)
        .map((movie) => movie.title);
      if (candidateTitles.length === 0) {
        const similarUrl = new URL(`${TMDB_API}/movie/${source.id}/similar`);
        similarUrl.searchParams.set('api_key', tmdbKey);
        similarUrl.searchParams.set('language', 'en-US');
        const similar = await tmdbJson<{ results: TmdbMovie[] }>(similarUrl);
        candidateTitles = similar.results
          .filter((movie) => (
            movie.id !== source.id
            && !excludedIds.has(movie.id)
            && !excludedTitleKeys.has(normalizeMovieTitle(movie.title))
            && (allowLowRating || (movie.vote_average ?? 0) >= MINIMUM_RATING)
          ))
          .slice(0, 18)
          .map((movie) => movie.title);
      }
      if (candidateTitles.length === 0) return NextResponse.json({ error: 'No related films were found for that title yet.' }, { status: 404 });
    }

    const rejectedTitles = [...(body.excludedTitles ?? [])];
    const rejectedTitleKeys = new Set(
      [...rejectedTitles, ...favorites, sourceTitle]
        .map(normalizeMovieTitle)
        .filter(Boolean),
    );
    const rejectTitle = (title: string) => {
      const key = normalizeMovieTitle(title);
      if (!key || rejectedTitleKeys.has(key)) return;
      rejectedTitleKeys.add(key);
      rejectedTitles.push(title);
    };

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const intent = await analyzeIntent(openAiKey, { ...body, query, favorites, sourceTitle, candidateTitles, excludedTitles: rejectedTitles });
      const intendedTitleKey = normalizeMovieTitle(intent.title);
      if (!intendedTitleKey || rejectedTitleKeys.has(intendedTitleKey)) {
        rejectTitle(intent.title);
        continue;
      }

      const searchUrl = new URL(`${TMDB_API}/search/movie`);
      searchUrl.searchParams.set('api_key', tmdbKey);
      searchUrl.searchParams.set('query', intent.title);
      searchUrl.searchParams.set('include_adult', 'false');
      searchUrl.searchParams.set('language', 'en-US');
      const search = await tmdbJson<{ results: TmdbMovie[] }>(searchUrl);
      const movie = search.results.find((item) => (
        !excludedIds.has(item.id)
        && normalizeMovieTitle(item.title) === intendedTitleKey
        && !rejectedTitleKeys.has(normalizeMovieTitle(item.title))
      ));
      if (!movie) {
        rejectTitle(intent.title);
        continue;
      }

      const detailsUrl = new URL(`${TMDB_API}/movie/${movie.id}`);
      detailsUrl.searchParams.set('api_key', tmdbKey);
      detailsUrl.searchParams.set('language', 'en-US');
      const details = await tmdbJson<MovieDetails>(detailsUrl);
      if (rejectedTitleKeys.has(normalizeMovieTitle(details.title))) {
        rejectTitle(intent.title);
        continue;
      }
      if (!allowLowRating && details.vote_average < MINIMUM_RATING) {
        rejectTitle(details.title);
        continue;
      }

      const selectedPosterPath = await selectPosterPath(details.id, details.poster_path, tmdbKey);
      const feelings = intent.desiredFeelings.map((item) => item.toLowerCase());
      return NextResponse.json({
        id: details.id,
        title: details.title,
        year: details.release_date?.slice(0, 4) || '—',
        runtime: details.runtime ? `${Math.floor(details.runtime / 60)}h ${details.runtime % 60}m` : 'Runtime unavailable',
        genres: details.genres.map((genre) => genre.name),
        overview: details.overview || 'No synopsis is available yet.',
        posterUrl: selectedPosterPath ? `${POSTER_BASE}${selectedPosterPath}` : null,
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
