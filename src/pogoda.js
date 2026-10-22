/* Pogoda nad łowiskiem: bieżące warunki z Open-Meteo (config.json → pogoda.url; pusty adres
 * wyłącza funkcję). Zapytanie idzie o współrzędne łowiska (dane publiczne), nigdy o położenie
 * użytkownika. Odpowiedzi są trzymane w pamięci strony przez `waznoscMin`, żeby otwieranie tego
 * samego popupu nie odpytywało serwisu w kółko. Funkcje czyste (adres, opis, HTML) są testowane
 * w Node; sieć jest wstrzykiwana (`fetch`). */
import { esc } from './esc.js';

/** Zmienne „current” i „daily” pobierane z Open-Meteo. */
const BIEZACE = [
  'temperature_2m',
  'apparent_temperature',
  'precipitation',
  'weather_code',
  'wind_speed_10m',
  'wind_gusts_10m',
  'wind_direction_10m',
  'surface_pressure',
  'cloud_cover',
];
const DOBOWE = ['sunrise', 'sunset'];
/** Ile godzin wstecz pobierać ciśnienie do wyznaczenia tendencji. */
export const TENDENCJA_GODZ = 3;
/** Zmiana ciśnienia (hPa) w TENDENCJA_GODZ uznawana za wzrost/spadek. */
export const PROG_TENDENCJI_HPA = 1;

/** Opisy kodów pogody WMO (Open-Meteo `weather_code`). */
export const KODY = {
  0: ['☀️', 'bezchmurnie'],
  1: ['🌤️', 'prawie bezchmurnie'],
  2: ['⛅', 'częściowe zachmurzenie'],
  3: ['☁️', 'pochmurno'],
  45: ['🌫️', 'mgła'],
  48: ['🌫️', 'mgła osadzająca szadź'],
  51: ['🌦️', 'słaba mżawka'],
  53: ['🌦️', 'mżawka'],
  55: ['🌧️', 'gęsta mżawka'],
  56: ['🌧️', 'marznąca mżawka'],
  57: ['🌧️', 'marznąca mżawka'],
  61: ['🌧️', 'słaby deszcz'],
  63: ['🌧️', 'deszcz'],
  65: ['🌧️', 'ulewny deszcz'],
  66: ['🌧️', 'marznący deszcz'],
  67: ['🌧️', 'marznący deszcz'],
  71: ['🌨️', 'słaby śnieg'],
  73: ['🌨️', 'śnieg'],
  75: ['🌨️', 'intensywny śnieg'],
  77: ['🌨️', 'ziarna śniegu'],
  80: ['🌦️', 'przelotny deszcz'],
  81: ['🌧️', 'przelotne opady deszczu'],
  82: ['🌧️', 'gwałtowne opady deszczu'],
  85: ['🌨️', 'przelotny śnieg'],
  86: ['🌨️', 'przelotny śnieg'],
  95: ['⛈️', 'burza'],
  96: ['⛈️', 'burza z gradem'],
  99: ['⛈️', 'burza z gradem'],
};

const KIERUNKI = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** Kierunek wiatru (stopnie, skąd wieje) → skrót kompasowy. */
export function kierunekWiatru(stopnie) {
  if (typeof stopnie !== 'number' || !Number.isFinite(stopnie)) return '';
  return KIERUNKI[Math.round((((stopnie % 360) + 360) % 360) / 45) % 8];
}

/** Adres zapytania do Open-Meteo o bieżące warunki w punkcie [lat, lon]. */
export function adresPogody(baseUrl, [lat, lon]) {
  const u = new URL(baseUrl);
  u.searchParams.set('latitude', Number(lat).toFixed(4));
  u.searchParams.set('longitude', Number(lon).toFixed(4));
  u.searchParams.set('current', BIEZACE.join(','));
  u.searchParams.set('hourly', 'surface_pressure');
  u.searchParams.set('past_hours', String(TENDENCJA_GODZ));
  u.searchParams.set('forecast_hours', '1');
  u.searchParams.set('daily', DOBOWE.join(','));
  u.searchParams.set('forecast_days', '1');
  u.searchParams.set('timezone', 'Europe/Warsaw');
  return u.toString();
}

const liczba = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
/** „2026-10-22T07:05” → „7:05” (czas lokalny z odpowiedzi, bez przeliczania). */
const godzina = (iso) => {
  const m = /T(\d{2}):(\d{2})/.exec(String(iso || ''));
  return m ? `${Number(m[1])}:${m[2]}` : '';
};

/**
 * Odpowiedź Open-Meteo → opis do wyświetlenia albo null, gdy brak danych bieżących.
 * @returns {null | {
 *   ikona: string, opis: string, temp: number|null, odczuwalna: number|null, wiatr: number|null,
 *   porywy: number|null, kierunek: string, cisnienie: number|null, tendencja: 'rośnie'|'spada'|'stabilne'|'',
 *   opady: number|null, zachmurzenie: number|null, wschod: string, zachod: string, czas: string
 * }}
 */
export function opiszPogode(json) {
  const c = json && json.current;
  if (!c || typeof c !== 'object') return null;
  const [ikona, opis] = KODY[c.weather_code] || ['🌡️', ''];
  const cisnienie = liczba(c.surface_pressure);
  let tendencja = '';
  const h = json.hourly && Array.isArray(json.hourly.surface_pressure) ? json.hourly.surface_pressure : [];
  const wczesniej = liczba(h[0]);
  if (cisnienie != null && wczesniej != null) {
    const d = cisnienie - wczesniej;
    tendencja = d >= PROG_TENDENCJI_HPA ? 'rośnie' : d <= -PROG_TENDENCJI_HPA ? 'spada' : 'stabilne';
  }
  const d = json.daily || {};
  return {
    ikona,
    opis,
    temp: liczba(c.temperature_2m),
    odczuwalna: liczba(c.apparent_temperature),
    wiatr: liczba(c.wind_speed_10m),
    porywy: liczba(c.wind_gusts_10m),
    kierunek: kierunekWiatru(c.wind_direction_10m),
    cisnienie,
    tendencja,
    opady: liczba(c.precipitation),
    zachmurzenie: liczba(c.cloud_cover),
    wschod: godzina(Array.isArray(d.sunrise) ? d.sunrise[0] : ''),
    zachod: godzina(Array.isArray(d.sunset) ? d.sunset[0] : ''),
    czas: godzina(c.time),
  };
}

const STRZALKA = { rośnie: '↗', spada: '↘', stabilne: '→' };

/** Wiersze opisu pogody (tekst) — wspólne dla popupu i ewentualnych innych widoków. */
export function wierszePogody(p) {
  const w = [];
  if (p.temp != null) {
    let t = `${Math.round(p.temp)}°C`;
    if (p.odczuwalna != null && Math.abs(p.odczuwalna - p.temp) >= 2)
      t += ` (odczuwalna ${Math.round(p.odczuwalna)}°)`;
    w.push(`🌡️ ${t}${p.opis ? ', ' + p.opis : ''}`);
  } else if (p.opis) w.push(`${p.ikona} ${p.opis}`);
  if (p.wiatr != null) {
    let s = `💨 wiatr ${Math.round(p.wiatr)} km/h${p.kierunek ? ' ' + p.kierunek : ''}`;
    if (p.porywy != null && p.porywy - p.wiatr >= 10) s += `, porywy do ${Math.round(p.porywy)}`;
    w.push(s);
  }
  if (p.cisnienie != null) {
    w.push(
      `🔽 ${Math.round(p.cisnienie)} hPa${p.tendencja ? ` ${STRZALKA[p.tendencja]} ${p.tendencja}` : ''}`
    );
  }
  if (p.opady != null && p.opady > 0) w.push(`🌧️ opady ${p.opady.toFixed(1).replace('.', ',')} mm/h`);
  if (p.wschod && p.zachod) w.push(`🌅 ${p.wschod} – 🌇 ${p.zachod}`);
  return w;
}

/** HTML bloku pogody do popupu łowiska. `zrodlo` — adres do podpisu źródła (wymóg licencji CC BY). */
export function pogodaHtml(p, zrodlo) {
  const wiersze = wierszePogody(p);
  if (!wiersze.length) return '';
  const podpis = zrodlo
    ? ` <a class="drobny" href="${esc(zrodlo)}" target="_blank" rel="noopener noreferrer">Open-Meteo</a>`
    : '';
  return (
    `<div class="pogoda"><b>${esc(p.ikona)} Pogoda nad wodą</b>` +
    (p.czas ? `<span class="drobny"> (${esc(p.czas)})</span>` : '') +
    podpis +
    wiersze.map((t) => `<div>${esc(t)}</div>`).join('') +
    '</div>'
  );
}

/**
 * Pobieranie pogody z pamięcią podręczną i scalaniem równoczesnych zapytań o to samo łowisko.
 * `pobierz(id, latlng)` zwraca opis (opiszPogode) albo null — nigdy nie rzuca.
 */
export function utworzPogode({
  url,
  waznoscMin = 30,
  fetch: pobieranie = typeof fetch === 'function' ? fetch : null,
  teraz = () => Date.now(),
  timeoutMs = 6000,
} = {}) {
  const cache = new Map();
  const wToku = new Map();
  const wlaczona = !!url && !!pobieranie;

  async function zSieci(latlng) {
    const sygnal =
      typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined;
    const odp = await pobieranie(adresPogody(url, latlng), { signal: sygnal });
    if (!odp || !odp.ok) return null;
    return opiszPogode(await odp.json());
  }

  async function pobierz(id, latlng) {
    if (!wlaczona) return null;
    const wpis = cache.get(id);
    if (wpis && teraz() - wpis.t < waznoscMin * 60000) return wpis.p;
    if (wToku.has(id)) return wToku.get(id);
    const obietnica = zSieci(latlng)
      .then((p) => {
        if (p) cache.set(id, { t: teraz(), p });
        return p;
      })
      .catch(() => null)
      .finally(() => wToku.delete(id));
    wToku.set(id, obietnica);
    return obietnica;
  }

  return { pobierz, wlaczona };
}
