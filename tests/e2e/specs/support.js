import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test as base, expect } from "@playwright/test";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(readFileSync(path.join(HERE, "../../stack/fixtures.local.json"), "utf8"));
const CAPTURES = path.join(HERE, "../../../docs/testing/capturas");

export const [ana, bruno] = fixtures.users;

// El login real de Google no se automatiza: se inyecta el JWT de sesion que emitiria login-controller.
export async function loginAs(context, user, baseURL) {
  await context.addCookies([
    { name: "lum_session", value: user.token, url: baseURL, httpOnly: true, secure: true, sameSite: "Lax" },
  ]);
}

export async function capture(page, testInfo, name) {
  mkdirSync(CAPTURES, { recursive: true });
  const body = await page.screenshot({ path: path.join(CAPTURES, `e2e-${testInfo.project.name}-${name}.png`), fullPage: true });
  await testInfo.attach(name, { body, contentType: "image/png" });
}

export function tomorrow() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(
    new Date(Date.now() + 86400000)
  );
}

export const test = base.extend({
  anaPage: async ({ browser, baseURL }, use, testInfo) => {
    const context = await browser.newContext({ ...testInfo.project.use, baseURL });
    await loginAs(context, ana, baseURL);
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect };
