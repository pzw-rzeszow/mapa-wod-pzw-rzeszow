/* Mapa publiczna (index.html). */
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { BASEMAPS, LINKS, SITE, POGODA } from './config.js';
import { crs, ZOOM, CENTER, maxBounds, MAX_BOUNDS_VISCOSITY } from './crs.js';
import { initBasemaps } from './basemaps.js';
import { loadSnapshot, loadFromSupabase, polaczDane, getSupabase, esc } from './data.js';
import { waterOptions, initReportForm } from './report.js';
import { distanceKm, lengthKm, formatLatLon } from './geo.js';
import { RODZAJE, RODZAJ_NAZWA } from './zbiorniki-typ.js';
import {
  createFilters,
  passesFilters,
  obwodyList,
  extraFiltersActive,
  resetExtraFilters,
  PROMIENIE_KM,
} from './filtry.js';
import { nadajId, idZHasha, hashDlaId } from './link.js';
import { adresNawigacji, aplikacjeNaUrzadzeniu, zapamietana, zapamietaj } from './nawigacja.js';
import { initArkusz } from './arkusz.js';
import { dodajLegende, stylZbiornika, komunikat } from './legenda.js';
import { wczytajUlubione, przelaczUlubione, uporzadkujUlubione, gwiazdka } from './ulubione.js';
import { utworzPogode, pogodaHtml } from './pogoda.js';
import { initInstalacja } from './instalacja.js';

const $ = (id) => document.getElementById(id);

const COLORS = { zb: '#1565c0', niz: '#0288d1', gor: '#2e7d32', gr: '#616161' };
const APLIKACJE = aplikacjeNaUrzadzeniu(LINKS.navigation, navigator.userAgent);
const POGODA_ZRODLO = 'https://open-meteo.com/';
/** Ulubione łowiska (gwiazdka) — wspólny zbiór dla listy, popupów i filtra. */
const ULUBIONE = wczytajUlubione();
const pogoda = utworzPogode({ url: POGODA.url, waznoscMin: POGODA.waznoscMin });

function applyLinks() {
  document.querySelectorAll('a[data-link]').forEach((a) => {
    const href = LINKS[a.dataset.link];
    if (href) a.href = href;
  });
}

function initInfoModal() {
  const modal = $('infomodal');
  $('infobtn').onclick = () => {
    zamknijMenu();
    modal.style.display = 'flex';
  };
  modal.addEventListener('click', (ev) => {
    if (ev.target === modal || ev.target.closest('[data-close]')) modal.style.display = 'none';
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') modal.style.display = 'none';
  });
}

/** Menu nagłówka: na telefonie linki są schowane pod ☰, na komputerze widoczne w pasku. */
function zamknijMenu() {
  $('menu').classList.remove('open');
  $('menubtn').setAttribute('aria-expanded', 'false');
}
function initMenu() {
  $('menubtn').addEventListener('click', () => {
    const open = $('menu').classList.toggle('open');
    $('menubtn').setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (ev) => {
    if (!ev.target.closest('#menu, #menubtn')) zamknijMenu();
  });
}

/** Link „Nawiguj”: od razu do zapamiętanej aplikacji albo wybór aplikacji przy pierwszym użyciu. */
function nawigacjaHtml(position, title) {
  const wybrana = zapamietana(APLIKACJE);
  if (!wybrana) return '<a href="#" data-nav-wybor>🧭 Nawiguj</a>';
  return (
    `<a target="_blank" rel="noopener noreferrer" href="${esc(adresNawigacji(wybrana, position, title))}">🧭 Nawiguj</a>` +
    ` <a href="#" class="drobny" data-nav-wybor title="Zmień aplikację do nawigacji">(${esc(wybrana.nazwa)})</a>`
  );
}

function wyborAplikacjiHtml(position, title) {
  return (
    '<div class="nav-wybor"><span>Nawiguj w:</span>' +
    APLIKACJE.map(
      (a) =>
        `<a target="_blank" rel="noopener noreferrer" data-app="${esc(a.id)}" href="${esc(adresNawigacji(a, position, title))}">${esc(a.nazwa)}</a>`
    ).join('') +
    '</div>'
  );
}

/** Przycisk gwiazdki (lista i popup); stan czytany z ULUBIONE w chwili rysowania. */
function gwiazdkaHtml(e) {
  const on = ULUBIONE.has(e.id);
  return (
    `<button type="button" class="gw${on ? ' on' : ''}" data-gw="${esc(e.id)}" aria-pressed="${on}"` +
    ` title="${on ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}" aria-label="${on ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}">${gwiazdka(on)}</button>`
  );
}

/** Współrzędne punktu (dla rzeki — środka odcinka) z kopiowaniem do schowka, np. do nawigacji GPS. */
function wspolrzedneHtml(e) {
  const [lat, lon] = e.latlng;
  const wsp = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  return (
    `<div class="wsp">📌 <span>${esc(formatLatLon(e.latlng))}</span>` +
    ` <a href="#" class="drobny" data-copy="${esc(wsp)}" title="Skopiuj współrzędne">kopiuj</a></div>`
  );
}

function popupHtml(e) {
  const { title, tag, tagColor, body, rules, approx, nokill } = e.popup;
  // Gwiazdka przed nagłówkiem (float), żeby tekst <h3> był samą nazwą (czytniki ekranu, testy).
  let html = `${e.f === 'gr' ? '' : gwiazdkaHtml(e)}<h3>${esc(title)}</h3>`;
  html += `<span class="tag" style="background:${tagColor}">${esc(tag)}</span>`;
  if (nokill) html += '<span class="tag nk">NO-KILL</span>';
  if (approx) html += '<div class="approx">⚠ lokalizacja przybliżona</div>';
  if (body) html += `<div>${esc(body)}</div>`;
  if (rules) html += `<div class="rules"><b>Zasady:</b> ${esc(rules)}</div>`;
  html += wspolrzedneHtml(e);
  if (e.f === 'gr') return html;
  if (pogoda.wlaczona) html += `<div class="pogoda-slot" data-pogoda="${esc(e.id)}"></div>`;
  return (
    html +
    `<div class="akcje" data-akcje="${esc(e.id)}">${nawigacjaHtml(e.latlng, title)}` +
    ` · <a href="#" data-share="${esc(e.id)}">🔗 Udostępnij</a>` +
    ` · <a href="#" data-report="${esc(e.reportKey)}">✉️ Zgłoś uwagę</a></div>`
  );
}

/** Przelicza rozmiar i położenie popupu po zmianie treści i dosuwa mapę, żeby popup był w całości
 *  widoczny (Leaflet robi to sam tylko przy otwarciu; update() generowałby treść od nowa i gubił stan).
 *  W trakcie animacji zoomu (fitBounds po wyborze rzeki z listy) dosunięcie zostałoby nadpisane,
 *  więc jest powtarzane po jej zakończeniu. */
function odswiezPopup(popup) {
  const przelicz = () => {
    if (!popup._map) return;
    for (const krok of ['_updateLayout', '_updatePosition', '_adjustPan']) {
      if (typeof popup[krok] === 'function') popup[krok]();
    }
  };
  przelicz();
  const map = popup._map;
  if (map && map._animatingZoom) map.once('zoomend', przelicz);
}

/** Dociąga pogodę do otwartego popupu łowiska; gdy serwis nie odpowie, miejsce po prostu znika. */
async function wstawPogode(e) {
  const popup = e.target.getPopup();
  const slot = popup && popup.getElement() && popup.getElement().querySelector('[data-pogoda]');
  if (!slot) return;
  slot.innerHTML = '<span class="drobny">🌤 pogoda nad wodą…</span>';
  const p = await pogoda.pobierz(e.id, e.latlng);
  const aktualny = popup.getElement() && popup.getElement().querySelector('[data-pogoda]');
  if (!aktualny || aktualny !== slot) return;
  slot.innerHTML = p ? pogodaHtml(p, POGODA_ZRODLO) : '';
  if (!p) slot.remove();
  odswiezPopup(popup);
}

const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');

/** Ustawia widok tak, by punkt był na środku części mapy widocznej nad panelem listy (telefon). */
function centruj(map, arkusz, latlng, zoom) {
  map.setView(latlng, zoom, { animate: false });
  if (arkusz.mobile()) map.panBy([0, arkusz.wysokosc() / 2], { animate: false });
}

/** Wpisy (lista + obiekty na mapie) z danych; obiekty trafiają do grup warstw przez filtry.
 *  `dolPx` — wysokość panelu zasłaniającego dół mapy na telefonie: popup jest dosuwany nad niego. */
function buildEntries(data, layers, dolPx = 0) {
  const entries = [];

  data.zb.forEach((z, i) => {
    const marker = L.circleMarker(z.p, stylZbiornika(COLORS.zb, { przyblizona: !!z.a, nokill: !!z.nk }));
    const tag =
      (z.t || RODZAJ_NAZWA[z.k]) + (z.ha !== '—' ? ` · ${z.ha} ha` : '') + (z.o ? ` · obwód ${z.o}` : '');
    entries.push({
      f: 'zb',
      kind: z.k,
      nokill: !!z.nk,
      approx: !!z.a,
      obwod: z.o || '',
      name: z.n,
      sub: `${z.t} · ${z.ha} ha${z.o ? ' · ' + z.o : ''}`,
      latlng: z.p,
      target: marker,
      layer: layers.zb,
      zoom: ZOOM.zbiornik,
      reportKey: `zb:${i}`,
      popup: { title: z.n, tag, tagColor: COLORS.zb, rules: z.r, approx: z.a, nokill: z.nk },
    });
  });

  const nameCount = {};
  data.rivers.forEach((r) => {
    nameCount[r.n] = (nameCount[r.n] || 0) + 1;
  });
  const nameSeen = {};
  data.rivers.forEach((r, i) => {
    const kind = r.c === 'gor' ? 'gor' : 'niz';
    const line = L.polyline(r.pts, { color: COLORS[kind], weight: kind === 'gor' ? 3 : 4, opacity: 0.85 });
    const mid = r.pts[Math.floor(r.pts.length / 2)];
    const dlugoscKm = lengthKm(r.pts);
    let label = r.n;
    if (nameCount[r.n] > 1) {
      nameSeen[r.n] = (nameSeen[r.n] || 0) + 1;
      label = `${r.n} (odcinek ${nameSeen[r.n]})`;
    }
    entries.push({
      f: kind,
      obwod: r.o || '',
      name: label,
      baseName: r.n,
      sub: r.d.slice(0, 70) + '…',
      latlng: mid,
      target: line,
      layer: layers[kind],
      zoom: ZOOM.okolica,
      reportKey: `rzeka:${i}`,
      popup: {
        title: r.n,
        tag:
          (kind === 'gor' ? 'kraina pstrąga i lipienia' : 'obwód ' + r.o) +
          (dlugoscKm >= 0.5
            ? ` · ok. ${dlugoscKm.toFixed(dlugoscKm < 10 ? 1 : 0).replace('.', ',')} km`
            : ''),
        tagColor: COLORS[kind],
        body: r.d,
        rules: r.r,
      },
    });
  });

  data.granice.forEach((g) => {
    const marker = L.circleMarker(g.p, {
      radius: 5,
      color: '#fff',
      weight: 1.5,
      fillColor: COLORS.gr,
      fillOpacity: 0.95,
    });
    entries.push({
      f: 'gr',
      name: g.n,
      sub: g.d.slice(0, 60) + '…',
      latlng: g.p,
      target: marker,
      layer: layers.gr,
      zoom: ZOOM.granica,
      popup: { title: g.n, tag: 'granica obwodu', tagColor: COLORS.gr, body: g.d },
    });
  });

  nadajId(entries);
  // Szerokość popupu dopasowana do wąskich telefonów (np. 320 px), żeby × i treść się mieściły.
  const maxWidth = Math.max(200, Math.min(280, window.innerWidth - 90));
  const opcje = { maxWidth, autoPanPaddingBottomRight: [5, dolPx + 8] };
  for (const e of entries) e.target.bindPopup(() => popupHtml(e), opcje);
  return entries;
}

/** „📍 Najbliżej mnie”: bieżące położenie (kropka + okrąg dokładności), śledzone, gdy strona jest widoczna. */
function initLokalizacja(map, arkusz, onPozycja) {
  const opcje = { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 };
  let watchId = null;
  let marker = null;
  let krag = null;
  let ostatnia = null;
  let btn;

  function zatrzymaj() {
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  function sledz() {
    if (watchId == null && document.visibilityState === 'visible') {
      watchId = navigator.geolocation.watchPosition(
        (p) => pozycja(p, false),
        () => {},
        opcje
      );
    }
  }
  function blad(err) {
    btn.classList.remove('aktywny');
    zatrzymaj();
    komunikat(
      err && err.code === 1
        ? 'Brak zgody na lokalizację — zezwól na nią w ustawieniach przeglądarki dla tej strony.'
        : 'Nie udało się ustalić położenia. Włącz lokalizację (GPS) w telefonie i spróbuj ponownie.'
    );
  }
  function pozycja(p, wycentruj) {
    const ll = L.latLng(p.coords.latitude, p.coords.longitude);
    const dokladnosc = Math.min(p.coords.accuracy || 0, 5000);
    if (!marker) {
      krag = L.circle(ll, {
        radius: dokladnosc,
        color: '#e53935',
        weight: 1,
        fillOpacity: 0.08,
        interactive: false,
      }).addTo(map);
      marker = L.circleMarker(ll, {
        radius: 8,
        fillColor: '#e53935',
        color: '#fff',
        weight: 2,
        fillOpacity: 1,
      })
        .addTo(map)
        .bindPopup('Tu jesteś');
    } else {
      marker.setLatLng(ll);
      krag.setLatLng(ll).setRadius(dokladnosc);
    }
    // Lista sortowana ponownie dopiero po przesunięciu o ponad 200 m.
    if (!ostatnia || distanceKm([ostatnia.lat, ostatnia.lng], [ll.lat, ll.lng]) > 0.2) {
      ostatnia = ll;
      onPozycja([ll.lat, ll.lng]);
    }
    if (!wycentruj) return;
    if (maxBounds().contains(ll)) centruj(map, arkusz, ll, Math.max(map.getZoom(), ZOOM.okolica));
    else komunikat('Jesteś poza obszarem Okręgu — lista pokazuje łowiska od najbliższego.');
  }
  function start() {
    if (!('geolocation' in navigator)) {
      komunikat('Ta przeglądarka nie udostępnia lokalizacji.');
      return;
    }
    btn.classList.add('aktywny');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        pozycja(p, true);
        sledz();
      },
      blad,
      opcje
    );
  }

  const control = L.control({ position: 'topleft' });
  control.onAdd = () => {
    btn = L.DomUtil.create('button', 'pzw-loc leaflet-bar');
    btn.id = 'locbtn';
    btn.type = 'button';
    btn.title = 'Pokaż moje położenie i najbliższe łowiska';
    btn.innerHTML = '📍<span> Najbliżej mnie</span>';
    L.DomEvent.disableClickPropagation(btn);
    btn.addEventListener('click', start);
    return btn;
  };
  control.addTo(map);
  document.addEventListener('visibilitychange', () => {
    if (!marker) return;
    if (document.visibilityState === 'hidden') zatrzymaj();
    else sledz();
  });
}

function initUi(map, layers, arkusz) {
  const filters = createFilters();
  filters.ulubione = ULUBIONE;
  const { active } = filters;
  const listEl = $('list');
  const countEl = $('count');
  const searchEl = $('search');
  const obwodEl = $('obwod');
  let entries = [];
  let byId = new Map();
  let userPos = null;
  let stanDanych = '';

  /** Odległości od użytkownika dla wszystkich wpisów (filtr promienia i sortowanie listy). */
  function przeliczOdleglosci() {
    entries.forEach((e) => {
      e.km = userPos ? distanceKm(userPos, e.latlng) : undefined;
    });
  }

  function render() {
    const q = normalize(searchEl.value.trim());
    const items = entries.filter(
      (e) => passesFilters(e, filters) && (!q || normalize(e.name + ' ' + e.sub).includes(q))
    );
    if (userPos) items.sort((a, b) => a.km - b.km);
    countEl.textContent =
      items.length +
      ' pozycji' +
      (filters.tylkoUlubione ? ' · ulubione' : '') +
      (userPos
        ? (filters.promienKm ? ` · do ${filters.promienKm} km` : '') + ' · posortowano wg odległości'
        : '') +
      (stanDanych ? ' · Dane: ' + stanDanych : '');
    $('ulubionebtn').textContent = `★ Ulubione${ULUBIONE.size ? ` (${ULUBIONE.size})` : ''}`;
    if (!items.length && filters.tylkoUlubione) {
      listEl.innerHTML =
        '<div class="pusto">Brak ulubionych łowisk. Stuknij ☆ przy nazwie łowiska (na liście albo w okienku na mapie), ' +
        'aby mieć je pod ręką — lista jest zapamiętana w tej przeglądarce.</div>';
      return;
    }
    listEl.innerHTML = items
      .map(
        (e) =>
          `<div class="item" data-id="${esc(e.id)}"><span class="dot" style="background:${COLORS[e.f]}"></span><b>${esc(e.name)}</b>` +
          (e.nokill ? '<span class="nk">NO-KILL</span>' : '') +
          (e.km !== undefined
            ? ` <span style="color:#0d3b66;font-size:12px">· ${e.km.toFixed(1)} km</span>`
            : '') +
          (e.f === 'gr' ? '' : gwiazdkaHtml(e)) +
          `<div class="meta">${e.approx ? '≈ położenie przybliżone · ' : ''}${esc(e.sub)}</div></div>`
      )
      .join('');
  }

  /** Zmiana stanu gwiazdki (lista i popup) — przy filtrze „Ulubione” lista i mapa od razu się odświeżają. */
  function przelaczGwiazdke(id) {
    const e = byId.get(id);
    if (!e) return;
    const on = przelaczUlubione(ULUBIONE, id);
    komunikat(
      on ? `★ ${e.popup.title} — dodano do ulubionych.` : `☆ ${e.popup.title} — usunięto z ulubionych.`,
      2500
    );
    document.querySelectorAll(`[data-gw="${CSS.escape(id)}"]`).forEach((b) => {
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
      b.textContent = gwiazdka(on);
      b.title = on ? 'Usuń z ulubionych' : 'Dodaj do ulubionych';
      b.setAttribute('aria-label', b.title);
    });
    if (filters.tylkoUlubione) applyFilters();
    else render();
  }

  /** Dodaje do mapy obiekty przechodzące filtry, zdejmuje pozostałe; potem odświeża listę. */
  function applyFilters() {
    entries.forEach((e) => {
      const show = passesFilters(e, filters);
      if (show && !e.layer.hasLayer(e.target)) e.layer.addLayer(e.target);
      else if (!show && e.layer.hasLayer(e.target)) e.layer.removeLayer(e.target);
    });
    $('morebtn').classList.toggle('active', extraFiltersActive(filters));
    render();
  }

  /** Pokazuje łowisko na mapie z otwartym popupem (odsłania je, jeśli filtry je ukrywają). */
  function pokaz(e) {
    if (!passesFilters(e, filters)) {
      if (!active.has(e.f)) document.querySelector(`.chip[data-f="${e.f}"]`).click();
      if (filters.tylkoUlubione && !ULUBIONE.has(e.id)) $('ulubionebtn').click();
      if (!passesFilters(e, filters)) $('resetbtn').click();
    }
    if (arkusz.mobile()) arkusz.ustaw('peek');
    if (e.target.getBounds) {
      map.fitBounds(e.target.getBounds(), {
        maxZoom: ZOOM.okolica,
        paddingBottomRight: [0, arkusz.wysokosc()],
      });
    } else centruj(map, arkusz, e.latlng, e.zoom);
    e.target.openPopup();
  }

  function otworzZHasha() {
    const id = idZHasha(location.hash);
    const e = id && byId.get(id);
    if (e) pokaz(e);
  }

  listEl.addEventListener('click', (ev) => {
    const gw = ev.target.closest('button[data-gw]');
    if (gw) {
      przelaczGwiazdke(gw.dataset.gw);
      return;
    }
    const item = ev.target.closest('.item');
    const e = item && byId.get(item.dataset.id);
    if (e) pokaz(e);
  });

  // Gwiazdka w popupie (faza przechwytywania — Leaflet zatrzymuje kliknięcia w popupie).
  document.addEventListener(
    'click',
    (ev) => {
      const gw = ev.target.closest('.leaflet-popup button[data-gw]');
      if (!gw) return;
      ev.preventDefault();
      ev.stopPropagation();
      przelaczGwiazdke(gw.dataset.gw);
    },
    true
  );

  // Adres strony wskazuje otwarte łowisko — można go skopiować albo udostępnić.
  map.on('popupopen', (ev) => {
    const e = entries.find((x) => x.target === ev.popup._source);
    if (!e) return;
    if (e.f !== 'gr') history.replaceState(null, '', hashDlaId(e.id));
    if (arkusz.mobile()) arkusz.ustaw('peek');
    if (e.f !== 'gr' && pogoda.wlaczona) wstawPogode(e);
  });
  // Na telefonie przyciski mapy zasłaniałyby popup — chowane, dopóki popup jest otwarty.
  map.on('popupopen', () => map.getContainer().classList.add('popup-otwarty'));
  map.on('popupclose', () => map.getContainer().classList.remove('popup-otwarty'));
  map.on('popupclose', () => {
    if (idZHasha(location.hash)) history.replaceState(null, '', location.pathname + location.search);
  });
  window.addEventListener('hashchange', otworzZHasha);

  const toggleSet = (set, key, chip) => {
    if (set.has(key)) {
      set.delete(key);
      chip.classList.remove('on');
    } else {
      set.add(key);
      chip.classList.add('on');
    }
  };

  document.querySelectorAll('.chip[data-f]').forEach((chip) =>
    chip.addEventListener('click', () => {
      toggleSet(active, chip.dataset.f, chip);
      applyFilters();
    })
  );

  // Rodzaje zbiorników + NO-KILL.
  const kindsEl = $('kinds');
  kindsEl.innerHTML =
    Object.entries(RODZAJE)
      .map(([k, label]) => `<span class="chip on" data-k="${k}">${esc(label)}</span>`)
      .join('') + '<span class="chip" data-nk>tylko NO-KILL</span>';
  kindsEl.querySelectorAll('.chip[data-k]').forEach((chip) =>
    chip.addEventListener('click', () => {
      toggleSet(filters.kinds, chip.dataset.k, chip);
      applyFilters();
    })
  );
  kindsEl.querySelector('.chip[data-nk]').addEventListener('click', (ev) => {
    filters.nokillOnly = !filters.nokillOnly;
    ev.currentTarget.classList.toggle('on', filters.nokillOnly);
    applyFilters();
  });

  obwodEl.addEventListener('change', () => {
    filters.obwod = obwodEl.value;
    applyFilters();
  });

  // „★ Ulubione” — filtr w głównym rzędzie, działa we wszystkich warstwach.
  $('ulubionebtn').addEventListener('click', (ev) => {
    filters.tylkoUlubione = !filters.tylkoUlubione;
    ev.currentTarget.classList.toggle('on', filters.tylkoUlubione);
    ev.currentTarget.setAttribute('aria-pressed', String(filters.tylkoUlubione));
    applyFilters();
  });

  // „W promieniu” — pojawia się po ustaleniu położenia („Najbliżej mnie”).
  const promienEl = $('promien');
  promienEl.innerHTML = PROMIENIE_KM.map((km) => `<span class="chip" data-km="${km}">${km} km</span>`).join(
    ''
  );
  function ustawPromien(km) {
    filters.promienKm = km;
    promienEl
      .querySelectorAll('.chip[data-km]')
      .forEach((c) => c.classList.toggle('on', Number(c.dataset.km) === km));
  }
  promienEl.addEventListener('click', (ev) => {
    const chip = ev.target.closest('.chip[data-km]');
    if (!chip) return;
    const km = Number(chip.dataset.km);
    ustawPromien(filters.promienKm === km ? 0 : km);
    applyFilters();
  });

  $('resetbtn').addEventListener('click', () => {
    resetExtraFilters(filters);
    obwodEl.value = '';
    kindsEl.querySelectorAll('.chip[data-k]').forEach((c) => c.classList.add('on'));
    kindsEl.querySelector('.chip[data-nk]').classList.remove('on');
    ustawPromien(0);
    applyFilters();
  });

  $('morebtn').addEventListener('click', () => {
    const more = $('more');
    more.hidden = !more.hidden;
    $('morebtn').setAttribute('aria-expanded', String(!more.hidden));
    $('morebtn').textContent = more.hidden ? 'Więcej filtrów ▾' : 'Mniej filtrów ▴';
  });

  searchEl.addEventListener('input', render);
  searchEl.addEventListener('focus', () => {
    if (arkusz.mobile() && arkusz.stan() === 'peek') arkusz.ustaw('half');
  });

  initLokalizacja(map, arkusz, (pos) => {
    userPos = pos;
    przeliczOdleglosci();
    $('promien-row').hidden = false;
    if (arkusz.mobile() && arkusz.stan() === 'peek') arkusz.ustaw('half');
    applyFilters();
  });

  /** Podmienia dane (pierwsze wczytanie albo odświeżenie z bazy) z zachowaniem filtrów i otwartego łowiska.
   *  Przy odświeżeniu widok mapy się nie zmienia — otwarty popup jest tylko otwierany ponownie. */
  function ustawDane(data, { odswiezenie = false } = {}) {
    const otwarte = idZHasha(location.hash);
    const bylOtwarty = odswiezenie && !!map._popup && map.hasLayer(map._popup);
    Object.values(layers).forEach((g) => g.clearLayers());
    // Na telefonie popup otwiera się nad panelem w stanie „peek” (popupopen go tak ustawia).
    entries = buildEntries(data, layers, arkusz.mobile() ? arkusz.wysokoscStanu('peek') : 0);
    byId = new Map(entries.map((e) => [e.id, e]));
    przeliczOdleglosci();
    uporzadkujUlubione(ULUBIONE, byId);
    const wybrany = obwodEl.value;
    obwodEl.length = 1;
    obwodyList(entries).forEach((o) => obwodEl.appendChild(new Option(o, o)));
    obwodEl.value = obwodyList(entries).includes(wybrany) ? wybrany : '';
    filters.obwod = obwodEl.value;
    applyFilters();
    if (!otwarte || !byId.has(otwarte)) return;
    if (!odswiezenie) pokaz(byId.get(otwarte));
    else if (bylOtwarty) byId.get(otwarte).target.openPopup();
  }

  function ustawStanDanych(tekst) {
    if (stanDanych) map.attributionControl.removeAttribution('Dane: ' + stanDanych);
    stanDanych = tekst;
    if (tekst) map.attributionControl.addAttribution('Dane: ' + tekst);
    $('stan-danych').textContent =
      tekst === 'na bieżąco'
        ? 'Dane na bieżąco z bazy Okręgu.'
        : 'Stan danych: ' + tekst + ' (kopia zapasowa).';
    render();
  }

  return { ustawDane, ustawStanDanych, byId: () => byId };
}

/** Udostępnianie linku do łowiska: menu udostępniania telefonu albo kopia do schowka. */
async function udostepnij(e) {
  const url = SITE.url + hashDlaId(e.id);
  if (navigator.share) {
    try {
      await navigator.share({
        title: e.popup.title,
        text: `${e.popup.title} — mapa wód PZW Okręg Rzeszów`,
        url,
      });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }
  skopiuj(url, 'Link do łowiska skopiowany — wklej go w wiadomości.', 'Link do łowiska: ' + url);
}

/** Kopia do schowka z komunikatem; bez dostępu do schowka tekst jest pokazywany do przepisania. */
async function skopiuj(tekst, gotowe, zapas = tekst) {
  try {
    await navigator.clipboard.writeText(tekst);
    komunikat(gotowe);
  } catch {
    komunikat(zapas, 15000);
  }
}

/** Kliknięcia w popupie (nawigacja, udostępnianie). Faza przechwytywania: Leaflet zatrzymuje
 *  propagację kliknięć w popupie w fazie bąbelkowania. */
function initAkcjePopupu(ui) {
  document.addEventListener(
    'click',
    (ev) => {
      const app = ev.target.closest('a[data-app]');
      if (app) {
        zapamietaj(app.dataset.app);
        return;
      }
      const kopiuj = ev.target.closest('a[data-copy]');
      if (kopiuj) {
        ev.preventDefault();
        skopiuj(kopiuj.dataset.copy, 'Współrzędne skopiowane: ' + kopiuj.dataset.copy);
        return;
      }
      const wybor = ev.target.closest('a[data-nav-wybor]');
      const share = ev.target.closest('a[data-share]');
      if (!wybor && !share) return;
      ev.preventDefault();
      const akcje = ev.target.closest('[data-akcje]');
      const e = akcje && ui.byId().get(akcje.dataset.akcje);
      if (!e) return;
      if (share) {
        udostepnij(e);
        return;
      }
      if (!akcje.nextElementSibling || !akcje.nextElementSibling.classList.contains('nav-wybor')) {
        akcje.insertAdjacentHTML('afterend', wyborAplikacjiHtml(e.latlng, e.popup.title));
        odswiezPopup(e.target.getPopup()); // popup urósł w górę
      }
    },
    true
  );
}

function initMap() {
  const map = L.map('map', {
    crs,
    minZoom: ZOOM.min,
    maxZoom: ZOOM.max,
    maxBounds: maxBounds(),
    maxBoundsViscosity: MAX_BOUNDS_VISCOSITY,
    // Canvas zamiast SVG: tysiące wierzchołków rzek rysują się płynnie także na słabych telefonach;
    // tolerancja ułatwia trafienie palcem w cienką linię rzeki.
    renderer: L.canvas({ padding: 0.5, tolerance: 8 }),
  }).setView(CENTER, ZOOM.okreg);
  map.attributionControl.setPrefix(
    `<a href="${LINKS.leaflet}" target="_blank" rel="noopener noreferrer">Leaflet</a>`
  );
  initBasemaps(map, BASEMAPS.default.public);
  dodajLegende(map, COLORS);
  const layers = {
    zb: L.layerGroup().addTo(map),
    niz: L.layerGroup().addTo(map),
    gor: L.layerGroup().addTo(map),
    gr: L.layerGroup().addTo(map),
  };
  return { map, layers };
}

/** Service worker z pamięcią podręczną kafli i plików strony (public/sw.js). Rejestracja po
 *  wczytaniu strony, żeby nie konkurować z pobieraniem danych; brak wsparcia niczego nie zmienia. */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const base = import.meta.env.BASE_URL;
  const register = () => navigator.serviceWorker.register(base + 'sw.js', { scope: base }).catch(() => {});
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

/** Wysyła zgłoszenie do funkcji Supabase; odpowiedź funkcji (także błędną) zwraca bez zmian. */
async function sendReport(report) {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'siec' };
  const { data, error } = await sb.functions.invoke(LINKS.report.function, { body: report });
  if (!error) return data;
  try {
    return await error.context.json();
  } catch {
    return { ok: false, error: 'siec' };
  }
}

/** Formularz zgłoszeń otwierany z popupu łowiska i z okna „O mapie”. */
function initReporting(data) {
  const form = initReportForm({
    options: waterOptions(data),
    send: sendReport,
    issuesUrl: LINKS.report.issues,
    mapUrl: SITE.url,
  });
  document.addEventListener(
    'click',
    (ev) => {
      const link = ev.target.closest('a[data-report]');
      if (!link) return;
      ev.preventDefault();
      $('infomodal').style.display = 'none';
      form.open(link.dataset.report);
    },
    true
  );
  return form;
}

/** Najpierw snapshot opublikowany ze stroną (mapa od razu), potem baza w tle — gdy różni się
 *  od snapshotu, lista i mapa są odświeżane. Bez snapshotu mapa czeka na bazę. */
async function main() {
  applyLinks();
  initMenu();
  initInfoModal();
  initInstalacja($('installbtn'), { komunikat });
  const baza = loadFromSupabase();
  const { map, layers } = initMap();
  const arkusz = initArkusz($('side'), $('uchwyt'));
  const ui = initUi(map, layers, arkusz);
  initAkcjePopupu(ui);

  let snapshot = null;
  try {
    snapshot = await loadSnapshot();
  } catch (err) {
    const { data, zBazy } = polaczDane({ zb: [], rivers: [], granice: [] }, await baza);
    if (!zBazy) {
      $('count').textContent = 'Nie udało się wczytać danych (' + err.message + ').';
      return;
    }
    ui.ustawDane(data);
    ui.ustawStanDanych('na bieżąco');
    initReporting(data);
    return;
  }

  ui.ustawDane(snapshot);
  ui.ustawStanDanych(snapshot.meta && snapshot.meta.snapshot ? snapshot.meta.snapshot.slice(0, 10) : '');
  const form = initReporting(snapshot);

  const { data, zmienione, zBazy } = polaczDane(snapshot, await baza);
  if (zmienione) {
    ui.ustawDane(data, { odswiezenie: true });
    form.ustawWody(waterOptions(data));
  }
  if (zBazy) ui.ustawStanDanych('na bieżąco');
}

registerServiceWorker();
main();
