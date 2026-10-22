/* Filtry mapy publicznej — czysta logika bez DOM i Leaflet (testowalna w Node). */
import { RODZAJE } from './zbiorniki-typ.js';

/** Promienie „W promieniu” (km) do wyboru po ustaleniu położenia; 0 = bez ograniczenia. */
export const PROMIENIE_KM = [10, 25, 50];

/** Stan filtrów mapy publicznej. */
export function createFilters() {
  return {
    active: new Set(['zb', 'niz', 'gor']), // warstwy
    kinds: new Set(Object.keys(RODZAJE)), // rodzaje zbiorników
    nokillOnly: false, // tylko łowiska NO-KILL
    obwod: '', // obwód rybacki ('' = wszystkie)
    tylkoUlubione: false, // tylko łowiska oznaczone gwiazdką (src/ulubione.js)
    ulubione: new Set(), // id ulubionych (src/link.js)
    promienKm: 0, // tylko łowiska bliżej niż N km od położenia użytkownika (0 = wszystkie)
  };
}

/** Czy wpis przechodzi przez filtry (bez wyszukiwarki). `e.km` — odległość od użytkownika, gdy znana. */
export function passesFilters(e, f) {
  if (!f.active.has(e.f)) return false;
  if (e.f === 'zb') {
    if (!f.kinds.has(e.kind)) return false;
    if (f.nokillOnly && !e.nokill) return false;
  }
  if (f.obwod && (e.f === 'zb' || e.f === 'niz' || e.f === 'gor') && e.obwod !== f.obwod) return false;
  if (f.tylkoUlubione && !f.ulubione.has(e.id)) return false;
  if (f.promienKm > 0 && typeof e.km === 'number' && e.km > f.promienKm) return false;
  return true;
}

/** Lista obwodów rybackich występujących w danych, posortowana po polsku. */
export function obwodyList(entries) {
  const set = new Set(entries.map((e) => e.obwod).filter(Boolean));
  return [...set].sort((a, b) => a.localeCompare(b, 'pl', { numeric: true }));
}

/** Czy filtry pod „Więcej filtrów” różnią się od domyślnych (promień ma własny, widoczny rząd chipów). */
export function extraFiltersActive(f) {
  return f.kinds.size !== Object.keys(RODZAJE).length || f.nokillOnly || !!f.obwod;
}

/** „Wyczyść”: przywraca domyślne filtry dodatkowe i zdejmuje promień (nie rusza warstw ani ulubionych). */
export function resetExtraFilters(f) {
  Object.keys(RODZAJE).forEach((k) => f.kinds.add(k));
  f.nokillOnly = false;
  f.obwod = '';
  f.promienKm = 0;
}
