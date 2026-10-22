import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  KLUCZ,
  LIMIT,
  wczytajUlubione,
  zapiszUlubione,
  przelaczUlubione,
  uporzadkujUlubione,
  gwiazdka,
} from './ulubione.js';

/** Atrapa localStorage. */
function atrapa(poczatek = {}) {
  const dane = { ...poczatek };
  return {
    dane,
    getItem: (k) => (k in dane ? dane[k] : null),
    setItem: (k, v) => {
      dane[k] = String(v);
    },
    removeItem: (k) => {
      delete dane[k];
    },
  };
}

test('bez zapisu, bez storage lub z uszkodzonym zapisem — pusty zbiór', () => {
  assert.deepEqual([...wczytajUlubione(atrapa())], []);
  assert.deepEqual([...wczytajUlubione(null)], []);
  assert.deepEqual([...wczytajUlubione(atrapa({ [KLUCZ]: '{nie json' }))], []);
  assert.deepEqual([...wczytajUlubione(atrapa({ [KLUCZ]: '{"a":1}' }))], [], 'nie-tablica');
  assert.deepEqual(
    [...wczytajUlubione(atrapa({ [KLUCZ]: '["zb-x", 5, "", null, "rz-y"]' }))],
    ['zb-x', 'rz-y']
  );
});

test('przełączenie dodaje i usuwa, zapisując od razu', () => {
  const s = atrapa();
  const u = wczytajUlubione(s);
  assert.equal(przelaczUlubione(u, 'zb-mrowla', s), true);
  assert.equal(JSON.parse(s.dane[KLUCZ]).includes('zb-mrowla'), true);
  assert.equal(przelaczUlubione(u, 'rz-san-san-9', s), true);
  assert.deepEqual(JSON.parse(s.dane[KLUCZ]), ['zb-mrowla', 'rz-san-san-9']);
  assert.equal(przelaczUlubione(u, 'zb-mrowla', s), false);
  assert.deepEqual(JSON.parse(s.dane[KLUCZ]), ['rz-san-san-9']);
  assert.equal(przelaczUlubione(u, 'rz-san-san-9', s), false);
  assert.equal(KLUCZ in s.dane, false, 'pusty zbiór usuwa klucz');
});

test('brak storage (tryb prywatny) nie przerywa działania', () => {
  const u = new Set();
  assert.equal(przelaczUlubione(u, 'zb-a', null), true);
  assert.equal(zapiszUlubione(u, null), false);
  const psuje = {
    getItem: () => null,
    setItem: () => {
      throw new Error('QuotaExceeded');
    },
    removeItem() {},
  };
  assert.equal(zapiszUlubione(new Set(['x']), psuje), false);
});

test('limit wpisów', () => {
  const s = atrapa();
  const u = new Set();
  for (let i = 0; i < LIMIT + 10; i++) przelaczUlubione(u, 'zb-' + i, s);
  assert.equal(u.size, LIMIT);
  assert.equal(JSON.parse(s.dane[KLUCZ]).length, LIMIT);
});

test('porządkowanie usuwa id spoza danych', () => {
  const s = atrapa({ [KLUCZ]: '["zb-a","zb-b","rz-c"]' });
  const u = wczytajUlubione(s);
  assert.equal(uporzadkujUlubione(u, new Set(['zb-a', 'rz-c']), s), true);
  assert.deepEqual([...u], ['zb-a', 'rz-c']);
  assert.deepEqual(JSON.parse(s.dane[KLUCZ]), ['zb-a', 'rz-c']);
  assert.equal(uporzadkujUlubione(u, new Set(['zb-a', 'rz-c']), s), false, 'bez zmian — bez zapisu');
});

test('gwiazdka', () => {
  assert.equal(gwiazdka(true), '★');
  assert.equal(gwiazdka(false), '☆');
});
