/**
 * ig_hide_for_you_logged_out.spec.js
 *
 * Regresión: con el filtro "Para ti" activo y SIN sesión, la pantalla de entrar
 * a Instagram se quedaba en negro.
 *
 * Causa: la app inyecta en document-start una hoja (`#ml-early-hide`) que
 * esconde `main article` en la ruta "/" para que el feed no parpadee. Esa hoja
 * se decide sólo por la ruta —se inyecta antes de que exista el DOM, así que no
 * puede saber si hay sesión— y sin sesión "/" es la pantalla de login, que
 * también vive dentro de `main article`.
 *
 * Estas pruebas corren en WebKit con perfil de iPhone a propósito: es lo que usa
 * el WKWebView de la app. Con el perfil Android del resto de la suite, la
 * página sin sesión ni siquiera trae `<main>`, así que el fallo no se
 * reproduce.
 */

const { test, expect, devices } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const JS_FILE = path.resolve(__dirname, '../../filters/instagram/ig_hide_for_you.js');
// El filtro se apoya en `window._mlSchedule`, que define baseline.js. La app lo
// inyecta siempre y antes que cualquier filtro (ver `baselineJs` en el manifest).
const BASELINE_FILE = path.resolve(__dirname, '../../filters/instagram/baseline.js');

// Las dos reglas que la app inyecta para este filtro en la ruta "/".
// Mantener a la par con `earlyHideScript` en FilterRegistry.swift.
const EARLY_HIDE_CSS =
  'main article{visibility:hidden!important} html,body{overflow:hidden!important}';

test.use({
  ...devices['iPhone 13'],
  browserName: 'webkit',
  // Sesión vacía: este es justo el caso que se rompía.
  storageState: { cookies: [], origins: [] },
});

async function injectEarlyHide(page) {
  await page.evaluate((css) => {
    let s = document.getElementById('ml-early-hide');
    if (!s) {
      s = document.createElement('style');
      s.id = 'ml-early-hide';
      (document.head || document.documentElement).appendChild(s);
    }
    s.textContent = css;
  }, EARLY_HIDE_CSS);
}

async function injectFilter(page) {
  await page.evaluate(fs.readFileSync(BASELINE_FILE, 'utf-8'));
  const js = fs.readFileSync(JS_FILE, 'utf-8');
  await page.evaluate(`(function(){\n${js}\n})()`);
}

test.describe('ig_hide_for_you sin sesión', () => {

  test('la pantalla de entrar sigue visible', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('main article', { timeout: 20_000 });

    await injectEarlyHide(page);

    // Sin el arreglo, aquí la pantalla ya está en negro.
    expect(await page.locator('main article').first().evaluate(
      (el) => getComputedStyle(el).visibility
    )).toBe('hidden');

    await injectFilter(page);
    await page.waitForTimeout(1_000);

    await expect(page.locator('main article').first()).toBeVisible();
  });

  test('la hoja que revierte el ocultado se aplica, y detrás de la de la app', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('main article', { timeout: 20_000 });

    await injectEarlyHide(page);
    await injectFilter(page);
    await page.waitForTimeout(1_000);

    const state = await page.evaluate(() => {
      const unhide = document.getElementById('ml-for-you-unhide');
      const early = document.getElementById('ml-early-hide');
      if (!unhide) return { present: false };
      return {
        present: true,
        // Tiene que ir después: misma especificidad y ambas !important, así que
        // sólo gana por orden de documento.
        afterEarly: !!early &&
          (early.compareDocumentPosition(unhide) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
        htmlOverflow: getComputedStyle(document.documentElement).overflow,
        bodyOverflow: getComputedStyle(document.body).overflow,
      };
    });

    expect(state.present).toBe(true);
    expect(state.afterEarly).toBe(true);
    expect(state.htmlOverflow).not.toBe('hidden');
    expect(state.bodyOverflow).not.toBe('hidden');
  });

  test('no se pinta el aviso de bloqueo', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('main article', { timeout: 20_000 });

    await injectEarlyHide(page);
    await injectFilter(page);
    await page.waitForTimeout(1_000);

    await expect(page.locator('#ml-for-you-overlay')).toHaveCount(0);
  });
});
