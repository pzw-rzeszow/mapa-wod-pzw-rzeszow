# Mapa wód PZW Rzeszów — zasady pracy

## Dokumentacja (wiki) jest częścią zmiany

Dokumentacja projektu żyje w wiki GitHub (osobne repozytorium
`https://github.com/pzw-rzeszow/mapa-wod-pzw-rzeszow.wiki.git`, 28 stron po polsku).
Zmiana w kodzie, workflow, migracji, konfiguracji lub narzędziach jest skończona dopiero
wtedy, gdy opisujące ją strony wiki mówią to samo co kod.

Przy każdym zadaniu, które zmienia pliki z `tools/wiki/mapa.json`:

1. Uruchom `npm run wiki:sprawdz` (zmiany robocze) albo `node tools/wiki/sprawdz.mjs --od origin/main`
   — wypisze strony wiki przypisane do zmienionych plików. Hook `PreToolUse` na `git commit`
   robi to samo automatycznie i dopisuje listę do kontekstu.
2. Przeczytaj te strony w klonie wiki (`git clone <wiki>` do katalogu tymczasowego) i porównaj
   z aktualnym zachowaniem kodu: nazwy plików, klucze config.json, limity, komunikaty, wyzwalacze
   workflowów, harmonogramy.
3. Popraw, co się rozjechało, w tym samym zadaniu; commit do wiki z prefiksem `Wiki:`.
   Nie opisuj historii prac ani funkcji, których nie ma na `main` (np. mapa do druku na gałęzi).
4. Nowy plik lub katalog w kodzie → dopisz go do `tools/wiki/mapa.json`.
5. W podsumowaniu dla użytkownika powiedz, które strony wiki zostały zmienione albo że żadna
   nie wymagała zmiany.

Wpisy w wiki mają styl: krótkie akapity po polsku, konkretne nazwy plików i wartości, bez dat
i bez „ostatnio zmieniono”. Komentarze nagłówkowe w workflowach (`.github/workflows/*.yml`)
powtarzają kluczowe założenia z wiki — zmieniając jedno, zmień drugie.

## Fakty, których nie widać w kodzie

- Push snapshot-bota kluczem wdrożeniowym NIE wyzwala zdarzenia `push` w Actions (sprawdzone
  26.09.2026). Publikację po snapshocie robi `deploy.yml` wyzwalaczem `workflow_run`.
- Nocne crony GitHub startują z kilkugodzinnym opóźnieniem (snapshot „03:15 UTC” realnie ~08:30 UTC).
- Testy E2E biegają na żywej stronie; gdy baza różni się od opublikowanego snapshotu, popup
  otwierany zaraz po starcie strony jest na ~200 ms zdublowany (odświeżenie danych) i testy
  WebKit padają na `strict mode violation`. Objaw = nieopublikowany snapshot, nie błąd testów.
