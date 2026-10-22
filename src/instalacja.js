/* Instalacja mapy jako aplikacji (PWA): przycisk „📲 Zainstaluj” w menu pojawia się, gdy
 * przeglądarka zgłosi `beforeinstallprompt` (Chrome/Edge na Androidzie i komputerze). Na iPhonie
 * i iPadzie Safari nie ma takiego zdarzenia — przycisk pokazuje instrukcję „Udostępnij → Do ekranu
 * początkowego”. W uruchomionej aplikacji (tryb standalone) przycisk jest ukryty. */

/** Czy strona działa już jako zainstalowana aplikacja. */
export function czyZainstalowana(win = typeof window !== 'undefined' ? window : null) {
  if (!win) return false;
  try {
    if (win.matchMedia && win.matchMedia('(display-mode: standalone)').matches) return true;
  } catch {
    /* brak matchMedia */
  }
  return !!(win.navigator && win.navigator.standalone === true);
}

/** iPhone/iPad (także iPad w trybie „komputerowym”: Mac z ekranem dotykowym). */
export function czyIOS(userAgent, maxTouchPoints = 0) {
  return /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
}

export const INSTRUKCJA_IOS =
  'Na iPhonie i iPadzie: w Safari stuknij przycisk udostępniania (kwadrat ze strzałką), a potem „Do ekranu początkowego”.';
export const PO_INSTALACJI = 'Mapa jest na ekranie głównym — działa także przy słabym zasięgu.';

/**
 * Podpina przycisk instalacji. `komunikat(tekst, ms)` — krótki komunikat na ekranie.
 * Zwraca { dostepna() } — czy przycisk jest widoczny (do testów i diagnostyki).
 */
export function initInstalacja(btn, { komunikat, win = window } = {}) {
  let zdarzenie = null;
  const pokaz = (tak) => {
    btn.hidden = !tak;
  };
  pokaz(false);
  if (czyZainstalowana(win)) return { dostepna: () => false };

  const ios = czyIOS(win.navigator.userAgent, win.navigator.maxTouchPoints || 0);
  if (ios) pokaz(true);

  win.addEventListener('beforeinstallprompt', (ev) => {
    ev.preventDefault();
    zdarzenie = ev;
    pokaz(true);
  });
  win.addEventListener('appinstalled', () => {
    zdarzenie = null;
    pokaz(false);
    komunikat(PO_INSTALACJI);
  });
  btn.addEventListener('click', async () => {
    if (zdarzenie) {
      const ev = zdarzenie;
      zdarzenie = null;
      pokaz(false);
      try {
        ev.prompt();
        const wybor = await ev.userChoice;
        if (!wybor || wybor.outcome !== 'accepted') pokaz(true);
      } catch {
        pokaz(true);
      }
      return;
    }
    if (ios) komunikat(INSTRUKCJA_IOS, 9000);
  });
  return { dostepna: () => !btn.hidden };
}
