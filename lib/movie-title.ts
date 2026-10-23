export function parseCandidateMovieTitle(value: string) {
  const title = value.trim();
  const yearMatch = title.match(/(?:\s*[([](\d{4})[)\]]|\s*[-–—,]\s*(\d{4}))$/);
  if (!yearMatch) return { title, year: '' };

  return {
    title: title.slice(0, yearMatch.index).trim(),
    year: yearMatch[1] || yearMatch[2] || '',
  };
}
