import { ana, bruno, capture, expect, loginAs, test, tomorrow } from "./support.js";

test.describe("Transversal — E2E del flujo principal (mobile)", () => {
  test("PT-TR-50 Flujo login (cookie JWT), cartelera, elegir función, crear sala y chatear → sala creada con el usuario como anfitrión y mensaje visible en el chat", async ({ anaPage: page }, testInfo) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/feed$/);
    await expect(page.getByRole("heading", { name: "¿Qué vemos?" })).toBeVisible();
    await capture(page, testInfo, "01-feed-cartelera");

    await page.getByRole("tab", { name: "Mañana" }).click();
    await expect(page).toHaveURL(/dia=\d{4}-\d{2}-\d{2}/);
    const funcion = page.getByRole("button", { name: /18:30.*Dune: Parte Tres/ });
    await expect(funcion).toBeEnabled();
    await capture(page, testInfo, "02-cartelera-manana");
    await funcion.click();

    await expect(page).toHaveURL(/\/crear-sala$/);
    await expect(page.locator(".selected-movie-title")).toHaveText("Dune: Parte Tres");
    await expect(page.getByLabel("Cine y Zona")).toHaveValue("Multiplex Belgrano");
    await expect(page.getByLabel("Horario")).toHaveValue("18:30");
    await page.getByRole("button", { name: "3", exact: true }).click();
    await page.getByLabel("Nota para otros cinéfilos (Opcional)").fill(`Sala E2E ${testInfo.project.name}`);
    await capture(page, testInfo, "03-crear-sala");
    await page.getByRole("button", { name: "Crear Sala" }).click();

    await expect(page).toHaveURL(/\/sala\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: "Dune: Parte Tres" })).toBeVisible();
    await expect(page.getByText("Miembros (1/3)")).toBeVisible();
    await expect(page.locator(".room-member-item", { hasText: ana.name })).toContainText("Admin");

    const input = page.getByRole("textbox", { name: "Mensaje" });
    await expect(page.getByText("Conectando…")).toBeHidden();
    await input.fill("¡Hola! ¿Nos vemos en el hall 18:15?");
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.locator(".chat-message-bubble", { hasText: "¿Nos vemos en el hall 18:15?" })).toBeVisible();
    await expect(input).toHaveValue("");
    await capture(page, testInfo, "04-sala-chat");
  });

  test("PT-TR-51 Dos usuarios en la misma sala → el segundo se une y ambos reciben los mensajes en tiempo real (y persisten al recargar)", async ({ anaPage, browser, baseURL }, testInfo) => {
    const created = await anaPage.request.post("/salas", {
      data: { movie: "Relatos Salvajes", place: "Multiplex Belgrano", date: tomorrow(), time: "19:00", capacity: 2, note: "" },
    });
    expect(created.status()).toBe(201);
    const { sala } = await created.json();

    const brunoContext = await browser.newContext({ ...testInfo.project.use, baseURL });
    await loginAs(brunoContext, bruno, baseURL);
    const brunoPage = await brunoContext.newPage();

    await anaPage.goto(`/sala/${sala.id}`);
    await brunoPage.goto(`/sala/${sala.id}`);
    await expect(brunoPage.getByRole("textbox", { name: "Mensaje" })).toBeDisabled();
    await brunoPage.getByRole("button", { name: "Unirme a la Sala" }).click();
    await expect(brunoPage.getByRole("button", { name: "Salir de la Sala" })).toBeVisible();
    await expect(brunoPage.getByText("Miembros (2/2)")).toBeVisible();

    await expect(anaPage.getByText("Conectando…")).toBeHidden();
    await expect(brunoPage.getByText("Conectando…")).toBeHidden();
    await brunoPage.getByRole("textbox", { name: "Mensaje" }).fill("Llego 10 minutos antes");
    await brunoPage.getByRole("button", { name: "Enviar" }).click();
    await expect(anaPage.locator(".chat-message", { hasText: "Llego 10 minutos antes" })).toContainText(bruno.name);

    await anaPage.getByRole("textbox", { name: "Mensaje" }).fill("Perfecto, te espero");
    await anaPage.getByRole("button", { name: "Enviar" }).click();
    await expect(brunoPage.locator(".chat-message-bubble", { hasText: "Perfecto, te espero" })).toBeVisible();
    await capture(brunoPage, testInfo, "05-chat-dos-usuarios");

    // El historial se persiste por lotes (10 mensajes o 3 s): al recargar se lee desde Redis.
    await brunoPage.waitForTimeout(3500);
    await brunoPage.reload();
    await expect(brunoPage.locator(".chat-message-bubble")).toHaveText(["Llego 10 minutos antes", "Perfecto, te espero"]);
    await brunoContext.close();
  });

  test("PT-TR-52 Ruta interna sin sesión y login con ?error=invalid_state → botón de Google visible y aviso 'La sesión de inicio expiró'", async ({ page }, testInfo) => {
    await page.goto("/feed");
    await expect(page.getByRole("link", { name: "Iniciar sesión con Google" })).toHaveAttribute("href", "/auth/google");
    await page.goto("/?error=invalid_state");
    await expect(page.getByRole("alert")).toHaveText("La sesión de inicio expiró. Probá de nuevo.");
    await capture(page, testInfo, "06-login-invalid-state");
  });

  test("PT-TR-53 Cartelera de hoy → la función ya iniciada (00:01) aparece deshabilitada y la de las 23:59 habilitada", async ({ anaPage: page }) => {
    await page.goto("/feed");
    await page.getByRole("tab", { name: "Hoy" }).click();
    await expect(page.getByRole("button", { name: /Funcion Temprana E2E/ })).toBeDisabled();
    await expect(page.getByRole("button", { name: /Funcion Temprana E2E/ })).toContainText("Empezó");
    await expect(page.getByRole("button", { name: /Funcion Nocturna E2E/ })).toBeEnabled();
  });

  test("PT-TR-54 Viewport mobile → feed, salas y crear sala sin scroll horizontal", async ({ anaPage: page }) => {
    for (const route of ["/feed", "/feed?vista=salas", "/crear-sala"]) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `scroll horizontal en ${route}`).toBeLessThanOrEqual(0);
    }
  });

  test("PT-TR-55 Desde el feed, abrir el chat de una sala propia → a lo sumo 3 clics (RNF de usabilidad)", async ({ anaPage: page }) => {
    const created = await page.request.post("/salas", {
      data: { movie: "Sala tres clics", place: "Cine", date: tomorrow(), time: "21:00", capacity: 4 },
    });
    expect(created.status()).toBe(201);
    await page.goto("/feed");
    let clicks = 0;
    await page.getByRole("tab", { name: /Salas abiertas/ }).click();
    clicks++;
    await page.locator(".room-card", { hasText: "Sala tres clics" }).first().getByRole("link", { name: "Ver la sala" }).click();
    clicks++;
    await expect(page.getByRole("textbox", { name: "Mensaje" })).toBeEnabled();
    expect(clicks).toBeLessThanOrEqual(3);
  });

  test("PT-TR-57 Navegación completa con la CSP de nginx (feed, crear sala, sala con chat) → sin violaciones de CSP ni errores en consola", async ({ anaPage: page }) => {
    const problems = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") problems.push(msg.text());
    });
    page.on("pageerror", (error) => problems.push(error.message));

    const response = await page.goto("/feed");
    expect(response.headers()["content-security-policy"]).toContain("default-src 'self'");
    await expect(page.getByRole("heading", { name: "¿Qué vemos?" })).toBeVisible();
    await page.goto("/crear-sala");
    await expect(page.getByRole("heading", { name: "Crear Nueva Sala" })).toBeVisible();
    const created = await page.request.post("/salas", {
      data: { movie: "Sala CSP", place: "Cine", date: tomorrow(), time: "20:00", capacity: 2 },
    });
    const { sala } = await created.json();
    await page.goto(`/sala/${sala.id}`);
    await expect(page.getByText("Conectando…")).toBeHidden();
    await page.getByRole("textbox", { name: "Mensaje" }).fill("probando CSP");
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.locator(".chat-message-bubble", { hasText: "probando CSP" })).toBeVisible();

    expect(problems).toEqual([]);
  });

  test("PT-TR-56 El único miembro abandona la sala desde la UI → la sala desaparece y vuelve a 'Salas abiertas'", async ({ anaPage: page }) => {
    const created = await page.request.post("/salas", {
      data: { movie: "Sala para abandonar", place: "Cine", date: tomorrow(), time: "22:00", capacity: 2 },
    });
    const { sala } = await created.json();
    await page.goto(`/sala/${sala.id}`);
    await page.getByRole("button", { name: "Salir de la Sala" }).click();
    await expect(page).toHaveURL(/\/feed\?vista=salas$/);
    await expect(page.locator(".room-card", { hasText: "Sala para abandonar" })).toHaveCount(0);
    expect((await page.request.get(`/salas/${sala.id}`)).status()).toBe(404);
  });
});
