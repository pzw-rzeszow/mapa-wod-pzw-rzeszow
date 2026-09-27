#!/usr/bin/env node
/**
 * Które strony wiki mogą wymagać aktualizacji po zmianach w kodzie (tools/wiki/mapa.json).
 *
 * Bez argumentów bierze zmiany robocze (niezacommitowane, w indeksie i nowe pliki).
 *   node tools/wiki/sprawdz.mjs                  lista stron do sprawdzenia (tekst)
 *   node tools/wiki/sprawdz.mjs --od origin/main  zmiany od podanego commitu/gałęzi
 *   node tools/wiki/sprawdz.mjs --hook stop       JSON dla hooka Stop (systemMessage)
 *   node tools/wiki/sprawdz.mjs --hook pretool    JSON dla hooka PreToolUse (additionalContext)
 *
 * Wiki: https://github.com/pzw-rzeszow/mapa-wod-pzw-rzeszow/wiki/<Strona>
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WIKI = 'https://github.com/pzw-rzeszow/mapa-wod-pzw-rzeszow/wiki/';

const args = process.argv.slice(2);
const opcja = (nazwa) => {
  const i = args.indexOf(nazwa);
  return i >= 0 ? args[i + 1] : null;
};
const od = opcja('--od');
const hook = opcja('--hook');

const git = (...a) => {
  try {
    return execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
};

/** Zmienione ścieżki: od commitu albo zmiany robocze (łącznie z nowymi plikami). */
export function zmienionePliki(odRef) {
  const linie = odRef
    ? git('diff', '--name-only', `${odRef}...HEAD`) + git('diff', '--name-only', 'HEAD')
    : git('diff', '--name-only', 'HEAD') + git('ls-files', '--others', '--exclude-standard');
  return [...new Set(linie.split('\n').map((s) => s.trim()).filter(Boolean))];
}

const naRegex = (wzorzec) =>
  new RegExp('^' + wzorzec.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$');

/** Strony wiki dla listy ścieżek: Map<strona, ścieżki[]>. Ścieżki bez wpisu trafiają pod klucz null. */
export function stronyDlaPlikow(pliki, mapa) {
  const wynik = new Map();
  const bezMapy = [];
  for (const plik of pliki) {
    const wpisy = mapa.filter(({ wzorzec }) =>
      wzorzec.endsWith('/') ? plik.startsWith(wzorzec) : wzorzec.includes('*') ? naRegex(wzorzec).test(plik) : plik === wzorzec
    );
    if (!wpisy.length) {
      bezMapy.push(plik);
      continue;
    }
    for (const { strony } of wpisy) for (const s of strony) wynik.set(s, [...(wynik.get(s) || []), plik]);
  }
  return { strony: wynik, bezMapy };
}

function tekst(strony, bezMapy) {
  const linie = [...strony].map(([s, pliki]) => `- ${s}  (${[...new Set(pliki)].join(', ')})`);
  if (bezMapy.length) linie.push(`Bez wpisu w tools/wiki/mapa.json: ${bezMapy.join(', ')}`);
  return linie.join('\n');
}

/** Wejście hooka (JSON na stdin); pusty obiekt poza hookiem. */
function wejscieHooka() {
  if (process.stdin.isTTY) return {};
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
}

// Hook PreToolUse jest podpięty pod Bash; reagujemy tylko na commit, nie na każde użycie gita.
if (hook === 'pretool') {
  const polecenie = (wejscieHooka().tool_input || {}).command || '';
  if (!/(^|[;&|]\s*)git\s+commit\b/.test(polecenie.trim())) process.exit(0);
}

const { mapa } = JSON.parse(readFileSync(resolve(ROOT, 'tools/wiki/mapa.json'), 'utf8'));
const pliki = zmienionePliki(od);
const { strony, bezMapy } = stronyDlaPlikow(pliki, mapa);
const kodOrazDocs = [...strony].filter(([s]) => s).length > 0;

if (hook === 'stop') {
  if (kodOrazDocs) {
    const lista = [...strony.keys()].join(', ');
    console.log(JSON.stringify({ systemMessage: `Zmienione pliki dotyczą stron wiki: ${lista}. Sprawdź, czy opisy są aktualne (npm run wiki:sprawdz).` }));
  }
} else if (hook === 'pretool') {
  if (kodOrazDocs) {
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          additionalContext:
            'Przed commitem: zmienione pliki są opisane na stronach wiki (' +
            WIKI +
            '), które mogą wymagać aktualizacji w tym samym zadaniu:\n' +
            tekst(strony, []) +
            '\nJeśli zmiana nie wpływa na opisane zachowanie, nic nie rób; w przeciwnym razie zaktualizuj wiki (klon: git clone https://github.com/pzw-rzeszow/mapa-wod-pzw-rzeszow.wiki.git) i wspomnij o tym w podsumowaniu.',
        },
      })
    );
  }
} else {
  if (!pliki.length) console.log(od ? `Brak zmian od ${od}.` : 'Brak zmian roboczych.');
  else if (!kodOrazDocs) console.log('Zmienione pliki nie są opisane na wiki.' + (bezMapy.length ? `\nBez wpisu w tools/wiki/mapa.json: ${bezMapy.join(', ')}` : ''));
  else console.log('Strony wiki do sprawdzenia:\n' + tekst(strony, bezMapy));
}
