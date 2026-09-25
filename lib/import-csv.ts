export type CsvFilm = { title: string; year: string; imdbId?: string };

export function parseCsv(text: string) {
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

export function extractLetterboxdFilms(text: string): CsvFilm[] {
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

export function extractImdbFilms(text: string): CsvFilm[] {
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
