// B2: carga inicial en viewport mobile (Pixel 7, Chromium) contra el frontend nginx.
// Uso: SPKI=<sha256 base64 de la clave publica del certificado> node carga-inicial.mjs <dir con node_modules de @playwright/test> <fixtures.local.json> <salida.json>
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [modulesDir, fixturesPath, outPath] = process.argv.slice(2);
const require = createRequire(path.join(modulesDir, "package.json"));
const { chromium, devices } = require("@playwright/test");

const BASE_URL = process.env.BASE_URL ?? "https://localhost:8443";
const RUNS = 5;
const user = JSON.parse(readFileSync(fixturesPath, "utf8")).users[0];

// "Usable": el primer control de la pagina esta visible y habilitado. Cada condicion devuelve performance.now()
// y se pasa como funcion (no como texto) porque la CSP de nginx prohibe eval.
const PAGES = [
  { name: "login", path: "/", auth: false, ready: () => document.querySelector("a.google-signin-btn")?.offsetParent != null && performance.now() },
  {
    name: "feed",
    path: "/feed",
    auth: true,
    ready: () => {
      const tab = [...document.querySelectorAll("button[role=tab]")].find((b) => b.textContent.includes("Salas abiertas"));
      const content = document.querySelector(".timeline-item:not([disabled]), .feed-state");
      return Boolean(tab && !tab.disabled && content && !content.textContent.includes("Cargando")) && performance.now();
    },
  },
];

// Perfil de Lighthouse mobile (Slow 4G simulado + CPU 4x) y red local sin limites.
const PROFILES = [
  { name: "local", network: null, cpu: 1 },
  { name: "slow4g-cpu4x", network: { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 }, cpu: 4 },
];

async function measure(context, target, profile) {
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  if (profile.network) await cdp.send("Network.emulateNetworkConditions", { offline: false, ...profile.network });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: profile.cpu });

  const net = { bytes: 0, requests: 0, fromCache: 0, notModified: 0, external: 0 };
  cdp.on("Network.responseReceived", ({ response }) => {
    net.requests++;
    if (response.fromDiskCache || response.fromMemoryCache) net.fromCache++;
    if (response.status === 304) net.notModified++;
    if (!response.url.startsWith(BASE_URL)) net.external++;
  });
  cdp.on("Network.requestServedFromCache", () => {});
  cdp.on("Network.loadingFinished", ({ encodedDataLength }) => (net.bytes += encodedDataLength));
  await page.addInitScript(() => {
    window.__lcp = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__lcp = entry.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });

  await page.goto(BASE_URL + target.path, { waitUntil: "commit" });
  const usable = await (await page.waitForFunction(target.ready, null, { polling: "raf", timeout: 60000 })).jsonValue();
  await page.waitForLoadState("load");
  await page.waitForTimeout(500);
  const timing = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null;
    return { fcp, lcp: window.__lcp || null, domContentLoaded: nav.domContentLoadedEventEnd, load: nav.loadEventEnd, ttfb: nav.responseStart };
  });
  await page.close();
  return { ...timing, usable, ...net };
}

// Con ignoreHTTPSErrors Chromium no guarda nada en su cache HTTP (certificado con error): se confia en
// el certificado autofirmado por su SPKI (variable SPKI), asi las corridas "con cache" son reales.
const browser = await chromium.launch({ args: process.env.SPKI ? [`--ignore-certificate-errors-spki-list=${process.env.SPKI}`] : [] });
const results = [];
for (const profile of PROFILES) {
  for (const target of PAGES) {
    const contextOptions = { ...devices["Pixel 7"], ignoreHTTPSErrors: !process.env.SPKI, locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires" };
    const login = async (context) =>
      target.auth &&
      context.addCookies([{ name: "lum_session", value: user.token, url: BASE_URL, httpOnly: true, secure: true, sameSite: "Lax" }]);

    // Sin cache: un contexto nuevo (perfil limpio) por corrida.
    for (let run = 1; run <= RUNS; run++) {
      const context = await browser.newContext(contextOptions);
      await login(context);
      results.push({ profile: profile.name, page: target.name, cache: "sin cache", run, ...(await measure(context, target, profile)) });
      await context.close();
    }

    // Con cache: un contexto compartido, una visita previa para calentar y 5 medidas.
    const context = await browser.newContext(contextOptions);
    await login(context);
    await measure(context, target, profile);
    for (let run = 1; run <= RUNS; run++) {
      results.push({ profile: profile.name, page: target.name, cache: "con cache", run, ...(await measure(context, target, profile)) });
    }
    await context.close();
  }
}
await browser.close();
writeFileSync(outPath, JSON.stringify({ baseUrl: BASE_URL, device: "Pixel 7 (Chromium)", chromium: browser.version(), results }, null, 1));

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
for (const key of new Set(results.map((r) => `${r.profile}|${r.page}|${r.cache}`))) {
  const rs = results.filter((r) => `${r.profile}|${r.page}|${r.cache}` === key);
  const stat = (f) => `${Math.round(median(rs.map((r) => r[f])))} / ${Math.round(Math.max(...rs.map((r) => r[f])))}`;
  console.log(key.padEnd(34), "FCP", stat("fcp"), "| LCP", stat("lcp"), "| usable", stat("usable"), "| KB", stat("bytes").split(" / ").map((b) => (b / 1024).toFixed(1)).join(" / "), "| cache", rs[0].fromCache, "304:", rs[0].notModified, "ext:", rs[0].external);
}
