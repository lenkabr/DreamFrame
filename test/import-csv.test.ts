import assert from 'node:assert/strict';
import test from 'node:test';
import { extractImdbFilms, extractLetterboxdFilms, parseCsv } from '../lib/import-csv.ts';

test('CSV parser handles commas, quotes, and Windows line endings', () => {
  assert.deepEqual(
    parseCsv('Name,Year\r\n"Paris, Texas",1984\r\n"Say ""hello""",2020'),
    [['Name', 'Year'], ['Paris, Texas', '1984'], ['Say "hello"', '2020']],
  );
});

test('Letterboxd import finds films and removes duplicate rows', () => {
  const films = extractLetterboxdFilms('Name,Year\nArrival,2016\nArrival,2016\nPerfect Days,2023');
  assert.deepEqual(films, [
    { title: 'Arrival', year: '2016' },
    { title: 'Perfect Days', year: '2023' },
  ]);
});

test('IMDb import keeps films and excludes television entries', () => {
  const films = extractImdbFilms([
    'Const,Title,Title Type,Year',
    'tt2543164,Arrival,movie,2016',
    'tt0903747,Breaking Bad,tvSeries,2008',
    'tt1234567,Pilot,tvEpisode,2020',
    'tt27503384,Perfect Days,movie,2023',
  ].join('\n'));

  assert.deepEqual(films, [
    { title: 'Arrival', year: '2016', imdbId: 'tt2543164' },
    { title: 'Perfect Days', year: '2023', imdbId: 'tt27503384' },
  ]);
});
