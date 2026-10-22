/* Ulubione łowiska: zbiór id (src/link.js) zapamiętany w przeglądarce (localStorage), bez konta
 * i bez wysyłania czegokolwiek na serwer. Id pochodzą z nazw, więc ulubione przeżywają zmianę
 * kolejności danych i nocny snapshot. Czysta logika — testowana w Node z atrapą storage. */

export const KLUCZ = 'pzw-ulubione';
/** Górny limit wpisów — zabezpieczenie przed rozrostem storage (lista łowisk ma ok. 100 pozycji). */
export const LIMIT = 500;

/** Magazyn: localStorage, gdy dostępny; w trybie prywatnym lub bez okna — null. */
function magazyn(storage) {
  if (storage !== undefined) return storage;
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Zbiór id ulubionych z magazynu (pusty przy braku zapisu, uszkodzonym zapisie lub braku storage). */
export function wczytajUlubione(storage) {
  const s = magazyn(storage);
  if (!s) return new Set();
  try {
    const lista = JSON.parse(s.getItem(KLUCZ) || '[]');
    if (!Array.isArray(lista)) return new Set();
    return new Set(lista.filter((x) => typeof x === 'string' && x).slice(0, LIMIT));
  } catch {
    return new Set();
  }
}

/** Zapis zbioru; brak storage niczego nie psuje (ulubione obowiązują do przeładowania strony). */
export function zapiszUlubione(zbior, storage) {
  const s = magazyn(storage);
  if (!s) return false;
  try {
    if (zbior.size === 0) s.removeItem(KLUCZ);
    else s.setItem(KLUCZ, JSON.stringify([...zbior].slice(0, LIMIT)));
    return true;
  } catch {
    return false;
  }
}

/** Dodaje albo usuwa id; zwraca true, gdy po zmianie id jest ulubione. Zapisuje od razu. */
export function przelaczUlubione(zbior, id, storage) {
  if (zbior.has(id)) zbior.delete(id);
  else if (zbior.size < LIMIT) zbior.add(id);
  zapiszUlubione(zbior, storage);
  return zbior.has(id);
}

/** Usuwa z ulubionych id, których nie ma już w danych (np. łowisko wykreślone z wykazu). */
export function uporzadkujUlubione(zbior, istniejace, storage) {
  let zmiana = false;
  for (const id of zbior) {
    if (!istniejace.has(id)) {
      zbior.delete(id);
      zmiana = true;
    }
  }
  if (zmiana) zapiszUlubione(zbior, storage);
  return zmiana;
}

/** Gwiazdka do listy i popupu. */
export const gwiazdka = (ulubione) => (ulubione ? '★' : '☆');
