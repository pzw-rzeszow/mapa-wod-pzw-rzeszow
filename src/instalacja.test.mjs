import { test } from 'node:test';
import assert from 'node:assert/strict';
import { czyZainstalowana, czyIOS, initInstalacja, INSTRUKCJA_IOS, PO_INSTALACJI } from './instalacja.js';

/** Atrapa okna: nasłuchy, matchMedia, navigator. */
function okno({
  standalone = false,
  userAgent = 'Mozilla/5.0 (Linux; Android 14) Chrome/130',
  maxTouchPoints = 0,
} = {}) {
  const nasluchy = {};
  return {
    nasluchy,
    addEventListener: (typ, fn) => {
      (nasluchy[typ] ||= []).push(fn);
    },
    wyslij: (typ, ev = {}) => (nasluchy[typ] || []).forEach((fn) => fn(ev)),
    matchMedia: () => ({ matches: standalone }),
    navigator: { userAgent, maxTouchPoints },
  };
}
function przycisk() {
  const n = {};
  return {
    hidden: false,
    addEventListener: (typ, fn) => {
      n[typ] = fn;
    },
    kliknij: () => n.click(),
  };
}
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';

test('wykrywanie: standalone i iOS (w tym iPad udający Maca)', () => {
  assert.equal(czyZainstalowana(okno({ standalone: true })), true);
  assert.equal(czyZainstalowana(okno()), false);
  assert.equal(czyZainstalowana({ navigator: { standalone: true } }), true, 'Safari: navigator.standalone');
  assert.equal(czyZainstalowana(null), false);
  assert.equal(czyIOS(IPHONE), true);
  assert.equal(czyIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari', 5), true);
  assert.equal(czyIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari', 0), false);
  assert.equal(czyIOS('Mozilla/5.0 (Linux; Android 14) Chrome/130'), false);
});

test('Android/Chrome: przycisk ukryty do beforeinstallprompt, klik wywołuje prompt, akceptacja chowa', async () => {
  const win = okno();
  const btn = przycisk();
  const komunikaty = [];
  const inst = initInstalacja(btn, { komunikat: (t) => komunikaty.push(t), win });
  assert.equal(btn.hidden, true);
  assert.equal(inst.dostepna(), false);

  let zapobiegnieto = false;
  let wywolano = false;
  win.wyslij('beforeinstallprompt', {
    preventDefault: () => {
      zapobiegnieto = true;
    },
    prompt: () => {
      wywolano = true;
    },
    userChoice: Promise.resolve({ outcome: 'accepted' }),
  });
  assert.equal(zapobiegnieto, true);
  assert.equal(btn.hidden, false);
  await btn.kliknij();
  assert.equal(wywolano, true);
  assert.equal(btn.hidden, true, 'po akceptacji przycisk znika');
  win.wyslij('appinstalled');
  assert.deepEqual(komunikaty, [PO_INSTALACJI]);
});

test('odrzucenie instalacji przywraca przycisk', async () => {
  const win = okno();
  const btn = przycisk();
  initInstalacja(btn, { komunikat: () => {}, win });
  win.wyslij('beforeinstallprompt', {
    preventDefault() {},
    prompt() {},
    userChoice: Promise.resolve({ outcome: 'dismissed' }),
  });
  await btn.kliknij();
  assert.equal(btn.hidden, false);
});

test('iPhone: przycisk od razu widoczny, klik pokazuje instrukcję', async () => {
  const win = okno({ userAgent: IPHONE });
  const btn = przycisk();
  const komunikaty = [];
  initInstalacja(btn, { komunikat: (t) => komunikaty.push(t), win });
  assert.equal(btn.hidden, false);
  await btn.kliknij();
  assert.deepEqual(komunikaty, [INSTRUKCJA_IOS]);
});

test('zainstalowana aplikacja: przycisk ukryty na stałe', () => {
  const win = okno({ standalone: true, userAgent: IPHONE });
  const btn = przycisk();
  const inst = initInstalacja(btn, { komunikat: () => {}, win });
  assert.equal(btn.hidden, true);
  assert.equal(inst.dostepna(), false);
  assert.equal(win.nasluchy.beforeinstallprompt, undefined);
});
