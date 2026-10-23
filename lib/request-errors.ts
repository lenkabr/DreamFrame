export function isRequestTimeout(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.name === 'TimeoutError'
    || error.name === 'AbortError'
    || /\b(?:aborted?|timed? out|timeout)\b/i.test(error.message);
}
