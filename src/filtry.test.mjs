import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createFilters,
  passesFilters,
  obwodyList,
  extraFiltersActive,
  resetExtraFilters,
  PROMIENIE_KM,
} from './filtry.js';

const zb = (kind, extra = {}) => ({ f: 'zb', kind, nokill: false, obwod: '', ...extra });
const rz = (f, obwod) => ({ f, obwod });

test('domyślne filtry: zbiorniki i rzeki widoczne, granice ukryte', () => {
  const f = createFilters();
  assert.equal(passesFilters(zb('zaporowy'), f), true);
  assert.equal(passesFilters(rz('niz', 'Wisłok 3'), f), true);
  assert.equal(passesFilters(rz('gor', 'Wisłoka 4'), f), true);
  assert.equal(passesFilters({ f: 'gr' }, f), false);
  assert.equal(extraFiltersActive(f), false);
});

test('rodzaj zbiornika i NO-KILL', () => {
  const f = createFilters();
  f.kinds.delete('staw');
  assert.equal(passesFilters(zb('staw'), f), false);
  assert.equal(passesFilters(zb('zaporowy'), f), true);
  f.nokillOnly = true;
  assert.equal(passesFilters(zb('zaporowy'), f), false);
  assert.equal(passesFilters(zb('zaporowy', { nokill: true }), f), true);
  assert.equal(passesFilters(rz('niz', ''), f), true, 'NO-KILL nie dotyczy rzek');
  assert.equal(extraFiltersActive(f), true);
});

test('obwód rybacki filtruje rzeki i zbiorniki, nie granice', () => {
  const f = createFilters();
  f.active.add('gr');
  f.obwod = 'Wisłok 3';
  assert.equal(passesFilters(rz('niz', 'Wisłok 3'), f), true);
  assert.equal(passesFilters(rz('niz', 'San 9'), f), false);
  assert.equal(passesFilters(zb('zaporowy', { obwod: 'Wisłok 3' }), f), true);
  assert.equal(passesFilters(zb('zaporowy'), f), false, 'zbiornik bez obwodu znika przy wybranym obwodzie');
  assert.equal(passesFilters({ f: 'gr' }, f), true);
});

test('lista obwodów: unikalna, po polsku, numerycznie', () => {
  const list = obwodyList([
    rz('niz', 'Wisłok 3'),
    rz('gor', 'Wisłoka 10'),
    rz('gor', 'Wisłoka 4'),
    zb('staw'),
    rz('niz', 'Wisłok 3'),
  ]);
  assert.deepEqual(list, ['Wisłok 3', 'Wisłoka 4', 'Wisłoka 10']);
});

test('tylko ulubione: po id, we wszystkich warstwach, nie liczy się jako filtr dodatkowy', () => {
  const f = createFilters();
  f.active.add('gr');
  f.ulubione.add('zb-mrowla');
  f.ulubione.add('gr-ujscie');
  f.tylkoUlubione = true;
  assert.equal(passesFilters(zb('staw', { id: 'zb-mrowla' }), f), true);
  assert.equal(passesFilters(zb('staw', { id: 'zb-inny' }), f), false);
  assert.equal(passesFilters({ f: 'gr', id: 'gr-ujscie' }, f), true);
  assert.equal(passesFilters({ f: 'niz', obwod: '', id: 'rz-san' }, f), false);
  assert.equal(extraFiltersActive(f), false, 'gwiazdka jest w głównym rzędzie, nie pod „Więcej filtrów”');
  f.tylkoUlubione = false;
  assert.equal(passesFilters(zb('staw', { id: 'zb-inny' }), f), true);
});

test('promień od położenia: tylko wpisy ze znaną odległością', () => {
  const f = createFilters();
  f.promienKm = 25;
  assert.equal(passesFilters(zb('staw', { km: 24.9 }), f), true);
  assert.equal(passesFilters(zb('staw', { km: 25.1 }), f), false);
  assert.equal(passesFilters(zb('staw'), f), true, 'bez położenia promień nie ukrywa');
  assert.equal(passesFilters({ f: 'niz', obwod: '', km: 40 }, f), false, 'dotyczy też rzek');
  assert.equal(extraFiltersActive(f), false, 'promień ma własny rząd chipów, nie wyróżnia „Więcej filtrów”');
  assert.deepEqual(PROMIENIE_KM, [10, 25, 50]);
});

test('wyczyść filtry dodatkowe: rodzaje, NO-KILL, obwód i promień — warstwy i ulubione zostają', () => {
  const f = createFilters();
  f.kinds.delete('staw');
  f.nokillOnly = true;
  f.obwod = 'San 9';
  f.promienKm = 10;
  f.active.delete('zb');
  f.tylkoUlubione = true;
  resetExtraFilters(f);
  assert.equal(extraFiltersActive(f), false);
  assert.equal(f.kinds.has('staw'), true);
  assert.equal(f.active.has('zb'), false);
  assert.equal(f.tylkoUlubione, true);
});
