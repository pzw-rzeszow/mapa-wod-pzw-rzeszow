/* Generuje ikony aplikacji (public/ikony/) z tools/pwa/ikona.svg:
 *  - ikona-192.png, ikona-512.png — zwykłe (manifest `any`),
 *  - ikona-maskowalna-512.png — z marginesem 10 % (Android wycina kształt; manifest `maskable`),
 *  - apple-touch-icon.png (180 px) — ekran początkowy iPhone'a/iPada.
 * Użycie: npm i --no-save sharp && node tools/pwa/ikony.mjs. Pakiet sharp celowo nie jest w
 * package.json — ikony zmieniają się rzadko, a wygenerowane PNG są w repozytorium. */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const tu = dirname(fileURLToPath(import.meta.url));
const zrodlo = readFileSync(resolve(tu, 'ikona.svg'));
const katalog = resolve(tu, '../../public/ikony');
mkdirSync(katalog, { recursive: true });

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('Brak pakietu sharp. Zainstaluj tymczasowo: npm i --no-save sharp');
  process.exit(1);
}

/** PNG o boku `rozmiar`; `margines` (ułamek boku) = tło wokół pomniejszonego rysunku. */
async function png(rozmiar, margines = 0) {
  if (!margines) return sharp(zrodlo).resize(rozmiar, rozmiar).png().toBuffer();
  const wewn = Math.round(rozmiar * (1 - 2 * margines));
  const rysunek = await sharp(zrodlo).resize(wewn, wewn).png().toBuffer();
  const off = Math.round((rozmiar - wewn) / 2);
  return sharp({ create: { width: rozmiar, height: rozmiar, channels: 4, background: '#0d3b66' } })
    .composite([{ input: rysunek, left: off, top: off }])
    .png()
    .toBuffer();
}

const pliki = {
  'ikona-192.png': await png(192),
  'ikona-512.png': await png(512),
  'ikona-maskowalna-512.png': await png(512, 0.1),
  'apple-touch-icon.png': await png(180),
};
for (const [nazwa, dane] of Object.entries(pliki)) {
  writeFileSync(resolve(katalog, nazwa), dane);
  console.log(nazwa, dane.length, 'B');
}
