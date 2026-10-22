import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  adresPogody,
  opiszPogode,
  wierszePogody,
  pogodaHtml,
  kierunekWiatru,
  utworzPogode,
  TENDENCJA_GODZ,
} from './pogoda.js';

const ODPOWIEDZ = {
  latitude: 50.04,
  longitude: 21.99,
  current: {
    time: '2026-10-22T07:45',
    interval: 900,
    temperature_2m: 8.4,
    apparent_temperature: 5.1,
    precipitation: 0.3,
    weather_code: 61,
    wind_speed_10m: 14.2,
    wind_gusts_10m: 31.0,
    wind_direction_10m: 312,
    surface_pressure: 1004.6,
    cloud_cover: 90,
  },
  hourly: {
    time: [
      '2026-10-22T04:00',
      '2026-10-22T05:00',
      '2026-10-22T06:00',
      '2026-10-22T07:00',
      '2026-10-22T08:00',
    ],
    surface_pressure: [1007.1, 1006.4, 1005.5, 1004.9, 1004.2],
  },
  daily: { time: ['2026-10-22'], sunrise: ['2026-10-22T07:05'], sunset: ['2026-10-22T17:34'] },
};

test('adres: współrzędne zaokrąglone, bieżące + ciśnienie wstecz + wschód/zachód, strefa polska', () => {
  const u = new URL(adresPogody('https://api.open-meteo.com/v1/forecast', [50.004921, 21.958193]));
  assert.equal(u.origin + u.pathname, 'https://api.open-meteo.com/v1/forecast');
  assert.equal(u.searchParams.get('latitude'), '50.0049');
  assert.equal(u.searchParams.get('longitude'), '21.9582');
  assert.match(u.searchParams.get('current'), /temperature_2m/);
  assert.match(u.searchParams.get('current'), /surface_pressure/);
  assert.equal(u.searchParams.get('hourly'), 'surface_pressure');
  assert.equal(u.searchParams.get('past_hours'), String(TENDENCJA_GODZ));
  assert.equal(u.searchParams.get('daily'), 'sunrise,sunset');
  assert.equal(u.searchParams.get('timezone'), 'Europe/Warsaw');
});

test('kierunek wiatru', () => {
  assert.equal(kierunekWiatru(0), 'N');
  assert.equal(kierunekWiatru(44), 'NE');
  assert.equal(kierunekWiatru(312), 'NW');
  assert.equal(kierunekWiatru(359), 'N');
  assert.equal(kierunekWiatru(-90), 'W');
  assert.equal(kierunekWiatru('x'), '');
});

test('opis: temperatura, odczuwalna, wiatr, tendencja ciśnienia z 3 h wstecz, wschód i zachód', () => {
  const p = opiszPogode(ODPOWIEDZ);
  assert.equal(p.ikona, '🌧️');
  assert.equal(p.opis, 'słaby deszcz');
  assert.equal(p.temp, 8.4);
  assert.equal(p.odczuwalna, 5.1);
  assert.equal(p.kierunek, 'NW');
  assert.equal(p.cisnienie, 1004.6);
  assert.equal(p.tendencja, 'spada');
  assert.equal(p.wschod, '7:05');
  assert.equal(p.zachod, '17:34');
  assert.equal(p.czas, '7:45');
});

test('tendencja: stabilne w progu, rośnie powyżej; brak historii = brak tendencji', () => {
  const z = (teraz, wczesniej) =>
    opiszPogode({ current: { surface_pressure: teraz }, hourly: { surface_pressure: [wczesniej] } })
      .tendencja;
  assert.equal(z(1010, 1009.5), 'stabilne');
  assert.equal(z(1012, 1010), 'rośnie');
  assert.equal(z(1008, 1010), 'spada');
  assert.equal(opiszPogode({ current: { surface_pressure: 1010 } }).tendencja, '');
});

test('odporność: brak current → null, nieznany kod → ikona ogólna, śmieci w polach → null', () => {
  assert.equal(opiszPogode(null), null);
  assert.equal(opiszPogode({}), null);
  const p = opiszPogode({ current: { weather_code: 123, temperature_2m: 'ciepło', wind_speed_10m: NaN } });
  assert.equal(p.ikona, '🌡️');
  assert.equal(p.temp, null);
  assert.equal(p.wiatr, null);
  assert.deepEqual(wierszePogody(p), []);
  assert.equal(pogodaHtml(p, 'https://open-meteo.com/'), '');
});

test('wiersze: odczuwalna tylko przy różnicy ≥ 2°, porywy przy ≥ 10 km/h, opady tylko > 0', () => {
  const p = opiszPogode(ODPOWIEDZ);
  const w = wierszePogody(p);
  assert.equal(w[0], '🌡️ 8°C (odczuwalna 5°), słaby deszcz');
  assert.equal(w[1], '💨 wiatr 14 km/h NW, porywy do 31');
  assert.equal(w[2], '🔽 1005 hPa ↘ spada');
  assert.equal(w[3], '🌧️ opady 0,3 mm/h');
  assert.equal(w[4], '🌅 7:05 – 🌇 17:34');

  const bez = opiszPogode({
    current: {
      temperature_2m: 20,
      apparent_temperature: 21,
      wind_speed_10m: 5,
      wind_gusts_10m: 9,
      precipitation: 0,
      weather_code: 0,
    },
  });
  assert.deepEqual(wierszePogody(bez), ['🌡️ 20°C, bezchmurnie', '💨 wiatr 5 km/h']);
});

test('HTML: nagłówek, godzina, podpis źródła, wiersze — wszystko escapowane', () => {
  const html = pogodaHtml(opiszPogode(ODPOWIEDZ), 'https://open-meteo.com/?a=1&b=2');
  assert.match(html, /^<div class="pogoda"><b>🌧️ Pogoda nad wodą<\/b><span class="drobny"> \(7:45\)<\/span>/);
  assert.match(html, /href="https:\/\/open-meteo\.com\/\?a=1&amp;b=2"[^>]*>Open-Meteo<\/a>/);
  assert.match(html, /<div>💨 wiatr 14 km\/h NW, porywy do 31<\/div>/);
  assert.equal(pogodaHtml(opiszPogode(ODPOWIEDZ)).includes('Open-Meteo'), false, 'bez adresu — bez podpisu');
});

test('pobieranie: cache przez czas ważności, scalanie równoczesnych zapytań, błąd sieci → null', async () => {
  let wywolan = 0;
  let zegar = 0;
  const pobieranie = async () => {
    wywolan++;
    return { ok: true, json: async () => ODPOWIEDZ };
  };
  const pogoda = utworzPogode({
    url: 'https://x.test/v1/forecast',
    fetch: pobieranie,
    waznoscMin: 30,
    teraz: () => zegar,
  });
  assert.equal(pogoda.wlaczona, true);
  const [a, b] = await Promise.all([pogoda.pobierz('zb-a', [50, 21]), pogoda.pobierz('zb-a', [50, 21])]);
  assert.equal(wywolan, 1, 'równoczesne zapytania scalone');
  assert.equal(a.temp, 8.4);
  assert.equal(b, a);
  zegar = 29 * 60000;
  await pogoda.pobierz('zb-a', [50, 21]);
  assert.equal(wywolan, 1, 'z cache');
  zegar = 31 * 60000;
  await pogoda.pobierz('zb-a', [50, 21]);
  assert.equal(wywolan, 2, 'po wygaśnięciu znów z sieci');
  await pogoda.pobierz('zb-b', [50, 22]);
  assert.equal(wywolan, 3);

  const zly = utworzPogode({ url: 'https://x.test', fetch: async () => ({ ok: false }) });
  assert.equal(await zly.pobierz('zb-a', [50, 21]), null);
  const wyjatek = utworzPogode({
    url: 'https://x.test',
    fetch: async () => {
      throw new Error('sieć');
    },
  });
  assert.equal(await wyjatek.pobierz('zb-a', [50, 21]), null);
});

test('pusty adres w konfiguracji wyłącza pogodę', async () => {
  const pogoda = utworzPogode({
    url: '',
    fetch: async () => {
      throw new Error('nie powinno pytać');
    },
  });
  assert.equal(pogoda.wlaczona, false);
  assert.equal(await pogoda.pobierz('zb-a', [50, 21]), null);
});
