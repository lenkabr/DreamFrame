export const USAGE_STORAGE_KEY = 'dreamframe-usage-v1';

export function readUsage(limit: number) {
  const stored = Number(localStorage.getItem(USAGE_STORAGE_KEY) || '0');
  return Number.isFinite(stored) ? Math.min(Math.max(stored, 0), limit) : 0;
}

export function writeUsage(value: number) {
  localStorage.setItem(USAGE_STORAGE_KEY, String(value));
  window.dispatchEvent(new Event('dreamframe-usage-change'));
}

export function resetUsage() {
  localStorage.removeItem(USAGE_STORAGE_KEY);
  window.dispatchEvent(new Event('dreamframe-usage-change'));
}
