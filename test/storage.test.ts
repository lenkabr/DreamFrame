import assert from 'node:assert/strict';
import test from 'node:test';
import { createSeenBackup, mergeSeenMovies, readSeenBackup, readSeenMovies, replaceSeenMovies } from '../lib/seen-storage.ts';
import { readUsage, resetUsage, writeUsage } from '../lib/usage-storage.ts';

class MemoryStorage {
  #values = new Map<string, string>();

  getItem(key: string) { return this.#values.get(key) ?? null; }
  setItem(key: string, value: string) { this.#values.set(key, String(value)); }
  removeItem(key: string) { this.#values.delete(key); }
  clear() { this.#values.clear(); }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
Object.defineProperty(globalThis, 'window', {
  value: { dispatchEvent: () => true },
  configurable: true,
});

test.beforeEach(() => storage.clear());

test('seen films persist, merge without duplicates, and survive a reload', () => {
  replaceSeenMovies([{ id: 329865, title: 'Arrival', year: '2016', status: 'seen', updatedAt: 1 }]);
  mergeSeenMovies([
    { id: 329865, title: 'Arrival', year: '2016', status: 'seen', updatedAt: 2 },
    { id: 976893, title: 'Perfect Days', year: '2023', status: 'seen', updatedAt: 3 },
  ]);

  assert.deepEqual(readSeenMovies().map(({ id, title }) => ({ id, title })), [
    { id: 329865, title: 'Arrival' },
    { id: 976893, title: 'Perfect Days' },
  ]);
});

test('watched-film backup can be exported and restored', () => {
  const movies = [{ id: 146233, title: 'Prisoners', year: '2013', status: 'seen' as const, updatedAt: 1 }];
  assert.deepEqual(readSeenBackup(createSeenBackup(movies)), movies);
});

test('resetting recommendation usage does not remove watched films', () => {
  replaceSeenMovies([{ id: 329865, title: 'Arrival', status: 'seen', updatedAt: 1 }]);
  writeUsage(30);
  assert.equal(readUsage(30), 30);

  resetUsage();

  assert.equal(readUsage(30), 0);
  assert.equal(readSeenMovies()[0]?.title, 'Arrival');
});
