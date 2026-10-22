/* Ulubione (gwiazdka), współrzędne i pogoda w popupie, filtr „W promieniu”, manifest aplikacji. */
import { test, expect } from '@playwright/test';
import {
  CONFIG,
  daneStrony,
  domyslnieNaLiscie,
  kliknijWLiscie,
  liczbaPozycji,
  otworzMape,
  rozwinPanel,
  tylkoSnapshot,
} from './pomocnicze.mjs';

const RZESZOW = { latitude: 50.0413, longitude: 21.999 };
/** Odpowiedź Open-Meteo podmieniona w testach — deterministyczna treść i brak zależności od serwisu. */
const POGODA = {
  current: {
    time: '2026-10-22T07:45',
    temperature_2m: 8.4,
    apparent_temperature: 5.1,
    precipitation: 0.3,
    weather_code: 61,
    wind_speed_10m: 14.2,
    wind_gusts_10m: 31,
    wind_direction_10m: 312,
    surface_pressure: 1004.6,
    cloud_cover: 90,
  },
  hourly: { time: ['2026-10-22T04:00'], surface_pressure: [1007.1] },
  daily: { time: ['2026-10-22'], sunrise: ['2026-10-22T07:05'], sunset: ['2026-10-22T17:34'] },
};

// Pogoda jest podmieniana przez page.route — bez service workera, bo w WebKit żądania strony
// kontrolowanej przez service worker omijają page.route.
test.use({ serviceWorkers: 'block' });

let dane;
test.beforeEach(async ({ page, request, baseURL }) => {
  dane = await daneStrony(request, baseURL);
  await tylkoSnapshot(page);
  if (CONFIG.pogoda && CONFIG.pogoda.url) {
    await page.route(`${new URL(CONFIG.pogoda.url).origin}/**`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(POGODA) })
    );
  }
  await otworzMape(page);
  await rozwinPanel(page);
});

test('gwiazdka na liście i w popupie, filtr „Ulubione”, zapis w przeglądarce', async ({ page }) => {
  const wszystkie = domyslnieNaLiscie(dane);
  const chip = page.locator('#ulubionebtn');
  await expect(chip).toHaveText('★ Ulubione');
  await expect(page.locator('#list .item .gw')).toHaveCount(wszystkie);

  const pierwsza = page.locator('#list .item').first();
  const nazwa = (await pierwsza.locator('b').textContent()).trim();
  await pierwsza.locator('.gw').click();
  await expect(pierwsza.locator('.gw')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.leaflet-popup')).toHaveCount(0); // gwiazdka nie otwiera popupu
  await expect(chip).toHaveText('★ Ulubione (1)');
  await expect(page.locator('#komunikat')).toContainText('dodano do ulubionych');
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('pzw-ulubione')))).toHaveLength(1);

  await chip.click();
  await expect.poll(() => liczbaPozycji(page)).toBe(1);
  await expect(page.locator('#count')).toContainText('ulubione');
  await expect(page.locator('#list .item b')).toHaveText(nazwa);
  await chip.click();
  await expect.poll(() => liczbaPozycji(page)).toBe(wszystkie);

  // Odznaczenie z popupu synchronizuje listę; pusty filtr pokazuje podpowiedź.
  await kliknijWLiscie(page, pierwsza);
  const popup = page.locator('.leaflet-popup');
  await expect(popup.locator('.gw')).toHaveAttribute('aria-pressed', 'true');
  await popup.locator('.gw').click();
  await expect(popup).toBeVisible();
  await expect(chip).toHaveText('★ Ulubione');
  await expect(page.locator('#list .item').first().locator('.gw')).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => localStorage.getItem('pzw-ulubione'))).toBeNull();
  await popup.locator('.leaflet-popup-close-button').click();
  await expect(page.locator('.leaflet-popup')).toHaveCount(0);
  await chip.click();
  await expect(page.locator('#list .pusto')).toContainText('Brak ulubionych');
  await chip.click();
});

test('ulubione przeżywają przeładowanie strony', async ({ page }) => {
  await page.locator('#list .item').first().locator('.gw').click();
  await expect(page.locator('#ulubionebtn')).toHaveText('★ Ulubione (1)');
  await page.reload();
  await expect(page.locator('#list .item').first()).toBeVisible();
  await expect(page.locator('#ulubionebtn')).toHaveText('★ Ulubione (1)');
  await rozwinPanel(page);
  await page.locator('#list .item').first().locator('.gw').click();
  await expect(page.locator('#ulubionebtn')).toHaveText('★ Ulubione');
});

test('popup: współrzędne z kopiowaniem, długość odcinka rzeki, pogoda nad wodą z podpisem źródła', async ({
  page,
}) => {
  test.skip(!CONFIG.pogoda || !CONFIG.pogoda.url, 'pogoda wyłączona w config.json');
  await kliknijWLiscie(page);
  const popup = page.locator('.leaflet-popup');
  await expect(popup.locator('.wsp')).toHaveText(/\d+\.\d{5} N, \d+\.\d{5} E/);
  await expect(popup.locator('.pogoda')).toContainText('Pogoda nad wodą');
  await expect(popup.locator('.pogoda')).toContainText('8°C (odczuwalna 5°), słaby deszcz');
  await expect(popup.locator('.pogoda')).toContainText('wiatr 14 km/h NW, porywy do 31');
  await expect(popup.locator('.pogoda')).toContainText('1005 hPa ↘ spada');
  await expect(popup.locator('.pogoda')).toContainText('7:05 – 🌇 17:34');
  await expect(popup.locator('.pogoda a')).toHaveAttribute('href', /open-meteo/);
  // Popup z pogodą mieści się w całości w oknie mapy (dosunięcie po dociągnięciu treści).
  const ramka = await popup.boundingBox();
  const mapa = await page.locator('#map').boundingBox();
  expect(ramka.y).toBeGreaterThanOrEqual(mapa.y - 1);
  await popup.locator('.leaflet-popup-close-button').click();
  await expect(popup).toHaveCount(0); // zamykany popup znika z animacją — dopiero potem kolejny

  await page.locator('#search').fill(dane.rivers[0].n);
  await kliknijWLiscie(page, page.locator('#list .item').first());
  await expect(page.locator('.leaflet-popup .tag').first()).toHaveText(/ok\. \d+(,\d)? km/);
});

test('bez pogody, gdy serwis nie odpowiada — popup działa jak dotąd', async ({ page }) => {
  test.skip(!CONFIG.pogoda || !CONFIG.pogoda.url, 'pogoda wyłączona w config.json');
  await page.unroute(`${new URL(CONFIG.pogoda.url).origin}/**`);
  await page.route(`${new URL(CONFIG.pogoda.url).origin}/**`, (route) => route.abort('connectionrefused'));
  await kliknijWLiscie(page);
  const popup = page.locator('.leaflet-popup');
  await expect(popup.locator('.akcje')).toContainText('Nawiguj');
  await expect(popup.locator('.pogoda')).toHaveCount(0);
  await expect(popup.locator('[data-pogoda]')).toHaveCount(0);
});

test('manifest aplikacji i ikony są opublikowane', async ({ request, baseURL }) => {
  const manifest = await request.get(new URL('manifest.webmanifest', baseURL).href);
  expect(manifest.ok()).toBeTruthy();
  const m = await manifest.json();
  expect(m.short_name).toBe('Wody PZW');
  expect(m.display).toBe('standalone');
  for (const ikona of m.icons) {
    const res = await request.get(new URL(ikona.src, new URL('manifest.webmanifest', baseURL)).href);
    expect(res.ok(), ikona.src).toBeTruthy();
    expect(res.headers()['content-type']).toContain('image/png');
  }
});

test.describe('„W promieniu” po ustaleniu położenia', () => {
  test.use({ geolocation: RZESZOW, permissions: ['geolocation'] });

  test('chipy pojawiają się po lokalizacji, zawężają listę, „Wyczyść” je zdejmuje', async ({ page }) => {
    const wszystkie = domyslnieNaLiscie(dane);
    await expect(page.locator('#promien-row')).toBeHidden();
    await page.locator('#locbtn').click();
    await expect(page.locator('#promien-row')).toBeVisible();
    await expect(page.locator('#count')).toContainText('posortowano wg odległości');

    await page.locator('#promien .chip[data-km="10"]').click();
    await expect(page.locator('#count')).toContainText('do 10 km');
    const n10 = await liczbaPozycji(page);
    expect(n10).toBeGreaterThan(0);
    expect(n10).toBeLessThan(wszystkie);
    const km = await page
      .locator('#list .item')
      .evaluateAll((items) => items.map((i) => parseFloat(/· ([\d.]+) km/.exec(i.textContent)?.[1])));
    expect(km.every((x) => x <= 10)).toBeTruthy();

    await page.locator('#promien .chip[data-km="50"]').click();
    expect(await liczbaPozycji(page)).toBeGreaterThanOrEqual(n10);
    await expect(page.locator('#promien .chip.on')).toHaveText('50 km');

    if (await page.locator('#more').isHidden()) await page.locator('#morebtn').click();
    await page.locator('#resetbtn').click();
    await expect.poll(() => liczbaPozycji(page)).toBe(wszystkie);
    await expect(page.locator('#promien .chip.on')).toHaveCount(0);
  });
});
